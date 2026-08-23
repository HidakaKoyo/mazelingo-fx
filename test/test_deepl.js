// DeepL API test script
// Usage: node test_deepl.js <api-key>

/** @type {{
  argv: string[];
  exit(code?: number): void;
}} */
var process = globalThis.process;

const apiKey = process.argv[2];
if (!apiKey) {
  console.error("Usage: node test_deepl.js <api-key>");
  process.exit(1);
}

const endpoint = "https://api-free.deepl.com/v2/translate",
  params = new URLSearchParams();
params.append("text", "Hello, world!");
params.append("text", "Our developer conference returns this spring.");
params.set("target_lang", "JA");
params.set("source_lang", "EN");

console.log("Request URL:", endpoint);
console.log("---");

const res = await fetch(endpoint, {
  body: params.toString(),
  headers: {
    Authorization: `DeepL-Auth-Key ${apiKey}`,
    "Content-Type": "application/x-www-form-urlencoded",
  },
  method: "POST",
});

console.log("Status:", res.status, res.statusText);

/** @type {unknown} */
const data = await res.json();
console.log("Response:", JSON.stringify(data, null, 2));
if (typeof data === "object" && data !== null && "translations" in data) {
  /** @type {unknown[]} */
  const translations = data.translations;
  translations.forEach((t, i) => {
    if (typeof t === "object" && t !== null && "text" in t && typeof t.text === "string") {
      console.log(`[${i}] ${t.text}`);
    }
  });
}
