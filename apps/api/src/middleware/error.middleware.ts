import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class PdfParseError extends AppError {
  constructor(message: string) {
    super(422, 'pdf_unparseable', message);
  }
}

export class OpenAiTimeoutError extends AppError {
  constructor() {
    super(504, 'ai_timeout', 'AI service timed out. Your analysis is preserved — try again.', true);
  }
}

export function errorMiddleware(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.code,
      message: err.message,
      retryable: err.retryable,
    });
    return;
  }
  console.error('[unhandled error]', err);
  res.status(500).json({ error: 'internal_error', message: 'An unexpected error occurred.' });
}
