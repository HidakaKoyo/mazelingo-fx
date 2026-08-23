/**
 * JSON-schema objects used for structured LLM output. These define the shape
 * the LLM must return; the builders/parsers in `llm.ts` reference them.
 */
export const FEEDBACK_SCHEMA = {
  additionalProperties: false,
  properties: {
    alternativeExamples: {
      items: {
        additionalProperties: false,
        properties: {
          angle: { type: "string" },
          en: { type: "string" },
          ja: { type: "string" },
        },
        required: ["en", "ja", "angle"],
        type: "object",
      },
      type: "array",
    },
    corrected: { type: "string" },
    feedback: {
      items: {
        additionalProperties: false,
        properties: {
          corrected: { type: "string" },
          explanation: { type: "string" },
          original: { type: "string" },
        },
        required: ["original", "corrected", "explanation"],
        type: "object",
      },
      type: "array",
    },
    overall: { type: "string" },
    vocabSuggestions: {
      items: {
        additionalProperties: false,
        properties: {
          en: { type: "string" },
          ja: { type: "string" },
        },
        required: ["en", "ja"],
        type: "object",
      },
      type: "array",
    },
  },
  required: ["corrected", "feedback", "overall", "alternativeExamples", "vocabSuggestions"],
  type: "object",
} as const;

export const VOCAB_ANALYSIS_SCHEMA = {
  additionalProperties: false,
  properties: {
    collocations: {
      items: {
        additionalProperties: false,
        properties: {
          en: { type: "string" },
          ja: { type: "string" },
        },
        required: ["en", "ja"],
        type: "object",
      },
      type: "array",
    },
    difficulty: { type: "string" },
    etymology: { type: "string" },
    examples: {
      items: {
        additionalProperties: false,
        properties: {
          en: { type: "string" },
          ja: { type: "string" },
        },
        required: ["en", "ja"],
        type: "object",
      },
      type: "array",
    },
    frequency: { type: "string" },
    meaning: {
      additionalProperties: false,
      properties: {
        coreImage: { type: "string" },
        definition: { type: "string" },
        nativeFeel: { type: "string" },
        usageScene: { type: "string" },
      },
      required: ["definition", "coreImage", "nativeFeel", "usageScene"],
      type: "object",
    },
    pronunciation: {
      additionalProperties: false,
      properties: {
        googleTranslateUrl: { type: "string" },
        ipa: { type: "string" },
      },
      required: ["ipa", "googleTranslateUrl"],
      type: "object",
    },
    relatedWords: {
      additionalProperties: false,
      properties: {
        antonyms: { items: { type: "string" }, type: "array" },
        derivatives: { items: { type: "string" }, type: "array" },
        synonyms: { items: { type: "string" }, type: "array" },
      },
      required: ["synonyms", "antonyms", "derivatives"],
      type: "object",
    },
  },
  required: [
    "meaning",
    "frequency",
    "difficulty",
    "etymology",
    "pronunciation",
    "examples",
    "collocations",
    "relatedWords",
  ],
  type: "object",
} as const;

export const SENTENCE_EXPLANATION_SCHEMA = {
  additionalProperties: false,
  properties: {
    chunks: {
      items: {
        additionalProperties: false,
        properties: {
          explanation: { type: "string" },
          role: { type: "string" },
          text: { type: "string" },
        },
        required: ["text", "role", "explanation"],
        type: "object",
      },
      type: "array",
    },
    grammarPoints: {
      items: {
        additionalProperties: false,
        properties: {
          explanation: { type: "string" },
          title: { type: "string" },
        },
        required: ["title", "explanation"],
        type: "object",
      },
      type: "array",
    },
    headline: { type: "string" },
    overview: { type: "string" },
    readingSteps: {
      items: { type: "string" },
      type: "array",
    },
    translation: { type: "string" },
    vocabulary: {
      items: {
        additionalProperties: false,
        properties: {
          meaning: { type: "string" },
          nuance: { type: "string" },
          term: { type: "string" },
        },
        required: ["term", "meaning", "nuance"],
        type: "object",
      },
      type: "array",
    },
  },
  required: [
    "headline",
    "translation",
    "overview",
    "chunks",
    "grammarPoints",
    "vocabulary",
    "readingSteps",
  ],
  type: "object",
} as const;

export const QUIZ_SCHEMA = {
  additionalProperties: false,
  properties: { prompt: { type: "string" } },
  required: ["prompt"],
  type: "object",
} as const;
