// DeepL API test script
// Usage: node test_deepl.js <api-key>

const apiKey = process.argv[2];
if (!apiKey) {
  console.error("Usage: node test_deepl.js <api-key>");
  process.exit(1);
}

const endpoint = "https://api-free.deepl.com/v2/translate";
const params = new URLSearchParams();
params.append("text", "Hello, world!");
params.append("text", "Our developer conference returns this spring.");
params.set("target_lang", "JA");
params.set("source_lang", "EN");

console.log("Request URL:", endpoint);
console.log("---");

fetch(endpoint, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Authorization": `DeepL-Auth-Key ${apiKey}`,
  },
  body: params.toString(),
})
  .then(async (res) => {
    console.log("Status:", res.status, res.statusText);
    const data = await res.json();
    console.log("Response:", JSON.stringify(data, null, 2));
    if (data.translations) {
      data.translations.forEach((t, i) => {
        console.log(`[${i}] ${t.text}`);
      });
    }
  })
  .catch((err) => {
    console.error("Error:", err.message);
  });
