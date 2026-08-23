/**
 * Centralized chrome.storage / message keys.
 *
 * Historically these strings were hard-coded in each context (background,
 * content script, popup, options), which let them drift. Keeping them in one
 * place means a rename only has to happen once (with typechecking to catch
 * stale call-sites).
 */
export const STORAGE_KEY = "mlg_config" as const;
export const PENDING_EXPLANATION_KEY = "mlg_pending_explanation" as const;
export const CACHE_STORAGE_KEY = "mlg_translation_cache" as const;
export const NORMA_CACHE_KEY = "mlg_norma_cache" as const;
export const VOCAB_STORAGE_KEY = "mlg_vocab" as const;
export const UI_LANGUAGE_KEY = "mlg_ui_language" as const;
export const MY_EXAMPLES_KEY = "mlg_my_examples" as const;
