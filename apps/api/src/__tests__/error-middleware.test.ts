import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// These imports will fail until apps/api/src/middleware/error.middleware.ts is created in Plan 03.
import {
  errorMiddleware,
  AppError,
  PdfParseError,
  OpenAiTimeoutError,
} from '../middleware/error.middleware';

function makeMockRes() {
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const mockReq = {} as Request;
const mockNext = vi.fn() as NextFunction;

describe('errorMiddleware', () => {
  it('returns 422 with pdf_unparseable code for PdfParseError', () => {
    const res = makeMockRes();
    const err = new PdfParseError('Could not parse PDF');
    errorMiddleware(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'pdf_unparseable' }),
    );
  });

  it('returns 504 with retryable: true for OpenAiTimeoutError', () => {
    const res = makeMockRes();
    const err = new OpenAiTimeoutError();
    errorMiddleware(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ retryable: true }),
    );
  });

  it('returns 500 with internal_error for unknown errors', () => {
    const res = makeMockRes();
    const err = new Error('Something unexpected');
    errorMiddleware(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'internal_error' }),
    );
  });

  it('returns the statusCode from AppError subclasses', () => {
    const res = makeMockRes();
    const err = new AppError(409, 'conflict', 'Resource already exists');
    errorMiddleware(err, mockReq, res, mockNext);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});
