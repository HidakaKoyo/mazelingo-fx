/**
 * Model verification script: sends a minimal request to each model to verify
 * the model ID is valid. Model list sourced from each provider's /models API.
 * Usage: node test/test_models.js (requires .env API keys, see .env.example)
 */
/**
 * @param {unknown} proc
 * @param {string} key
 * @returns {string | undefined}
 */
function getEnv(proc, key) {
  let found;
  if (
    typeof proc === "object" &&
    proc !== null &&
    "env" in proc &&
    typeof proc.env === "object" &&
    proc.env !== null
  ) {
    for (const [k, v] of Object.entries(proc.env)) {
      if (k === key && typeof v === "string") {
        found = v;
        break;
      }
    }
  }
  return found;
}
/**
 * @param {unknown} proc
 */
function loadEnvFile(proc) {
  if (typeof proc === "object" && proc !== null && "loadEnvFile" in proc) {
    /** @type {() => void} */
    const fn = proc.loadEnvFile;
    fn();
  }
}
/**
 * @param {unknown} proc
 * @param {number} code
 */
function setExitCode(proc, code) {
  if (typeof proc === "object" && proc !== null && "exitCode" in proc) {
    proc.exitCode = code;
  }
}
try {
  loadEnvFile(process);
} catch {
  // .env not present; API keys may be unset
}
/**
 * @typedef {{
 *   readonly elapsed?: number, readonly error?: string, readonly httpStatus?: number,
 *   readonly model: string, readonly provider: string,
 *   readonly status: "ERROR" | "FAIL" | "OK" | "SKIP",
 * }} Result
 */
import { MODELS } from "./model-catalog.js";

const TEST_MESSAGE = "Say OK";
/**
 * @param {string} model
 * @param {string} apiKey
 * @param {string} baseUrl
 */
function buildOpenAIRequest(model, apiKey, baseUrl) {
  const useNewParam = model.startsWith("o") || model.startsWith("gpt-5");
  const body = {
    messages: [{ role: "user", content: TEST_MESSAGE }],
    model,
    ...(useNewParam ? { max_completion_tokens: 50 } : { max_tokens: 5 }),
  };
  return {
    options: {
      body: JSON.stringify(body),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      method: "POST",
    },
    url: baseUrl,
  };
}
/**
 * @param {string} model
 * @param {string} apiKey
 * @param {string} baseUrl
 */
