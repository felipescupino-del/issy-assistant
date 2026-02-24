import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${key}`);
  return value;
}

function optional(key: string, defaultValue = ''): string {
  return process.env[key] ?? defaultValue;
}

export const config = {
  port: parseInt(optional('PORT', '3000'), 10),

  database: {
    url: required('DATABASE_URL'),
  },

  zapi: {
    instanceId:    required('ZAPI_INSTANCE_ID'),
    instanceToken: required('ZAPI_INSTANCE_TOKEN'),
    clientToken:   required('ZAPI_CLIENT_TOKEN'),
  },

  openai: {
    apiKey:      required('OPENAI_API_KEY'),
    model:       optional('OPENAI_MODEL', 'gpt-4o-mini'),
    temperature: parseFloat(optional('OPENAI_TEMPERATURE', '0.85')),
    maxTokens:   parseInt(optional('OPENAI_MAX_TOKENS', '500'), 10),
  },

  app: {
    humanDelayMinMs: parseInt(optional('HUMAN_DELAY_MIN_MS', '1500'), 10),
    humanDelayMaxMs: parseInt(optional('HUMAN_DELAY_MAX_MS', '3000'), 10),
    historyLimit:    parseInt(optional('HISTORY_LIMIT', '20'), 10),
  },

  admin: {
    phoneNumbers: optional('ADMIN_PHONE_NUMBERS', '').split(',').filter(Boolean),
  },
};
