// Mock all dependencies that webhook.ts imports transitively
vi.mock('../config', () => ({
  config: {
    openai: { apiKey: 'sk-test', model: 'gpt-4o-mini', temperature: 0.85, maxTokens: 500 },
    zapi: { instanceId: 'test', instanceToken: 'test', clientToken: 'test' },
    admin: { phoneNumbers: ['5511999999999'] },
    app: { humanDelayMinMs: 1500, humanDelayMaxMs: 3000, historyLimit: 20 },
  },
}));

vi.mock('../lib/prisma', () => ({ prisma: {} }));

import { expandMenuNumber } from './webhook';

describe('expandMenuNumber', () => {
  it('1 → "Quero tirar dúvidas sobre seguros"', () => {
    expect(expandMenuNumber('1')).toBe('Quero tirar dúvidas sobre seguros');
  });

  it('2 → "Quero fazer uma cotação"', () => {
    expect(expandMenuNumber('2')).toBe('Quero fazer uma cotação');
  });

  it('3 → "Quero falar com um atendente"', () => {
    expect(expandMenuNumber('3')).toBe('Quero falar com um atendente');
  });

  it('4 → null (not a menu number)', () => {
    expect(expandMenuNumber('4')).toBeNull();
  });

  it('arbitrary text → null', () => {
    expect(expandMenuNumber('hello world')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(expandMenuNumber('  1  ')).toBe('Quero tirar dúvidas sobre seguros');
  });
});
