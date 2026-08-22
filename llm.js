const LLM_REGISTRY = {
  "openrouter/": {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    format: "openai",
    apiKeyKey: "openrouter",
    stripPrefix: "openrouter/",
    headers: {
      "HTTP-Referer": "https://chromewebstore.google.com/detail/mazelingo/bhdngeocokoeblnnlhjibojcadefimpi",
      "X-OpenRouter-Title": "Mazelingo",
    },
  },
  glm:      { baseUrl: "https://open.bigmodel.cn/api/paas/v4/chat/completions", format: "openai" },
  gpt:      { baseUrl: "https://api.openai.com/v1/chat/completions",            format: "openai" },
  o:        { baseUrl: "https://api.openai.com/v1/chat/completions",            format: "openai", apiKeyKey: "gpt" },
  deepseek: { baseUrl: "https://api.deepseek.com/chat/completions",             format: "openai" },
  claude:   { baseUrl: "https://api.anthropic.com/v1/messages",                 format: "anthropic" },
  gemini:   { baseUrl: "https://generativelanguage.googleapis.com/v1beta",      format: "google" },
};

const TRANSLATION_SCHEMA = {
  type: "object",
  properties: {
    blocks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          i: { type: "integer" },
          sentences: {
            type: "array",
            items: {
              type: "object",
              properties: {
                source: { type: "string" },
                translation: { type: "string" },
              },
              required: ["source", "translation"],
              additionalProperties: false,
            },
          },
        },
        required: ["i", "sentences"],
        additionalProperties: false,
      },
    },
  },
  required: ["blocks"],
  additionalProperties: false,
};

function resolveProvider(modelName) {
  const prefixes = Object.keys(LLM_REGISTRY).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (modelName.startsWith(prefix)) {
      return { prefix, entry: LLM_REGISTRY[prefix] };
    }
  }
  return null;
}

function stripMarkdownCodeBlock(text) {
  const match = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1] : text;
}

// --- OpenAI compatible (GLM, GPT, DeepSeek) ---

function buildOpenAIRequest(modelName, messages, apiKey, baseUrl, schema, extraHeaders = {}) {
  const body = { model: modelName, messages };
  if (schema) {
    body.response_format = {
      type: "json_schema",
      json_schema: { name: "response", strict: true, schema },
    };
  }
  return {
    url: baseUrl,
    options: {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    },
  };
}

function parseOpenAIResponse(data) {
  return JSON.parse(stripMarkdownCodeBlock(data.choices[0].message.content));
}

// --- Anthropic (Claude) ---
// Anthropic doesn't support structured output natively.
// Use tool_use to force JSON schema compliance.

