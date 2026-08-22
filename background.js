import { DEFAULT_CONFIG, mergeConfig } from "./config.js";
import { callLLMChain, TRANSLATION_SCHEMA } from "./llm.js";

const STORAGE_KEY = "mlg_config";
const PENDING_EXPLANATION_KEY = "mlg_pending_explanation";

const LANG_NAMES = {
  en: "English",
  ja: "Japanese",
};

const CJK_CHAR_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u3005\u3007\u30fc]/u;
const LETTER_OR_NUMBER_RE = /[\p{L}\p{N}]/u;
const CJK_LONG_UNIT_LIMIT = 45;
const OTHER_LONG_UNIT_LIMIT = 140;

function getPlainTextLengthInfo(html) {
  const plain = String(html || "").replace(/<[^>]*>/g, "");
  const chars = Array.from(plain);
  let cjkCount = 0;
  let letterOrNumberCount = 0;
  for (const char of chars) {
    if (CJK_CHAR_RE.test(char)) cjkCount++;
    if (LETTER_OR_NUMBER_RE.test(char)) letterOrNumberCount++;
  }
  const isCjkDominant = cjkCount > 0 && cjkCount * 2 >= letterOrNumberCount;
  return {
    length: chars.length,
    limit: isCjkDominant ? CJK_LONG_UNIT_LIMIT : OTHER_LONG_UNIT_LIMIT,
    isCjkDominant,
  };
}

function isLongTranslationUnit(source) {
  const { length, limit } = getPlainTextLengthInfo(source);
  return length > limit;
}

async function resplitLongUnit(unit, fromName, toName, config) {
  const messages = [
    {
      role: "system",
      content: `You receive ONE long HTML unit. Split it into 2 to 6 clause-sized reading units and translate each unit from ${fromName} to ${toName}.

Return JSON with exactly one "blocks" entry containing a "sentences" array of { "source", "translation" } objects.

Rules:
- Every source must be an exact, complete substring of the input HTML, and concatenating all sources in order must reproduce the input exactly
- Preserve HTML tags in source and translation; do not split inside a noun phrase, quotation/title, URL, or matched HTML tag pair
- Tokens such as ⟦1⟧ are placeholders for images or icons. Do not translate them; keep each token unchanged at the corresponding position in source and translation
- Translate using the context of the whole unit so the concatenated unit translations read naturally`,
    },
    { role: "user", content: unit.source },
  ];

  const result = await callLLMChain(config.models, messages, config.apiKeys, TRANSLATION_SCHEMA);
  const blocks = result?.blocks;
  const sentences = blocks?.[0]?.sentences;
  const sourcesRejoin = Array.isArray(sentences)
    && sentences.map((sentence) => sentence.source).join("") === unit.source;
  if (blocks?.length === 1 && sentences?.length >= 2 && sourcesRejoin) {
    return sentences;
  }
  console.warn("[mlg:bg] long-unit re-split rejected; keeping original unit", {
    blockCount: blocks?.length,
    unitCount: sentences?.length,
    sourcesRejoin,
  });
  return [unit];
}

async function resplitLongUnits(blocks, fromName, toName, config) {
  for (const block of blocks) {
    if (!Array.isArray(block?.sentences)) continue;
    const resplitSentences = [];
    for (const unit of block.sentences) {
      if (isLongTranslationUnit(unit?.source)) {
        resplitSentences.push(...await resplitLongUnit(unit, fromName, toName, config));
      } else {
        resplitSentences.push(unit);
      }
    }
    block.sentences = resplitSentences;
  }
}

// --- Translation cache (2-layer: memory + chrome.storage.local) ---
const memoryCache = new Map();
const CACHE_STORAGE_KEY = "mlg_translation_cache";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_MAX_ENTRIES = 1000;

function buildCacheKey(html, from, to) {
  return `${from}:${to}:${html}`;
}

// 永続キャッシュは1つのオブジェクトとして保存されているので、翻訳1回につき
// 読み込み1回・書き込み1回にまとめる。以前はブロックごとに全体を読み書きしていて、
// エントリが溜まる(最大1000件、キーはHTML全文)ほどページ翻訳が重くなっていた。
async function loadPersistentCache() {
  const result = await chrome.storage.local.get(CACHE_STORAGE_KEY);
  return result[CACHE_STORAGE_KEY] || {};
}

