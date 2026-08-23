// LLM API test script
// Usage: node test_llm.js <provider-prefix> <model-name> <api-key>
// Example: node test_llm.js glm glm-4.7-flash your-api-key

/// <reference types="node" />

const prefix = process.argv[2];
const model = process.argv[3];
const apiKey = process.argv[4];

if (!prefix || !model || !apiKey) {
  console.error("Usage: node test_llm.js <provider-prefix> <model-name> <api-key>");
  console.error("Example: node test_llm.js glm glm-4.7-flash your-api-key");
  process.exit(1);
}

const texts = ["Hello, world!", "Our developer conference returns this spring."];
const messages = [
  {
    content:
      'You are a professional translator. Translate each given sentence from English to Japanese. Return a JSON object with a "translations" array containing the translated strings in the same order. Keep translations natural and contextually appropriate. Do not add explanations.',
    role: "system",
  },
  {
    content: JSON.stringify(texts),
    role: "user",
  },
];

/**
 * @param {unknown} value
 * @returns {value is { content: { text: string }[] }}
 */
const hasContent = (value) =>
  typeof value === "object" && value !== null && Array.isArray(value.content);

/**
 * @param {unknown} value
 * @returns {value is { choices: { message: { content: string } }[] }}
 */
const hasChoices = (value) =>
  typeof value === "object" && value !== null && Array.isArray(value.choices);

/**
 * @param {unknown} value
 * @returns {value is { candidates: { content: { parts: { text: string }[] } }[] }}
 */
const hasCandidates = (value) =>
  typeof value === "object" && value !== null && Array.isArray(value.candidates);

/**
 * @param {unknown} value
 * @returns {value is { translations: string[] }}
 */
const hasTranslations = (value) =>
  typeof value === "object" && value !== null && Array.isArray(value.translations);

/**
 * @param {string} text
 * @returns {unknown}
 */
const parseJson = (text) => JSON.parse(text);

/**
 * @param {unknown} data
 * @returns {unknown}
 */
const parseResult = (data) => {
  if (hasContent(data)) return parseJson(data.content[0].text);
  if (hasChoices(data)) return parseJson(data.choices[0].message.content);
  if (hasCandidates(data)) return parseJson(data.candidates[0].content.parts[0].text);
  return null;
};

/**
 * @typedef {{
 *   build: () => { method: string; headers: Record<string, string>; body: string },
 *   parse: (data: unknown) => unknown,
 *   url: string,
 * }} Provider
 */

/** @type {Record<string, Provider>} */
const providers = {
  claude: {
    build: () => ({
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: messages[0].content,
        messages: [messages[1]],
      }),
    }),
    parse: parseResult,
    url: "https://api.anthropic.com/v1/messages",
  },
  deepseek: {
    build: () => ({
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
    }),
    parse: parseResult,
    url: "https://api.deepseek.com/chat/completions",
  },
  gemini: {
    build: () => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: messages[0].content }] },
        contents: [{ role: "user", parts: [{ text: messages[1].content }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }),
    parse: parseResult,
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
  },
  glm: {
    build: () => ({
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
    }),
    parse: parseResult,
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
  },
  gpt: {
    build: () => ({
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
    }),
    parse: parseResult,
    url: "https://api.openai.com/v1/chat/completions",
  },
};

const provider = providers[prefix];
if (provider === undefined) {
  console.error("Unknown provider:", prefix);
  console.error("Available:", Object.keys(providers).join(", "));
  process.exit(1);
}

console.log(`Testing: ${model} (${prefix})`);
console.log(`URL: ${provider.url}`);
console.log(`Input: ${JSON.stringify(texts)}`);
console.log("---");

const start = Date.now();
try {
  const res = await fetch(provider.url, provider.build());
  const elapsed = Date.now() - start;
  console.log(`Status: ${res.status} ${res.statusText} (${elapsed}ms)`);
  if (res.ok) {
    /** @type {unknown} */
    const data = await res.json();
    console.log("Raw response:", JSON.stringify(data).slice(0, 500));
    const result = provider.parse(data);
    console.log("Parsed:", JSON.stringify(result, null, 2));
    if (hasTranslations(result)) {
      result.translations.forEach((t, i) => {
        console.log(`[${i}] "${texts[i]}" → "${t}"`);
      });
    }
  } else {
    const text = await res.text();
    console.error("Error:", text.slice(0, 500));
  }
} catch (error) {
  if (error instanceof Error) {
    console.error("Error:", error.message);
  } else {
    console.error("Error:", error);
  }
}
