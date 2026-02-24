// src/services/intent.ts
// Keyword-based intent classifier — CORE-03
// Interface: single function + type. Internals are swappable to GPT in Phase 5.

export type Intent = 'greeting' | 'qa' | 'quote' | 'handoff' | 'unknown';

// Keyword sets — order matters (handoff checked first to avoid 'seguro' matching as quote)
const HANDOFF_KEYWORDS = [
  '/humano', 'falar com humano', 'falar com uma pessoa', 'atendente',
  'pessoa real', 'quero falar com', 'preciso de um humano',
];
const QUOTE_KEYWORDS = [
  'cotar', 'cotação', 'cotacao', 'quero cotar', 'fazer uma cotação',
  'preciso de uma cotação',
];
const GREETING_KEYWORDS = [
  'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite',
  'hey', 'hello', 'tudo bem', 'tudo bom', 'e aí',
];

/**
 * Classify the broker's message into one of 5 intent buckets.
 * Returns 'unknown' only for very short/empty strings (<=3 chars).
 * Any non-trivial text that doesn't match specific keywords is treated as 'qa'.
 * NOTE: Do NOT expose the raw intent label in system prompts (leaks routing internals — see RESEARCH.md Pitfall 6).
 */
export function classifyIntent(text: string): Intent {
  const lower = text.toLowerCase().trim();
  if (HANDOFF_KEYWORDS.some((k) => lower.includes(k))) return 'handoff';
  if (QUOTE_KEYWORDS.some((k) => lower.includes(k))) return 'quote';
  if (GREETING_KEYWORDS.some((k) => lower.startsWith(k))) return 'greeting';
  if (lower.length > 3) return 'qa';  // any substantive text → Q&A attempt
  return 'unknown';
}
