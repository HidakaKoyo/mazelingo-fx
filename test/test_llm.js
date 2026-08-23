// Sends one translation request through the extension's own LLM layer
// (llm.js) so the request format tested here is the one the extension uses.
//
// Usage: node test/test_llm.js <model-name> <api-key>
// Example: node test/test_llm.js glm-4.7-flash your-api-key
// The provider is resolved from the model name prefix (see LLM_REGISTRY).

import { LLM_REGISTRY, callLLMChain } from "../llm.js";

const model = process.argv[2];
const apiKey = process.argv[3];

if (!model || !apiKey) {
  console.error("Usage: node test/test_llm.js <model-name> <api-key>");
  console.error("Known prefixes:", Object.keys(LLM_REGISTRY).join(", "));
  process.exit(1);
}

const prefix = Object.keys(LLM_REGISTRY)
  .sort((a, b) => b.length - a.length)
  .find((p) => model.startsWith(p));
if (!prefix) {
  console.error("No provider matches model:", model);
  console.error("Known prefixes:", Object.keys(LLM_REGISTRY).join(", "));
  process.exit(1);
}
const apiKeyKey = LLM_REGISTRY[prefix].apiKeyKey || prefix;

const texts = ["Hello, world!", "Our developer conference returns this spring."];
const messages = [
  {
    role: "system",
    content: 'You are a professional translator. Translate each given sentence from English to Japanese. Return a JSON object with a "translations" array containing the translated strings in the same order. Keep translations natural and contextually appropriate. Do not add explanations.',
  },
  { role: "user", content: JSON.stringify(texts) },
];
const schema = {
  type: "object",
  properties: {
    translations: { type: "array", items: { type: "string" } },
  },
  required: ["translations"],
  additionalProperties: false,
};

console.log(`Testing: ${model} (provider "${prefix}", key "${apiKeyKey}")`);
console.log(`Input: ${JSON.stringify(texts)}`);
console.log("---");

const start = Date.now();
try {
  const result = await callLLMChain([model], messages, { [apiKeyKey]: apiKey }, schema);
  console.log(`Elapsed: ${Date.now() - start}ms`);
  console.log("Parsed:", JSON.stringify(result, null, 2));
  if (Array.isArray(result?.translations)) {
    result.translations.forEach((t, i) => {
      console.log(`[${i}] "${texts[i]}" -> "${t}"`);
    });
  }
} catch (err) {
  console.error("Error:", err.message);
  process.exit(1);
}