function buildAnthropicRequest(model, apiKey, baseUrl) {
  return {
    options: {
      body: JSON.stringify({
        model,
        max_tokens: 5,
        messages: [{ role: "user", content: TEST_MESSAGE }],
      }),
      headers: {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      method: "POST",
    },
    url: baseUrl,
  };
}
/**
 * @param {string} model
 * @param {string} apiKey
 * @param {string} baseUrl
 */
function buildGoogleRequest(model, apiKey, baseUrl) {
  return {
    options: {
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: TEST_MESSAGE }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
      headers: { "Content-Type": "application/json" },
      method: "POST",
    },
    url: `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
  };
}
/** @type {Record<string, (model: string, apiKey: string, baseUrl: string) => { options: object, url: string }>} */
const FORMAT_BUILDERS = {
  anthropic: buildAnthropicRequest,
  google: buildGoogleRequest,
  openai: buildOpenAIRequest,
};
/**
 * @param {unknown} parsed
 * @param {string} text
 * @returns {string}
 */
function formatErrorDetail(parsed, text) {
  if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
    const error = parsed.error;
    if (typeof error === "object" && error !== null) {
      const message = "message" in error ? error.message : undefined;
      if (typeof message === "string") {
        return message;
      }
      const type = "type" in error ? error.type : undefined;
      if (typeof type === "string") {
        return type;
      }
    }
  }
  return text.slice(0, 120);
}
/**
 * @param {string} provider
 * @param {string} model
 * @param {string} apiKey
 * @param {string} baseUrl
 * @param {string} format
 * @returns {Promise<Result>}
 */
async function testModel(provider, model, apiKey, baseUrl, format) {
  const builder = FORMAT_BUILDERS[format];
  const { options, url } = builder(model, apiKey, baseUrl);
  const start = performance.now();
  const response = await fetch(url, options);
  const elapsed = Math.round(performance.now() - start);
  if (response.ok) {
    return { elapsed, httpStatus: response.status, model, provider, status: "OK" };
  }
  let errorDetail = `HTTP ${response.status}`;
  try {
    const text = await response.text();
    /** @type {unknown} */
    const parsed = JSON.parse(text);
    errorDetail = formatErrorDetail(parsed, text);
  } catch {
    // keep the HTTP status as the error detail
  }
  return {
    elapsed,
    error: errorDetail,
    httpStatus: response.status,
    model,
    provider,
    status: "FAIL",
  };
}
/**
 * @param {string} providerName
 * @param {ReadonlyArray<string>} models
 * @param {string} apiKey
 * @param {string} baseUrl
 * @param {string} format
 * @returns {Promise<Result[]>}
 */
function runProvider(providerName, models, apiKey, baseUrl, format) {
  return Promise.all(
    models.map((model) =>
      testModel(providerName, model, apiKey, baseUrl, format).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        console.log(`  ✗ ${model} — ${message}`);
        return { model, provider: providerName, status: "ERROR", error: message };
      }),
    ),
  );
}
/**
 * @param {ReadonlyArray<Result>} results
 * @returns {number}
 */
function failCount(results) {
  return results.filter((r) => r.status === "FAIL" || r.status === "ERROR").length;
}
/**
 * @param {ReadonlyArray<Result>} results
 */
function printSummary(results) {
  console.log("=== Summary ===");
  const fail = results.filter((r) => r.status === "FAIL" || r.status === "ERROR");
  const ok = results.filter((r) => r.status === "OK");
  const skip = results.filter((r) => r.status === "SKIP");
  console.log(`  OK: ${ok.length}  FAIL: ${fail.length}  SKIP: ${skip.length}`);
  if (fail.length > 0) {
    console.log("\nFailed models:");
    for (const r of fail) {
      console.log(`  ✗ ${r.model} (${r.provider}) — ${r.error}`);
    }
  }
  if (ok.length > 0) {
    console.log("\nValid models for MODEL_OPTIONS:");
    for (const r of ok) {
      console.log(`  "${r.model}"`);
    }
  }
}
/**
 * @returns {Promise<void>}
 */
async function main() {
  console.log("=== Mazelingo Model Verification ===\n");
  /** @type {Result[]} */
  const results = [];
  /** @type {Promise<Result[]>[]} */
  const pending = [];
  for (const [providerName, provider] of Object.entries(MODELS)) {
    const apiKey = getEnv(process, provider.apiKeyEnv) ?? "";
    if (apiKey === "" || apiKey.startsWith("your_")) {
      console.log(`[${providerName}] SKIP — ${provider.apiKeyEnv} not set\n`);
      for (const model of provider.models) {
        results.push({ model, provider: providerName, status: "SKIP" });
      }
      continue;
    }
    console.log(`[${providerName}] Testing ${provider.models.length} models...`);
    pending.push(
      runProvider(providerName, provider.models, apiKey, provider.baseUrl, provider.format),
    );
  }
  const settled = await Promise.all(pending);
  for (const rows of settled) {
    for (const r of rows) {
      const icon = r.status === "OK" ? "✓" : "✗";
      const detail = r.status === "OK" ? `${r.elapsed}ms` : `${r.error} (${r.elapsed}ms)`;
      console.log(`  ${icon} ${r.model} — ${detail}`);
      results.push(r);
    }
    console.log();
  }
  printSummary(results);
  setExitCode(process, failCount(results) > 0 ? 1 : 0);
}
await main();
