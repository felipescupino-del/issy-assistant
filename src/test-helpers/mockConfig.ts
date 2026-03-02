// Test-only mock values for config module.
// Import this AFTER vi.mock('../config') in your test file.

export const mockConfig = {
  port: 3000,
  database: { url: 'postgresql://test:test@localhost:5432/test' },
  zapi: {
    instanceId: 'test-instance',
    instanceToken: 'test-token',
    clientToken: 'test-client-token',
  },
  openai: {
    apiKey: 'sk-test-key',
    model: 'gpt-4o-mini',
    temperature: 0.85,
    maxTokens: 500,
  },
  app: {
    humanDelayMinMs: 1500,
    humanDelayMaxMs: 3000,
    historyLimit: 20,
  },
  admin: {
    phoneNumbers: ['5511999999999', '5511888888888'],
  },
};
