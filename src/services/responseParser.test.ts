import { parseResponseMarkers, formatForWhatsApp } from './responseParser';

describe('parseResponseMarkers', () => {
  it('detects [TRANSFER] marker', () => {
    const result = parseResponseMarkers('Vou transferir agora [TRANSFER]');
    expect(result.shouldTransfer).toBe(true);
    expect(result.cleanText).not.toContain('[TRANSFER]');
  });

  it('detects multiple [TRANSFER] markers', () => {
    const result = parseResponseMarkers('[TRANSFER] texto [TRANSFER]');
    expect(result.shouldTransfer).toBe(true);
  });

  it('detects [QUOTATION_COMPLETE]{json}', () => {
    const json = JSON.stringify({ plan: 'saude', price: 500 });
    const result = parseResponseMarkers(`Aqui está [QUOTATION_COMPLETE]${json}`);
    expect(result.quotationData).toEqual({ plan: 'saude', price: 500 });
    expect(result.cleanText).not.toContain('[QUOTATION_COMPLETE]');
  });

  it('handles malformed JSON gracefully', () => {
    const result = parseResponseMarkers('Texto [QUOTATION_COMPLETE]{invalid json}');
    expect(result.quotationData).toBeNull();
  });

  it('returns clean text without markers', () => {
    const result = parseResponseMarkers('Texto simples sem marcadores');
    expect(result.shouldTransfer).toBe(false);
    expect(result.quotationData).toBeNull();
    expect(result.cleanText).toBe('Texto simples sem marcadores');
  });
});

describe('formatForWhatsApp', () => {
  it('converts **bold** to *bold*', () => {
    expect(formatForWhatsApp('**negrito**')).toBe('*negrito*');
  });

  it('converts __bold__ to *bold*', () => {
    expect(formatForWhatsApp('__negrito__')).toBe('*negrito*');
  });

  it('converts markdown headers to bold', () => {
    expect(formatForWhatsApp('## Título')).toBe('*Título*');
    expect(formatForWhatsApp('### Sub Título')).toBe('*Sub Título*');
  });

  it('converts dash bullets to bullet char', () => {
    expect(formatForWhatsApp('- item 1\n- item 2')).toBe('• item 1\n• item 2');
  });

  it('removes citation artifacts 【...】', () => {
    expect(formatForWhatsApp('Texto【citation:1】aqui')).toBe('Textoaqui');
  });

  it('collapses excessive newlines', () => {
    expect(formatForWhatsApp('a\n\n\n\nb')).toBe('a\n\nb');
  });

  it('trims whitespace', () => {
    expect(formatForWhatsApp('  texto  ')).toBe('texto');
  });
});