function buildAnthropicRequest(modelName, messages, apiKey, baseUrl, _schema) {
  const systemMsg = messages.find(m => m.role === "system");
  const nonSystemMessages = messages.filter(m => m.role !== "system");
  // Add prefill to force JSON output without markdown
  const messagesWithPrefill = [
    ...nonSystemMessages,
    { role: "assistant", content: "{" },
  ];
  const body = {
    model: modelName,
    max_tokens: 16384,
    messages: messagesWithPrefill,
  };
  if (systemMsg) {
    body.system = systemMsg.content + "\n\nRespond with ONLY valid JSON. No markdown, no code blocks, no explanation.";
  }
  return {
    url: baseUrl,
    options: {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  };
}

function parseAnthropicResponse(data) {
  const textBlock = data.content.find(b => b.type === "text");
  const raw = textBlock.text;
  // Prepend "{" from prefill since Anthropic continues from it
  return JSON.parse("{" + stripMarkdownCodeBlock(raw));
}

// --- Google (Gemini) ---

function buildGoogleRequest(modelName, messages, apiKey, baseUrl, schema) {
  const systemMsg = messages.find(m => m.role === "system");
  const nonSystemMessages = messages.filter(m => m.role !== "system");

  const contents = nonSystemMessages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  const textFormat = { mimeType: "APPLICATION_JSON" };
  if (schema) {
    textFormat.schema = schema;
  }
  const generationConfig = { responseFormat: { text: textFormat } };

  const body = { contents, generationConfig };
  if (systemMsg) {
    body.systemInstruction = { parts: [{ text: systemMsg.content }] };
  }

  return {
    url: `${baseUrl}/models/${modelName}:generateContent`,
    options: {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(body),
    },
  };
}

function parseGoogleResponse(data) {
  if (data?.error?.message) {
    throw new Error(`Gemini API error: ${data.error.message}`);
  }
  const parts = data?.candidates?.[0]?.content?.parts;
  const textPart = Array.isArray(parts)
    ? parts.find(part => typeof part?.text === "string")
    : null;
  if (!textPart) {
    throw new Error("Gemini API returned no text candidate");
  }
  return JSON.parse(stripMarkdownCodeBlock(textPart.text));
}

// --- Format handler registry ---

const FORMAT_HANDLERS = {
  openai:    { build: buildOpenAIRequest,    parse: parseOpenAIResponse },
  anthropic: { build: buildAnthropicRequest, parse: parseAnthropicResponse },
  google:    { build: buildGoogleRequest,    parse: parseGoogleResponse },
};

// --- Core functions ---

function buildLLMRequest(modelName, messages, apiKey, schema) {
  const provider = resolveProvider(modelName);
  if (!provider) {
    throw new Error(`No provider found for model: ${modelName}`);
  }

  const handler = FORMAT_HANDLERS[provider.entry.format];
  const requestModelName = provider.entry.stripPrefix
    ? modelName.slice(provider.entry.stripPrefix.length)
    : modelName;
  return handler.build(
    requestModelName,
    messages,
    apiKey,
    provider.entry.baseUrl,
    schema,
    provider.entry.headers,
  );
}

async function callLLM(modelName, messages, apiKey, schema) {
  const provider = resolveProvider(modelName);
  if (!provider) {
    throw new Error(`No provider found for model: ${modelName}`);
  }

  const handler = FORMAT_HANDLERS[provider.entry.format];
  const { url, options } = buildLLMRequest(modelName, messages, apiKey, schema);

  console.log(`[mlg:llm] calling ${modelName} (${provider.entry.format}) → ${url}`);
  const startTime = performance.now();

  const response = await fetch(url, options);
  const elapsed = Math.round(performance.now() - startTime);
  if (!response.ok) {
    const text = await response.text();
    console.error(`[mlg:llm] ${modelName} failed (${response.status}) [${elapsed}ms]:`, text.slice(0, 500));
    let detail = text;
    try {
      const errorData = JSON.parse(text);
      if (errorData?.error?.message) detail = errorData.error.message;
    } catch (_error) {
      // Keep the raw response text when the API did not return JSON.
    }
    throw new Error(`LLM request failed (${response.status}): ${detail}`);
  }

  const data = await response.json();
  console.log(`[mlg:llm] ${modelName} response [${elapsed}ms]:`, JSON.stringify(data).slice(0, 500));
  return handler.parse(data);
}

async function callLLMChain(models, messages, apiKeys, schema) {
  console.log("[mlg:llm] chain start, models:", models, "apiKeys present:", Object.keys(apiKeys));
  const errors = [];

  for (const modelName of models) {
    const provider = resolveProvider(modelName);
    if (!provider) {
      console.warn(`[mlg:llm] no provider for model: ${modelName}`);
      errors.push(new Error(`No provider found for model: ${modelName}`));
      continue;
    }

    const apiKeyKey = provider.entry.apiKeyKey || provider.prefix;
    const apiKey = apiKeys[apiKeyKey];
    if (!apiKey) {
      console.log(`[mlg:llm] skipping ${modelName} (no API key for "${provider.prefix}")`);
      continue;
    }

    try {
      const result = await callLLM(modelName, messages, apiKey, schema);
      console.log(`[mlg:llm] ${modelName} succeeded`);
      return result;
    } catch (e) {
      console.error(`[mlg:llm] ${modelName} failed:`, e.message);
      errors.push(e);
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `All models failed:\n${errors.map(e => e.message).join("\n")}`
    );
  }
  throw new Error("No API keys available for any of the specified models");
}

export {
  LLM_REGISTRY,
  TRANSLATION_SCHEMA,
  buildGoogleRequest,
  buildLLMRequest,
  parseGoogleResponse,
  callLLM,
  callLLMChain,
};
