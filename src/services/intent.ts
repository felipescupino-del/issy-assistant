// src/services/intent.ts
// Keyword-based intent classifier with menu number support

export type Intent = 'greeting' | 'qa' | 'quote' | 'handoff' | 'unknown';

// Keyword sets — order matters (handoff checked first to avoid 'seguro' matching as quote)
const HANDOFF_KEYWORDS = [
  '/humano', 'falar com humano', 'falar com uma pessoa', 'atendente',
  'pessoa real', 'quero falar com', 'preciso de um humano',
  'falar com alguem', 'falar com alguém', 'especialista', 'consultor',
  'me transfere', 'transferir',
];
const QUOTE_KEYWORDS = [
  'cotar', 'cotação', 'cotacao', 'quero cotar', 'fazer uma cotação',
  'preciso de uma cotação', 'preciso de cotacao', 'cotação de',
  'cotar um', 'cotar uma',
];
const GREETING_KEYWORDS = [
  'oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite',
  'hey', 'hello', 'tudo bem', 'tudo bom', 'e aí', 'e ai',
  'opa', 'fala', 'bão',
];

/**
 * Classify the broker's message into one of 5 intent buckets.
 * Menu numbers (1, 2, 3) are only matched when sent as a standalone message
 * to avoid false matches like "tenho 3 vidas".
 */
export function classifyIntent(text: string): Intent {
  const lower = text.toLowerCase().trim();

  // Menu number shortcuts — only match if the message is JUST the number
  if (lower === '1') return 'qa';
  if (lower === '2') return 'quote';
  if (lower === '3') return 'handoff';

  if (HANDOFF_KEYWORDS.some((k) => lower.includes(k))) return 'handoff';
  if (QUOTE_KEYWORDS.some((k) => lower.includes(k))) return 'quote';
  if (GREETING_KEYWORDS.some((k) => lower.startsWith(k))) return 'greeting';
  if (lower.length > 3) return 'qa';  // any substantive text → Q&A attempt
  return 'unknown';
}
