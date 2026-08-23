import { LLM_REGISTRY } from "@/utils/llm";
import { elements } from "./elements";
import { getProviderPrefix } from "./models";

function renderApiKeyRow(prefix: string, apiKeyValue: string, onDirty: () => void): void {
  const row = document.createElement("div");
  row.className = "api-key-row";

  const label = document.createElement("label");
  label.textContent = `${prefix} API key`;
  label.setAttribute("for", `apikey-${prefix}`);

  const wrap = document.createElement("div");
  wrap.className = "api-key-wrap";

  const input = document.createElement("input");
  input.type = "password";
  input.id = `apikey-${prefix}`;
  input.className = "input";
  input.dataset.prefix = prefix;
  input.placeholder = `${prefix} API key`;
  input.value = apiKeyValue;
  input.addEventListener("input", onDirty);

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "api-key-toggle";
  toggle.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
  toggle.addEventListener("click", () => {
    input.type = input.type === "password" ? "text" : "password";
  });

  wrap.append(input);
  wrap.append(toggle);
  row.append(label);
  row.append(wrap);
  elements.apiKeysSection.append(row);
}

export function renderApiKeyFields(
  models: readonly string[],
  apiKeys: Readonly<Record<string, string>>,
  onDirty: () => void,
): void {
  elements.apiKeysSection.innerHTML = "";
  const prefixes: string[] = [],
    seen = new Set<string>();
  models.forEach((model) => {
    const prefix = getProviderPrefix(model);
    if (prefix === null) {
      return;
    }
    const apiKeyKey = LLM_REGISTRY[prefix]?.apiKeyKey ?? prefix;
    if (!seen.has(apiKeyKey)) {
      seen.add(apiKeyKey);
      prefixes.push(apiKeyKey);
    }
  });
  prefixes.forEach((prefix) => {
    renderApiKeyRow(prefix, apiKeys[prefix] ?? "", onDirty);
  });
}

export function collectApiKeys(): Record<string, string> {
  const inputs = elements.apiKeysSection.querySelectorAll<HTMLInputElement>("input[data-prefix]"),
    keys: Record<string, string> = {};
  inputs.forEach((input) => {
    const value = input.value.trim();
    if (value) {
      keys[input.dataset.prefix ?? ""] = value;
    }
  });
  return keys;
}
