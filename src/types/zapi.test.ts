import { parseZApiPayload, ZApiWebhookPayload } from './zapi';

function makePayload(overrides: Partial<ZApiWebhookPayload> = {}): ZApiWebhookPayload {
  return {
    instanceId: 'inst-123',
    messageId: 'msg-456',
    phone: '5511999999999',
    fromMe: false,
    senderName: 'João Silva',
    chatName: 'João Silva',
    momment: Date.now(),
    status: 'RECEIVED',
    isGroup: false,
    type: 'ReceivedCallback',
    ...overrides,
  };
}

describe('parseZApiPayload', () => {
  it('returns null when fromMe is true', () => {
    expect(parseZApiPayload(makePayload({ fromMe: true }))).toBeNull();
  });

  it('returns null when isGroup is true', () => {
    expect(parseZApiPayload(makePayload({ isGroup: true }))).toBeNull();
  });

  it('extracts phone and text from text message', () => {
    const result = parseZApiPayload(makePayload({ text: { message: 'Olá!' } }));
    expect(result).not.toBeNull();
    expect(result!.phone).toBe('5511999999999');
    expect(result!.text).toBe('Olá!');
  });

  it('extracts caption as text from image message', () => {
    const result = parseZApiPayload(makePayload({
      image: { imageUrl: 'https://example.com/img.jpg', caption: 'Minha foto' },
    }));
    expect(result!.text).toBe('Minha foto');
    expect(result!.imageUrl).toBe('https://example.com/img.jpg');
  });

  it('returns null text when no text/image/audio', () => {
    const result = parseZApiPayload(makePayload());
    expect(result!.text).toBeNull();
  });

  it('extracts audioUrl from audio message', () => {
    const result = parseZApiPayload(makePayload({
      audio: { audioUrl: 'https://example.com/audio.ogg', ptt: true },
    }));
    expect(result!.audioUrl).toBe('https://example.com/audio.ogg');
  });

  it('uses senderName when available (even empty string — ?? operator)', () => {
    const result = parseZApiPayload(makePayload({ senderName: 'João' }));
    expect(result!.senderName).toBe('João');
  });

  it('falls back to chatName when senderName is undefined', () => {
    // The ?? operator only falls back on null/undefined, not empty string
    const payload = makePayload();
    (payload as any).senderName = undefined;
    const result = parseZApiPayload(payload);
    expect(result!.senderName).toBe(payload.chatName);
  });

  it('falls back to "Desconhecido" when both are nullish', () => {
    const payload = makePayload();
    (payload as any).senderName = undefined;
    (payload as any).chatName = undefined;
    const result = parseZApiPayload(payload);
    expect(result!.senderName).toBe('Desconhecido');
  });

  it('converts momment to Date timestamp', () => {
    const ts = 1700000000000;
    const result = parseZApiPayload(makePayload({ momment: ts }));
    expect(result!.timestamp).toEqual(new Date(ts));
  });
});