async function savePersistentCache(cache) {
  // Evict expired entries
  const now = Date.now();
  const valid = Object.entries(cache).filter(([, v]) => now - v.timestamp < CACHE_TTL_MS);

  // If still over limit, remove oldest
  if (valid.length > CACHE_MAX_ENTRIES) {
    valid.sort((a, b) => a[1].timestamp - b[1].timestamp);
    valid.splice(0, valid.length - CACHE_MAX_ENTRIES);
  }

  await chrome.storage.local.set({ [CACHE_STORAGE_KEY]: Object.fromEntries(valid) });
}

async function getCacheStats() {
  const [cache, bytes] = await Promise.all([
    loadPersistentCache(),
    chrome.storage.local.getBytesInUse(CACHE_STORAGE_KEY),
  ]);
  return { entries: Object.keys(cache).length, bytes };
}

async function clearTranslationCache() {
  memoryCache.clear();
  await chrome.storage.local.remove(CACHE_STORAGE_KEY);
}

async function loadConfig() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return mergeConfig(result[STORAGE_KEY]);
}

async function translateBatch(payload) {
  const config = await loadConfig();
  console.log("[mlg:bg] translateBatch called", { models: config.models, apiKeysPresent: Object.keys(config.apiKeys), from: payload.from, to: payload.to, blockCount: payload.htmlBlocks?.length });
  const { htmlBlocks, from, to } = payload;
  if (!Array.isArray(htmlBlocks) || htmlBlocks.length === 0) {
    return { blocks: [] };
  }

  // --- Check caches for each block ---
  const results = new Array(htmlBlocks.length);
  const uncachedIndices = [];
  const uncachedBlocks = [];

  // Layer 2 (persistent) は1回だけ読み込む。読めなければ全件ミス扱い
  let persistentCache = {};
  try { persistentCache = await loadPersistentCache(); } catch (err) {
    console.warn("[mlg:bg] persistent cache read failed:", err.message);
  }

  for (let i = 0; i < htmlBlocks.length; i++) {
    const cacheKey = buildCacheKey(htmlBlocks[i], from, to);

    // Layer 1: memory cache
    const memEntry = memoryCache.get(cacheKey);
    if (memEntry && (Date.now() - memEntry.timestamp < CACHE_TTL_MS)) {
      results[i] = memEntry.block;
      continue;
    }

    // Layer 2: persistent cache
    const persEntry = persistentCache[cacheKey];
    if (persEntry && (Date.now() - persEntry.timestamp < CACHE_TTL_MS)) {
      results[i] = persEntry.block;
      memoryCache.set(cacheKey, persEntry); // promote to memory
      continue;
    }

    uncachedIndices.push(i);
    uncachedBlocks.push(htmlBlocks[i]);
  }

  const cacheHits = htmlBlocks.length - uncachedBlocks.length;
  if (cacheHits > 0) {
    console.log(`[mlg:bg] cache hit: ${cacheHits}/${htmlBlocks.length} blocks`);
  }

  // If all cached, return immediately
  if (uncachedBlocks.length === 0) {
    return { blocks: results };
  }

  // --- Translate uncached blocks via LLM ---
  const fromName = LANG_NAMES[from] || from;
  const toName = LANG_NAMES[to] || to;
  const messages = [
    {
      role: "system",
      content: `You are a professional translator. You receive an array of HTML snippets. For each snippet, split the source into natural reading units and translate each unit from ${fromName} to ${toName}.

Return a JSON "blocks" array with one entry per input snippet. Each entry has a "sentences" array. Each unit has "source" (original HTML) and "translation" (translated HTML).

Segmentation rules:
- A newline is normally a boundary. Keep text across a newline in one unit only when the next line is clearly a visual wrap that continues the same sentence; when uncertain, split
- Sentence-ending punctuation (. 。 ． ! ！ ? ？ …) is a boundary. Japanese often omits the final punctuation, so also split where one sentence ends with forms such as …かな, …だろ, …よね, …です, …ます, …た, or a closing bracket/quote and the next sentence begins
- If one sentence is long (roughly over 40 Japanese characters or 20 English words), split it into clause-sized units at 、 , ; — or clause connections such as けど, から, し, a Japanese て-form, but, because, or and then
- Do not split inside a noun phrase, quotation/title, URL, or matched HTML tag pair
- An HTML tag boundary is not a reading-unit boundary. One unit may span multiple inline elements

Source and translation rules:
- Every unit source must be an exact and complete substring of the original HTML. Concatenating all unit sources in order must reproduce that input snippet exactly
- Preserve HTML tags in both source and translation
- Tokens such as ⟦1⟧ are placeholders for images or icons. Do not translate them; keep each token unchanged at the corresponding position in source and translation
- Translate each unit in the context of the entire snippet, and make the concatenated unit translations read naturally
- Do not translate URLs
- Return the same number of blocks as input

Example (one long sentence split into four clause units):
Input: ["今日は朝から雨だったけど、傘を忘れたから、駅まで走って、なんとか電車に間に合った。"]
Output: {"blocks":[{"sentences":[{"source":"今日は朝から雨だったけど、","translation":"It had been raining since this morning, but "},{"source":"傘を忘れたから、","translation":"because I forgot my umbrella, "},{"source":"駅まで走って、","translation":"I ran to the station "},{"source":"なんとか電車に間に合った。","translation":"and somehow caught the train."}]}]}`,
    },
    {
      role: "user",
      content: JSON.stringify(uncachedBlocks),
    },
  ];
  console.log("[mlg:bg] calling LLM chain with models:", config.models, `(${uncachedBlocks.length} uncached of ${htmlBlocks.length})`);
  const llmResult = await callLLMChain(config.models, messages, config.apiKeys, TRANSLATION_SCHEMA);
  console.log("[mlg:bg] LLM result:", llmResult);
  const freshBlocks = llmResult.blocks || [];
  if (freshBlocks.length !== uncachedBlocks.length) {
    console.warn("[mlg:bg] block count mismatch", { expected: uncachedBlocks.length, got: freshBlocks.length });
    throw new Error(`Block count mismatch: expected ${uncachedBlocks.length}, got ${freshBlocks.length}`);
  }

  await resplitLongUnits(freshBlocks, fromName, toName, config);

  // --- Store fresh results in caches and merge into results ---
  let dirty = false;
  for (let i = 0; i < uncachedIndices.length; i++) {
    const idx = uncachedIndices[i];
    const block = freshBlocks[i];
    results[idx] = block;

    if (block.sentences && block.sentences.length > 0) {
      const cacheKey = buildCacheKey(htmlBlocks[idx], from, to);
      const entry = { block, timestamp: Date.now() };
      memoryCache.set(cacheKey, entry);
      persistentCache[cacheKey] = entry;
      dirty = true;
    }
  }
  if (dirty) {
    // Fire-and-forget persistent write, once per batch (don't block response)
    savePersistentCache(persistentCache).catch((err) =>
      console.warn("[mlg:bg] persistent cache write failed:", err.message)
    );
  }

  return { blocks: results };
}

