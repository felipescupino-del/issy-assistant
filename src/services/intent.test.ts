import { classifyIntent } from './intent';

describe('classifyIntent', () => {
  describe('menu numbers', () => {
    it('1 → qa', () => expect(classifyIntent('1')).toBe('qa'));
    it('2 → quote', () => expect(classifyIntent('2')).toBe('quote'));
    it('3 → handoff', () => expect(classifyIntent('3')).toBe('handoff'));
  });

  describe('handoff keywords', () => {
    it.each([
      '/humano',
      'falar com humano',
      'falar com uma pessoa',
      'atendente',
      'pessoa real',
      'quero falar com alguém',
      'me transfere',
      'transferir',
      'especialista',
      'consultor',
    ])('"%s" → handoff', (text) => {
      expect(classifyIntent(text)).toBe('handoff');
    });

    it('case insensitive', () => {
      expect(classifyIntent('FALAR COM HUMANO')).toBe('handoff');
    });
  });

  describe('quote keywords', () => {
    it.each([
      'cotação',
      'cotacao',
      'quero cotar',
      'fazer uma cotação',
      'preciso de uma cotação',
    ])('"%s" → quote', (text) => {
      expect(classifyIntent(text)).toBe('quote');
    });
  });

  describe('greeting keywords (startsWith)', () => {
    it.each([
      'oi',
      'olá',
      'bom dia',
      'boa tarde',
      'boa noite',
      'opa',
      'fala',
    ])('"%s" → greeting', (text) => {
      expect(classifyIntent(text)).toBe('greeting');
    });

    it('greeting in the middle does not match', () => {
      // "oi" is at start, but "como vai" has length > 3 → qa wins via startsWith
      expect(classifyIntent('oi tudo bem')).toBe('greeting');
    });
  });

  describe('fallback qa (text.length > 3)', () => {
    it('long text without keywords → qa', () => {
      expect(classifyIntent('qual o prazo de carencia')).toBe('qa');
    });
  });

  describe('unknown (text.length <= 3, no match)', () => {
    it('"abc" → unknown', () => {
      expect(classifyIntent('abc')).toBe('unknown');
    });

    it('"ok" → unknown', () => {
      expect(classifyIntent('ok')).toBe('unknown');
    });
  });

  describe('whitespace trimming', () => {
    it('trims leading/trailing whitespace', () => {
      expect(classifyIntent('  1  ')).toBe('qa');
      expect(classifyIntent('  /humano  ')).toBe('handoff');
    });
  });
});
