// Custom error types for structured error handling

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class OpenAIError extends AppError {
  public readonly originalError: unknown;

  constructor(message: string, originalError: unknown) {
    super(message, 'OPENAI_ERROR', 502);
    this.name = 'OpenAIError';
    this.originalError = originalError;
  }
}

export class ZApiError extends AppError {
  public readonly originalError: unknown;

  constructor(message: string, originalError: unknown) {
    super(message, 'ZAPI_ERROR', 502);
    this.name = 'ZApiError';
    this.originalError = originalError;
  }
}

export class DatabaseError extends AppError {
  public readonly originalError: unknown;

  constructor(message: string, originalError: unknown) {
    super(message, 'DATABASE_ERROR', 500);
    this.name = 'DatabaseError';
    this.originalError = originalError;
  }
}