const FEEDBACK_SCHEMA = {
  type: "object",
  properties: {
    corrected: { type: "string" },
    feedback: {
      type: "array",
      items: {
        type: "object",
        properties: {
          original: { type: "string" },
          corrected: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["original", "corrected", "explanation"],
        additionalProperties: false,
      },
    },
    overall: { type: "string" },
    alternativeExamples: {
      type: "array",
      items: {
        type: "object",
        properties: {
          en: { type: "string" },
          ja: { type: "string" },
          angle: { type: "string" },
        },
        required: ["en", "ja", "angle"],
        additionalProperties: false,
      },
    },
    vocabSuggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          en: { type: "string" },
          ja: { type: "string" },
        },
        required: ["en", "ja"],
        additionalProperties: false,
      },
    },
  },
  required: ["corrected", "feedback", "overall", "alternativeExamples", "vocabSuggestions"],
  additionalProperties: false,
};

const VOCAB_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    meaning: {
      type: "object",
      properties: {
        definition: { type: "string" },
        coreImage: { type: "string" },
        nativeFeel: { type: "string" },
        usageScene: { type: "string" },
      },
      required: ["definition", "coreImage", "nativeFeel", "usageScene"],
      additionalProperties: false,
    },
    frequency: { type: "string" },
    difficulty: { type: "string" },
    etymology: { type: "string" },
    pronunciation: {
      type: "object",
      properties: {
        ipa: { type: "string" },
        googleTranslateUrl: { type: "string" },
      },
      required: ["ipa", "googleTranslateUrl"],
      additionalProperties: false,
    },
    examples: {
      type: "array",
      items: {
        type: "object",
        properties: {
          en: { type: "string" },
          ja: { type: "string" },
        },
        required: ["en", "ja"],
        additionalProperties: false,
      },
    },
    collocations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          en: { type: "string" },
          ja: { type: "string" },
        },
        required: ["en", "ja"],
        additionalProperties: false,
      },
    },
    relatedWords: {
      type: "object",
      properties: {
        synonyms: { type: "array", items: { type: "string" } },
        antonyms: { type: "array", items: { type: "string" } },
        derivatives: { type: "array", items: { type: "string" } },
      },
      required: ["synonyms", "antonyms", "derivatives"],
      additionalProperties: false,
    },
  },
  required: ["meaning", "frequency", "difficulty", "etymology", "pronunciation", "examples", "collocations", "relatedWords"],
  additionalProperties: false,
};

