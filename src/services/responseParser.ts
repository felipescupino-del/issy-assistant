// Parse AI response markers ([TRANSFER], [QUOTATION_COMPLETE])
// Markers are instructions from the AI to the system, not shown to the broker.

export interface ParsedResponse {
  cleanText: string;
  shouldTransfer: boolean;
  quotationData: Record<string, unknown> | null;
}

export function parseResponseMarkers(text: string): ParsedResponse {
  let shouldTransfer = false;
  let quotationData: Record<string, unknown> | null = null;
  let cleanText = text;

  // Detect [TRANSFER]
  if (cleanText.includes('[TRANSFER]')) {
    shouldTransfer = true;
    cleanText = cleanText.replace(/\[TRANSFER\]/g, '').trim();
  }

  // Detect [QUOTATION_COMPLETE]{...}
  const quoteMatch = cleanText.match(/\[QUOTATION_COMPLETE\](\{[\s\S]*\})/);
  if (quoteMatch) {
    try {
      quotationData = JSON.parse(quoteMatch[1]);
    } catch { /* ignore malformed JSON */ }
    cleanText = cleanText.replace(/\[QUOTATION_COMPLETE\]\{[\s\S]*\}/, '').trim();
  }

  cleanText = formatForWhatsApp(cleanText);

  return { cleanText, shouldTransfer, quotationData };
}

/**
 * Convert markdown formatting to WhatsApp-compatible formatting.
 * Applied after marker extraction so markers aren't affected.
 */
export function formatForWhatsApp(text: string): string {
  return text
    // Remove OpenAI citation artifacts 【...】
    .replace(/【[^】]*】/g, '')
    // Headers (### Header) → bold (*Header*)
    .replace(/^#{1,6}\s+(.+)$/gm, '*$1*')
    // Bold **text** or __text__ → *text* (WhatsApp bold)
    .replace(/\*\*(.+?)\*\*/g, '*$1*')
    .replace(/__(.+?)__/g, '*$1*')
    // Bullet points: - item → • item
    .replace(/^- /gm, '• ')
    // Clean up excessive blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
