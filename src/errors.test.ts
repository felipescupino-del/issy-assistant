import { AppError, OpenAIError, ZApiError, DatabaseError } from './errors';

describe('AppError', () => {
  it('has correct properties', () => {
    const err = new AppError('test message', 'TEST_CODE', 400);
    expect(err.message).toBe('test message');
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(400);
    expect(err.name).toBe('AppError');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('OpenAIError', () => {
  it('wraps original error with 502 status', () => {
    const original = new Error('API timeout');
    const err = new OpenAIError('Failed to call OpenAI', original);
    expect(err.message).toBe('Failed to call OpenAI');
    expect(err.code).toBe('OPENAI_ERROR');
    expect(err.statusCode).toBe(502);
    expect(err.originalError).toBe(original);
    expect(err.name).toBe('OpenAIError');
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('ZApiError', () => {
  it('wraps original error with 502 status', () => {
    const original = new Error('Connection refused');
    const err = new ZApiError('Failed to send message', original);
    expect(err.message).toBe('Failed to send message');
    expect(err.code).toBe('ZAPI_ERROR');
    expect(err.statusCode).toBe(502);
    expect(err.originalError).toBe(original);
    expect(err.name).toBe('ZApiError');
    expect(err).toBeInstanceOf(AppError);
  });
});

describe('DatabaseError', () => {
  it('wraps original error with 500 status', () => {
    const original = new Error('Connection lost');
    const err = new DatabaseError('DB query failed', original);
    expect(err.message).toBe('DB query failed');
    expect(err.code).toBe('DATABASE_ERROR');
    expect(err.statusCode).toBe(500);
    expect(err.originalError).toBe(original);
    expect(err.name).toBe('DatabaseError');
    expect(err).toBeInstanceOf(AppError);
  });
});