const SENTENCE_EXPLANATION_SCHEMA = {
  type: "object",
  properties: {
    headline: { type: "string" },
    translation: { type: "string" },
    overview: { type: "string" },
    chunks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          role: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["text", "role", "explanation"],
        additionalProperties: false,
      },
    },
    grammarPoints: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["title", "explanation"],
        additionalProperties: false,
      },
    },
    vocabulary: {
      type: "array",
      items: {
        type: "object",
        properties: {
          term: { type: "string" },
          meaning: { type: "string" },
          nuance: { type: "string" },
        },
        required: ["term", "meaning", "nuance"],
        additionalProperties: false,
      },
    },
    readingSteps: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["headline", "translation", "overview", "chunks", "grammarPoints", "vocabulary", "readingSteps"],
  additionalProperties: false,
};

async function feedbackRequest(payload) {
  const config = await loadConfig();
  const { sourceText, userText, mode } = payload;

  let modeInstruction;
  if (mode === "quiz") {
    modeInstruction = `The user is responding to a conversation prompt: "${sourceText}". Evaluate how well they responded to this scenario.`;
  } else if (!sourceText) {
    modeInstruction = "The user is practicing free-form English writing. There is no original text to reference.";
  } else if (mode === "rephrase") {
    modeInstruction = "The user is attempting to rephrase or summarize the original text in English.";
  } else {
    modeInstruction = "The user is writing their opinion or analysis about the original text in English.";
  }

  const messages = [
    {
      role: "system",
      content: `You are an English writing tutor. ${modeInstruction}

The purpose of this feedback is to help the user improve their SPOKEN/CONVERSATIONAL English. Keep this in mind for all corrections.

Your job:
1. Correct the user's English writing (grammar, vocabulary, naturalness for spoken English)
2. List each correction with the original phrase, corrected phrase, and a brief explanation in Japanese
3. Give an overall assessment in Japanese (1-2 sentences)

Important:
- Do NOT replace casual/colloquial expressions with formal or written-style alternatives. If the user writes naturally for spoken English (e.g. "human-heavy", "kind of", "gonna"), that is GOOD — do not correct it.
- Only correct actual errors: grammar mistakes, unnatural phrasing that a native speaker would never say, or unclear meaning.
- Minor issues like comma placement and spelling typos should be mentioned as tips (in the "overall" field), but do NOT list them in the "feedback" corrections array. The "corrected" text should fix them, but they are not real mistakes. This is because the purpose is conversational English — in speech, commas and spelling don't exist. Focus feedback on what matters when speaking.
- Prefer short, punchy, conversational corrections over long formal rewrites.

Return JSON with:
- "corrected": the full corrected version of the user's text
- "feedback": array of { "original", "corrected", "explanation" } for each issue found
- "overall": a brief overall assessment in Japanese
- "alternativeExamples": 2-3 example sentences showing DIFFERENT perspectives or angles the user could have written about the same original text. Each item: { "en": English sentence, "ja": Japanese translation, "angle": brief description of the angle/perspective in Japanese (e.g. "反対意見", "具体例を挙げる", "感情面に注目") }. These should be distinctly different from what the user wrote — offer fresh viewpoints, not paraphrases. IMPORTANT: Write in casual, spoken English — the kind you would say to a friend, not write in an essay. Use contractions, simple structures, and natural conversational tone.
- "vocabSuggestions": array of noteworthy vocabulary from the user's writing. Each item: { "en": "english word or phrase", "ja": "japanese translation" }.
  Include BOTH:
  1. Reusable patterns and phrases — use "~" for variable parts (e.g. "from ~ perspective", "it is important to ~"). Only use concrete words when the phrase is a fixed expression (e.g. "as soon as possible", "by the way").
  2. Individual content words (nouns, verbs, adjectives, adverbs) that are worth learning (e.g. "implementation", "release", "overall").
  Do NOT include ultra-basic words (is, the, a, an, it, have, do, be, I, you, etc.) or simple pronouns/articles/auxiliary verbs.

If the writing is perfect, return empty feedback array and a positive overall message.`,
    },
    {
      role: "user",
      content: JSON.stringify(sourceText ? { originalText: sourceText, userWriting: userText } : { userWriting: userText }),
    },
  ];

  return await callLLMChain(config.models, messages, config.apiKeys, FEEDBACK_SCHEMA);
}

