# Mazelingo-FX Privacy Policy

**Last updated: August 23, 2026**

## Summary

Mazelingo-FX does not operate an analytics service or an application backend. Extension data is stored locally in the browser. When the user invokes an AI-powered feature, the extension sends the data required for that feature directly to the configured third-party provider. Those providers process the transmitted data under their own terms and privacy policies.

## Data Stored in the Browser

Mazelingo-FX uses the WebExtensions `storage.local` API to store:

- settings, including enabled state, language and mix preferences, selected models, and site include/exclude lists;
- API keys entered by the user;
- translation cache entries;
- vocabulary items and their learning state;
- pending sentence-explanation data, UI language, and saved examples.

API keys are stored in plaintext in the browser extension's local storage. They are not protected by application-level encryption or a dedicated secret vault. Users should not save keys in a shared or untrusted browser profile.

## Data Sent to Third-Party Providers

Requests are sent directly from the extension to the relevant provider; they do not pass through a Mazelingo-FX server.

- For translation, sentence explanation, writing feedback, vocabulary analysis, and quiz generation, the extension sends the applicable text or page content and the corresponding API key directly to the selected LLM provider.
- For text-to-speech, the extension sends the requested text, voice setting, and the user's OpenAI API key directly to OpenAI.

Supported LLM endpoints include OpenAI, Anthropic, Google Gemini, OpenRouter, DeepSeek, and Zhipu AI / GLM. The exact recipient depends on the selected model. The extension receives and displays the provider response and may store translation results in the local translation cache.

Third-party providers may log, retain, or otherwise process requests according to their own policies. Users are responsible for reviewing the terms, privacy policy, and data controls of each provider they configure. Mazelingo-FX does not control provider-side retention or training practices.

## Analytics and Mazelingo-FX Servers

Mazelingo-FX contains no analytics integration and does not send extension usage, settings, API keys, page text, or generated content to a Mazelingo-FX-owned backend. No account system or remote Mazelingo-FX data store is used.

## Data Retention and Deletion

Locally stored settings, API keys, cache entries, vocabulary, and saved examples remain in the browser profile until the extension or browser removes them, the user clears them through an available control, or the user clears extension data. Translation cache entries are also subject to the extension's cache limits and expiry policy.

Uninstalling the extension normally removes its local extension storage according to the browser's behavior. Data already sent to a third-party provider is governed by that provider's retention policy and cannot be deleted by uninstalling Mazelingo-FX.

## User Controls

Users can:

- change stored settings and API keys through the Sidebar / Side Panel or options UI;
- remove API keys or clear browser extension data;
- clear the translation cache through the extension UI;
- control the websites processed by editing the site include and exclude lists; and
- stop future provider transmissions by disabling the extension, removing API keys, or uninstalling it.

The default include list is `https://*`, so all HTTPS sites are enabled unless the user narrows the include list or adds exclusions.

## Changes to This Policy

This policy may be updated when the extension's storage, network behavior, supported providers, or distribution requirements change. The date above identifies the latest revision.

## Contact

Questions about this policy may be sent to mazelingo.dev@gmail.com.
