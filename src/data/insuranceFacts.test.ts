import { detectProductType } from './insuranceFacts';

describe('detectProductType', () => {
  describe('saude', () => {
    it.each(['saúde', 'saude', 'plano de saúde', 'médico', 'medico', 'hospitalar'])(
      '"%s" → saude',
      (text) => expect(detectProductType(text)).toBe('saude'),
    );

    it('is case insensitive', () => {
      expect(detectProductType('SAUDE')).toBe('saude');
    });
  });

  describe('auto', () => {
    it.each(['auto', 'automóvel', 'carro', 'veículo', 'frota'])(
      '"%s" → auto',
      (text) => expect(detectProductType(text)).toBe('auto'),
    );
  });

  describe('vida', () => {
    it.each(['vida', 'seguro de vida', 'funeral'])(
      '"%s" → vida',
      (text) => expect(detectProductType(text)).toBe('vida'),
    );
  });

  describe('residencial', () => {
    it.each(['residencial', 'casa', 'imóvel', 'residência'])(
      '"%s" → residencial',
      (text) => expect(detectProductType(text)).toBe('residencial'),
    );
  });

  describe('empresarial', () => {
    it.each(['empresarial', 'empresa', 'negócio', 'cnpj', 'comercial'])(
      '"%s" → empresarial',
      (text) => expect(detectProductType(text)).toBe('empresarial'),
    );
  });

  describe('null', () => {
    it('returns null for general text', () => {
      expect(detectProductType('quero informações gerais')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(detectProductType('')).toBeNull();
    });
  });

  describe('priority: empresarial before auto for "empresa"', () => {
    it('"seguro empresarial pra minha empresa" → empresarial', () => {
      expect(detectProductType('seguro empresarial pra minha empresa')).toBe('empresarial');
    });
  });
});
