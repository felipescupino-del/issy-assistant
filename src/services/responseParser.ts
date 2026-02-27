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

  return { cleanText, shouldTransfer, quotationData };
}
