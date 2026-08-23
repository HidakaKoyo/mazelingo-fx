/**
 * LLM prompt builders for the background service worker's feature handlers:
 * feedback (English writing tutor), vocab analysis, sentence explanation, quiz
 * generation, and translation batching. Kept as pure functions so the prompt
 * text is unit-testable without chrome.* mocks.
 */
import type { ChatMessage } from "./llm";
import type { FeedbackPayload } from "./messages";

function buildFeedbackModeInstruction(
  mode: string | undefined,
  sourceText: string | undefined,
): string {
  if (mode === "quiz") {
    return `The user is responding to a conversation prompt: "${sourceText}". Evaluate how well they responded to this scenario.`;
  }
  if (sourceText === undefined || sourceText === "") {
    return "The user is practicing free-form English writing. There is no original text to reference.";
  }
  if (mode === "rephrase") {
    return "The user is attempting to rephrase or summarize the original text in English.";
  }
  return "The user is writing their opinion or analysis about the original text in English.";
}

export function buildFeedbackMessages(
  payload: Pick<FeedbackPayload, "sourceText" | "userText" | "mode">,
): ChatMessage[] {
  const { sourceText, userText, mode } = payload;
  const modeInstruction = buildFeedbackModeInstruction(mode, sourceText);

  return [
    {
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
      role: "system",
    },
    {
      content: JSON.stringify(
        sourceText
          ? { originalText: sourceText, userWriting: userText }
          : { userWriting: userText },
      ),
      role: "user",
    },
  ];
}

function buildVocabAnalysisSystemPrompt(): string {
  return `You are a professional English linguistics expert and language teacher. Analyze the given English word or phrase for a Japanese learner.

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
- relatedWords.derivatives: 1-3 derived forms or related expressions (empty array if not applicable)`;
}

export function buildVocabAnalysisMessages(word: string): ChatMessage[] {
  return [
    {
      content: buildVocabAnalysisSystemPrompt(),
      role: "system",
    },
    {
      content: word,
      role: "user",
    },
  ];
}

export function buildExplainMessages(payload: {
  readonly text: string;
  readonly japaneseText?: string;
  readonly sourceLang?: string;
  readonly pageUrl?: string;
}): ChatMessage[] {
  return [
    {
      content: `You are an expert English grammar and reading tutor for Japanese learners.

Analyze the given English sentence in Japanese. The goal is to help the learner read it carefully, understand the grammar, and see how meaning is built step by step.

Rules:
- Explain in Japanese.
- Keep explanations specific to the sentence. Do not give generic grammar lectures.
- Break the sentence into meaningful chunks, not single words unless needed.
- Explain grammar roles, structure, modifiers, clauses, tense/aspect, articles/prepositions, and nuance when relevant.
- If the user-provided Japanese translation is useful, compare against it briefly.
- Avoid markdown. Return only JSON that matches the schema.`,
      role: "system",
    },
    {
      content: JSON.stringify({
        sentence: payload.text,
        japaneseTranslation:
          payload.japaneseText === undefined || payload.japaneseText === ""
            ? undefined
            : payload.japaneseText,
        sourceLang:
          payload.sourceLang === undefined || payload.sourceLang === ""
            ? undefined
            : payload.sourceLang,
        pageUrl:
          payload.pageUrl === undefined || payload.pageUrl === "" ? undefined : payload.pageUrl,
      }),
      role: "user",
    },
  ];
}

export function buildQuizMessages(situation: string): ChatMessage[] {
  return [
    {
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
      role: "system",
    },
    {
      content: situation,
      role: "user",
    },
  ];
}