async function analyzeVocab(payload) {
  const config = await loadConfig();
  const { word } = payload;

  const messages = [
    {
      role: "system",
      content: `You are a professional English linguistics expert and language teacher. Analyze the given English word or phrase for a Japanese learner.

CRITICAL RULES - Follow these strictly to avoid hallucination:
- Only provide information you are highly confident about
- For etymology, only state well-established etymological facts
- For movie examples, only reference widely known, real movies/TV shows
- For pronunciation, provide standard IPA notation
- If the input is a phrase/idiom, analyze it as a whole unit, not individual words

Respond in the following structure:
- meaning.definition: Clear, concise meaning in Japanese (日本語で)
- meaning.coreImage: The core conceptual image behind this word/phrase in Japanese. Describe the fundamental feeling or mental picture (日本語で)
- meaning.nativeFeel: How native speakers intuitively feel/use this word/phrase, explained in Japanese (日本語で)
- meaning.usageScene: Typical situations where this is used, in Japanese (日本語で)
- frequency: Rate how often this word/phrase is ACTUALLY SPOKEN in daily English conversation.
  Base your rating on spoken corpus data (COCA spoken section, BNC spoken section).
  Important: even if a simpler synonym exists (e.g. "but" for "however"), rate the word itself by how often it appears in real spoken data. "however" appears very frequently in spoken English and should be ★★★★★.
  Do NOT confuse "formality" with "rarity". A word can sound slightly formal but still be spoken constantly (e.g. "however", "although", "especially").
  Think of it as: if you listened to 100 hours of English podcasts, YouTube videos, and casual conversations, how often would you hear this word?

  ★★★★★: Heard constantly — multiple times in any conversation or podcast episode.
  Core daily vocabulary that native speakers cannot avoid using.
  Examples: "actually", "kind of", "I mean", "already", "at least", "instead", "make sure", "however", "especially", "definitely"

  ★★★★: Heard very often — appears in most conversations, maybe not every single one.
  Common phrasal verbs, transitions, and expressions that come up daily.
  Examples: "figure out", "by the way", "end up", "deal with", "although", "look forward to", "turn out", "pick up"

  ★★★: Heard regularly but more situational — depends on topic or context.
  Useful vocabulary that a learner should know but won't hear in every conversation.
  Examples: "come up with", "get rid of", "put off", "regardless", "run out of", "catch up with", "whether"

  ★★: Heard occasionally — maybe a few times per week for an active English listener.
  Less common expressions or slightly niche vocabulary.
  Examples: "put up with", "carry on", "in spite of", "take for granted", "thoroughly", "count on"

  ★: Rarely heard in casual speech. Mostly appears in formal writing, academic contexts, or very specific situations.
  Examples: "moreover", "nevertheless", "henceforth", "notwithstanding", "inasmuch as"
- difficulty: One of "初級", "中級", "上級"
- etymology: Brief etymology or origin story in Japanese (日本語で). For phrases, explain how the phrase came to have its current meaning.
- pronunciation.ipa: IPA phonetic transcription
- pronunciation.googleTranslateUrl: Google Translate URL for audio. Format: https://translate.google.com/?sl=en&tl=ja&text=WORD&op=translate (URL-encode the word/phrase)
- examples: Exactly 3 natural example sentences with Japanese translations. Use everyday conversational contexts.
- collocations: Exactly 3 common collocations/word combinations with Japanese translations
- relatedWords.synonyms: 2-3 synonyms
- relatedWords.antonyms: 1-2 antonyms (empty array if not applicable)
- relatedWords.derivatives: 1-3 derived forms or related expressions (empty array if not applicable)`,
    },
    {
      role: "user",
      content: word,
    },
  ];

  return await callLLMChain(config.models, messages, config.apiKeys, VOCAB_ANALYSIS_SCHEMA);
}

