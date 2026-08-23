/**
 * Model verification script
 * Sends a minimal request to each model ID listed below and prints whether
 * the provider accepts it. Use it when adding or removing models from
 * LLM_REGISTRY / the side panel. Model IDs come from each provider's
 * /models endpoint.
 *
 * Usage: node test/test_models.js
 * Requires: .env file with API keys (see .env.example)
 */

import "dotenv/config";

// ---- Model definitions ----

const MODELS = {
  glm: {
    baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    format: "openai",
    apiKeyEnv: "GLM_API_KEY",
    models: [
      "glm-4.5",
      "glm-4.5-air",
      "glm-4.6",
      "glm-4.7",
      "glm-5",
      "glm-5-turbo",
    ],
  },
  gpt: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    format: "openai",
    apiKeyEnv: "GPT_API_KEY",
    models: [
      "gpt-4o",
      "gpt-4o-mini",
      "gpt-4.1",
      "gpt-4.1-mini",
      "gpt-4.1-nano",
      "gpt-5",
      "gpt-5-mini",
      "gpt-5-nano",
      "gpt-5-pro",
      "gpt-5.1",
      "gpt-5.2",
      "gpt-5.2-pro",
      "gpt-5.4",
      "gpt-5.4-mini",
      "gpt-5.4-nano",
      "gpt-5.4-pro",
      "o1",
      "o1-pro",
      "o3",
      "o3-mini",
      "o4-mini",
    ],
  },
  claude: {
    baseUrl: "https://api.anthropic.com/v1/messages",
    format: "anthropic",
    apiKeyEnv: "CLAUDE_API_KEY",
    models: [
      "claude-sonnet-4-6",
      "claude-sonnet-4-5-20250929",
      "claude-sonnet-4-20250514",
      "claude-opus-4-6",
      "claude-opus-4-5-20251101",
      "claude-opus-4-1-20250805",
      "claude-opus-4-20250514",
      "claude-haiku-4-5-20251001",
      "claude-3-haiku-20240307",
    ],
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    format: "google",
    apiKeyEnv: "GEMINI_API_KEY",
    models: [
      "gemini-2.0-flash",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.5-pro",
      "gemini-3-flash-preview",
      "gemini-3.1-flash-lite-preview",
      "gemini-3.1-pro-preview",
    ],
  },
};

// ---- Request builders ----

const TEST_MESSAGE = "Say OK";

function buildOpenAIRequest(model, apiKey, baseUrl) {
  const useNewParam = model.startsWith("o") || model.startsWith("gpt-5");
  const body = {
    model,
    messages: [{ role: "user", content: TEST_MESSAGE }],
    ...(useNewParam ? { max_completion_tokens: 50 } : { max_tokens: 5 }),
  };
  return {
    url: baseUrl,
    options: {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  };
}

function buildAnthropicRequest(model, apiKey, baseUrl) {
  return {
    url: baseUrl,
    options: {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 5,
        messages: [{ role: "user", content: TEST_MESSAGE }],
      }),
    },
  };
}

function buildGoogleRequest(model, apiKey, baseUrl) {
  return {
    url: `${baseUrl}/models/${model}:generateContent?key=${apiKey}`,
    options: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: TEST_MESSAGE }] }],
        generationConfig: { maxOutputTokens: 5 },
      }),
    },
  };
}

const FORMAT_BUILDERS = {
  openai: buildOpenAIRequest,
  anthropic: buildAnthropicRequest,
  google: buildGoogleRequest,
};

// ---- Test runner ----

async function testModel(provider, model, apiKey, baseUrl, format) {
  const builder = FORMAT_BUILDERS[format];
  const { url, options } = builder(model, apiKey, baseUrl);

  const start = performance.now();
  const response = await fetch(url, options);
  const elapsed = Math.round(performance.now() - start);

  if (response.ok) {
    return { model, status: "OK", httpStatus: response.status, elapsed };
  }

  let errorDetail = "";
  try {
    const text = await response.text();
    const json = JSON.parse(text);
    errorDetail =
      json.error?.message || json.error?.type || text.slice(0, 120);
  } catch {
    errorDetail = `HTTP ${response.status}`;
  }
  return {
    model,
    status: "FAIL",
    httpStatus: response.status,
    elapsed,
    error: errorDetail,
  };
}

async function main() {
  console.log("=== Mazelingo Model Verification ===\n");

  const results = [];

  for (const [providerName, provider] of Object.entries(MODELS)) {
    const apiKey = process.env[provider.apiKeyEnv];
    if (!apiKey || apiKey.startsWith("your_")) {
      console.log(
        `[${providerName}] SKIP — ${provider.apiKeyEnv} not set\n`,
      );
      for (const model of provider.models) {
        results.push({ model, status: "SKIP", provider: providerName });
      }
      continue;
    }

    console.log(`[${providerName}] Testing ${provider.models.length} models...`);

    for (const model of provider.models) {
      try {
        const result = await testModel(
          providerName,
          model,
          apiKey,
          provider.baseUrl,
          provider.format,
        );
        result.provider = providerName;
        results.push(result);

        const icon = result.status === "OK" ? "✓" : "✗";
        const detail =
          result.status === "OK"
            ? `${result.elapsed}ms`
            : `${result.error} (${result.elapsed}ms)`;
        console.log(`  ${icon} ${model} — ${detail}`);
      } catch (err) {
        results.push({
          model,
          status: "ERROR",
          provider: providerName,
          error: err.message,
        });
        console.log(`  ✗ ${model} — ${err.message}`);
      }
    }
    console.log();
  }

  // ---- Summary ----
  console.log("=== Summary ===");
  const ok = results.filter((r) => r.status === "OK");
  const fail = results.filter((r) => r.status === "FAIL" || r.status === "ERROR");
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

  // Exit with error if any failed
  process.exit(fail.length > 0 ? 1 : 0);
}

main();
