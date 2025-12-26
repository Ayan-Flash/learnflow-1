import type { DepthConfig } from "../ai/depthEngine";

export const countTokens = (text: string): number => {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const parts = trimmed.match(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu);
  return parts ? parts.length : Math.ceil(trimmed.length / 4);
};

export const countWords = (text: string): number => {
  const matches = text.trim().match(/[\p{L}\p{N}]+/gu);
  return matches ? matches.length : 0;
};

export const depthAlignmentScore = (depth: DepthConfig, outputText: string): number => {
  const words = countWords(outputText);
  const { min, max } = depth.target_word_count;
  if (words === 0) return 0;
  if (words >= min && words <= max) return 1;

  const target = (min + max) / 2;
  const dist = Math.abs(words - target);
  const tolerance = (max - min) / 2;

  // Score decays linearly until 2x tolerance.
  const score = 1 - Math.min(1, dist / (tolerance * 2));
  return Number(score.toFixed(3));
};

export const clarityScore = (outputText: string): number => {
  const text = outputText.trim();
  if (!text) return 0;

  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const wordCount = countWords(text);
  const sentenceCount = Math.max(1, sentences.length);
  const avgWordsPerSentence = wordCount / sentenceCount;

  const hasBullets = /(^|\n)\s*[-*]\s+/m.test(text);
  const hasShortQuestions = (text.match(/\?/g) ?? []).length >= 2;

  let score = 1.0;

  if (avgWordsPerSentence > 28) score -= 0.25;
  if (avgWordsPerSentence > 40) score -= 0.25;
  if (!hasBullets) score -= 0.1;
  if (!hasShortQuestions) score -= 0.1;

  // Penalize walls of text
  const longestParagraph = Math.max(
    ...text
      .split(/\n\n+/)
      .map((p) => countWords(p))
      .filter((n) => Number.isFinite(n)),
    0
  );
  if (longestParagraph > 220) score -= 0.2;

  score = Math.max(0, Math.min(1, score));
  return Number(score.toFixed(3));
};