async function explainSentence(payload) {
  const config = await loadConfig();
  const text = String(payload.text || payload.englishText || "").trim();
  const japaneseText = String(payload.japaneseText || "").trim();
  if (!text) {
    throw new Error("No sentence provided");
  }

  const messages = [
    {
      role: "system",
      content: `You are an expert English grammar and reading tutor for Japanese learners.

Analyze the given English sentence in Japanese. The goal is to help the learner read it carefully, understand the grammar, and see how meaning is built step by step.

Rules:
- Explain in Japanese.
- Keep explanations specific to the sentence. Do not give generic grammar lectures.
- Break the sentence into meaningful chunks, not single words unless needed.
- Explain grammar roles, structure, modifiers, clauses, tense/aspect, articles/prepositions, and nuance when relevant.
- If the user-provided Japanese translation is useful, compare against it briefly.
- Avoid markdown. Return only JSON that matches the schema.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        sentence: text,
        japaneseTranslation: japaneseText || undefined,
        sourceLang: payload.sourceLang || undefined,
        pageUrl: payload.pageUrl || undefined,
      }),
    },
  ];

  return await callLLMChain(config.models, messages, config.apiKeys, SENTENCE_EXPLANATION_SCHEMA);
}

// --- Norma cache (tracks completed output blocks) ---
const NORMA_CACHE_KEY = "mlg_norma_cache";
const NORMA_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const NORMA_MAX_ENTRIES = 500;

async function getNormaCache() {
  const result = await chrome.storage.local.get(NORMA_CACHE_KEY);
  return result[NORMA_CACHE_KEY] || {};
}

async function markNormaDone(textKey) {
  const cache = await getNormaCache();
  cache[textKey] = { timestamp: Date.now() };

  // Evict expired
  const now = Date.now();
  const valid = Object.entries(cache).filter(([, v]) => now - v.timestamp < NORMA_TTL_MS);
  if (valid.length > NORMA_MAX_ENTRIES) {
    valid.sort((a, b) => a[1].timestamp - b[1].timestamp);
    valid.splice(0, valid.length - NORMA_MAX_ENTRIES);
  }
  await chrome.storage.local.set({ [NORMA_CACHE_KEY]: Object.fromEntries(valid) });
}

async function checkNormaDone(textKeys) {
  const cache = await getNormaCache();
  const now = Date.now();
  const result = {};
  for (const key of textKeys) {
    const entry = cache[key];
    result[key] = !!(entry && now - entry.timestamp < NORMA_TTL_MS);
  }
  return result;
}

const VOCAB_STORAGE_KEY = "mlg_vocab";

async function loadVocab() {
  const result = await chrome.storage.local.get(VOCAB_STORAGE_KEY);
  return result[VOCAB_STORAGE_KEY]?.items || null;
}

async function saveVocab(items) {
  await chrome.storage.local.set({ [VOCAB_STORAGE_KEY]: { items } });
}

async function initVocabIfNeeded() {
  const existing = await loadVocab();
  if (existing) return existing;
  const url = chrome.runtime.getURL("vocab_data.json");
  const resp = await fetch(url);
  const data = await resp.json();
  const items = data.map((v) => ({ ...v, count: 0 }));
  await saveVocab(items);
  return items;
}

function matchVocabInText(text, vocabItems) {
  const lower = text.toLowerCase();
  const matched = [];
  for (const item of vocabItems) {
    const pattern = item.en.toLowerCase();
    const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (regex.test(lower)) {
      matched.push(item.en);
    }
  }
  return matched;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message || {};
  if (type === "mlg:getConfig") {
    loadConfig().then(sendResponse);
    return true;
  }
  if (type === "mlg:setConfig") {
    const current = loadConfig().then((cur) => {
      const next = mergeConfig({ ...cur, ...(payload || {}) });
      return chrome.storage.local.set({ [STORAGE_KEY]: next }).then(() => next);
    });
    current.then(sendResponse);
    return true;
  }
  if (type === "mlg:getCacheStats") {
    getCacheStats().then(sendResponse);
    return true;
  }
  if (type === "mlg:clearCache") {
    clearTranslationCache().then(() => sendResponse({ ok: true }));
    return true;
  }
  if (type === "mlg:normaDone") {
    markNormaDone(payload.textKey).then(() => {
      // Broadcast to all content scripts
      chrome.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          chrome.tabs.sendMessage(tab.id, { type: "mlg:normaDone", payload }).catch(() => {});
        });
      });
      sendResponse({ ok: true });
    });
    return true;
  }
  if (type === "mlg:normaCheck") {
    checkNormaDone(payload.textKeys || []).then(sendResponse);
    return true;
  }
  if (type === "mlg:openOutput") {
    chrome.runtime.sendMessage({ type: "mlg:openOutput", payload }).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
  if (type === "mlg:openExplanation") {
    (async () => {
      const request = { ...(payload || {}), requestedAt: Date.now() };
      let sidePanelOpen = Promise.resolve();
      if (sender.tab?.id && chrome.sidePanel?.open) {
        try {
          const maybePromise = chrome.sidePanel.open({ tabId: sender.tab.id });
          if (maybePromise?.catch) {
            sidePanelOpen = maybePromise.catch((error) => {
              console.warn("[mlg:bg] side panel open failed:", error.message);
            });
          }
        } catch (error) {
          console.warn("[mlg:bg] side panel open failed:", error.message);
        }
      }
      await chrome.storage.local.set({ [PENDING_EXPLANATION_KEY]: request });
      await sidePanelOpen;
      chrome.runtime.sendMessage({ type: "mlg:openExplanation", payload: request }).catch(() => {});
      return { ok: true };
    })()
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message || String(error) }));
    return true;
  }
  if (type === "mlg:getPendingExplanation") {
    (async () => {
      const result = await chrome.storage.local.get(PENDING_EXPLANATION_KEY);
      const request = result[PENDING_EXPLANATION_KEY] || null;
      await chrome.storage.local.remove(PENDING_EXPLANATION_KEY);
      return request;
    })().then(sendResponse);
    return true;
  }
  if (type === "mlg:clearPendingExplanation") {
    chrome.storage.local.remove(PENDING_EXPLANATION_KEY).then(() => sendResponse({ ok: true }));
    return true;
  }
  if (type === "mlg:explainSentence") {
    explainSentence(payload || {})
      .then((res) => sendResponse(res))
      .catch((error) => sendResponse({ error: error.message || String(error) }));
    return true;
  }
  if (type === "mlg:feedback") {
    (async () => {
      const result = await feedbackRequest(payload || {});
      // Match vocab in corrected text and update counts
      const vocabItems = await initVocabIfNeeded();
      const matchedKeys = matchVocabInText(result.corrected || "", vocabItems);
      if (matchedKeys.length > 0) {
        const keySet = new Set(matchedKeys.map((k) => k.toLowerCase()));
        vocabItems.forEach((item) => {
          if (keySet.has(item.en.toLowerCase())) {
            item.count = (item.count || 0) + 1;
          }
        });
        await saveVocab(vocabItems);
      }
      // Filter vocabSuggestions to only include items NOT already in the list
      function normalizeVocab(str) {
        return str.toLowerCase().replace(/\s*~\s*/g, "").replace(/\s+/g, " ").trim();
      }
      const existingKeys = new Set(vocabItems.map((v) => normalizeVocab(v.en)));
      const newSuggestions = (result.vocabSuggestions || []).filter(
        (s) => !existingKeys.has(normalizeVocab(s.en))
      );
      result.vocabSuggestions = newSuggestions;
      result.matchedVocab = matchedKeys;
      return result;
    })()
      .then((res) => sendResponse(res))
      .catch((error) => sendResponse({ error: error.message || String(error) }));
    return true;
  }
  if (type === "mlg:getVocab") {
    initVocabIfNeeded().then(sendResponse);
    return true;
  }
  if (type === "mlg:addVocab") {
    (async () => {
      const items = await initVocabIfNeeded();
      const exists = items.some((v) => v.en.toLowerCase() === payload.en.toLowerCase());
      if (!exists) {
        items.push({ en: payload.en, ja: payload.ja, type: payload.type || "phrase", count: 0 });
        await saveVocab(items);
      }
      return items;
    })().then(sendResponse);
    return true;
  }
  if (type === "mlg:updateVocab") {
    (async () => {
      const items = await initVocabIfNeeded();
      const item = items.find((v) => v.en.toLowerCase() === payload.en.toLowerCase());
      if (item && payload.fields) {
        Object.assign(item, payload.fields);
        await saveVocab(items);
      }
      return items;
    })().then(sendResponse);
    return true;
  }
  if (type === "mlg:removeVocab") {
    (async () => {
      const items = await initVocabIfNeeded();
      const filtered = items.filter((v) => v.en.toLowerCase() !== payload.en.toLowerCase());
      await saveVocab(filtered);
      return filtered;
    })().then(sendResponse);
    return true;
  }
  if (type === "mlg:analyzeVocab") {
    analyzeVocab(payload || {})
      .then((res) => sendResponse(res))
      .catch((error) => sendResponse({ error: error.message || String(error) }));
    return true;
  }
  if (type === "mlg:generateQuiz") {
    (async () => {
      const config = await loadConfig();
      const messages = [
        {
          role: "system",
          content: `You are an English conversation practice prompt generator.
Given a conversation situation, create a short prompt that makes the user THINK about what to say, not just translate.
Rules:
- Maximum 1 sentence, under 15 words
- Describe a situation with a feeling, constraint, or dilemma — NOT a direct instruction to say something
- The user should decide HOW to express themselves
- Good: "You want coffee but you're not sure what's good here."
- Good: "Your food is taking too long and you're getting impatient."
- Bad: "Order a latte and a croissant." (just translation)
- Bad: "Ask the waiter for the check." (just translation)
- Be creative and vary each time
Return JSON: { "prompt": "your prompt text here" }`,
        },
        {
          role: "user",
          content: payload.situation,
        },
      ];
      const schema = {
        type: "object",
        properties: { prompt: { type: "string" } },
        required: ["prompt"],
        additionalProperties: false,
      };
      const result = await callLLMChain(config.models, messages, config.apiKeys, schema);
      return { prompt: result.prompt };
    })()
      .then((res) => sendResponse(res))
      .catch((error) => sendResponse({ error: error.message || String(error) }));
    return true;
  }
  if (type === "mlg:tts") {
    (async () => {
      const config = await loadConfig();
      const apiKey = config.apiKeys["gpt"];
      if (!apiKey) throw new Error("No OpenAI API key configured");
      const response = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: payload.text,
          voice: payload.voice || "nova",
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`TTS failed (${response.status}): ${text.slice(0, 200)}`);
      }
      const buffer = await response.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return { dataUrl: `data:audio/mpeg;base64,${base64}` };
    })()
      .then((res) => sendResponse(res))
      .catch((error) => sendResponse({ error: error.message || String(error) }));
    return true;
  }
  if (type === "mlg:translate") {
    console.log("[mlg:bg] received mlg:translate", payload);
    translateBatch(payload || {})
      .then((res) => {
        console.log("[mlg:bg] translate success, blocks:", res.blocks?.length);
        sendResponse(res);
      })
      .catch((error) => {
        console.error("[mlg:bg] translate error:", error.message);
        sendResponse({ error: error.message || String(error) });
      });
    return true;
  }
  return false;
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(STORAGE_KEY).then((result) => {
    if (!result[STORAGE_KEY]) {
      chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_CONFIG });
    }
  });
});

// Open side panel on action icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
});
