// LLM API test script
// Usage: node test_llm.js <provider-prefix> <model-name> <api-key>
// Example: node test_llm.js glm glm-4.7-flash your-api-key

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
    role: "system",
    content: 'You are a professional translator. Translate each given sentence from English to Japanese. Return a JSON object with a "translations" array containing the translated strings in the same order. Keep translations natural and contextually appropriate. Do not add explanations.',
  },
  {
    role: "user",
    content: JSON.stringify(texts),
  },
];

const providers = {
  glm: {
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    build: () => ({
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
    }),
    parse: (data) => JSON.parse(data.choices[0].message.content),
  },
  gpt: {
    url: "https://api.openai.com/v1/chat/completions",
    build: () => ({
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
    }),
    parse: (data) => JSON.parse(data.choices[0].message.content),
  },
  deepseek: {
    url: "https://api.deepseek.com/chat/completions",
    build: () => ({
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, response_format: { type: "json_object" } }),
    }),
    parse: (data) => JSON.parse(data.choices[0].message.content),
  },
  claude: {
    url: "https://api.anthropic.com/v1/messages",
    build: () => ({
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 4096, system: messages[0].content, messages: [messages[1]] }),
    }),
    parse: (data) => JSON.parse(data.content[0].text),
  },
  gemini: {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    build: () => ({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: messages[0].content }] },
        contents: [{ role: "user", parts: [{ text: messages[1].content }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }),
    parse: (data) => JSON.parse(data.candidates[0].content.parts[0].text),
  },
};

const provider = providers[prefix];
if (!provider) {
  console.error("Unknown provider:", prefix);
  console.error("Available:", Object.keys(providers).join(", "));
  process.exit(1);
}

console.log(`Testing: ${model} (${prefix})`);
console.log(`URL: ${provider.url}`);
console.log(`Input: ${JSON.stringify(texts)}`);
console.log("---");

const start = Date.now();
fetch(provider.url, provider.build())
  .then(async (res) => {
    const elapsed = Date.now() - start;
    console.log(`Status: ${res.status} ${res.statusText} (${elapsed}ms)`);
    if (!res.ok) {
      const text = await res.text();
      console.error("Error:", text.slice(0, 500));
      return;
    }
    const data = await res.json();
    console.log("Raw response:", JSON.stringify(data).slice(0, 500));
    const result = provider.parse(data);
    console.log("Parsed:", JSON.stringify(result, null, 2));
    if (result.translations) {
      result.translations.forEach((t, i) => {
        console.log(`[${i}] "${texts[i]}" → "${t}"`);
      });
    }
  })
  .catch((err) => {
    console.error("Error:", err.message);
  });
