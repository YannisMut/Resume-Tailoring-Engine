import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// These imports will fail until apps/api/src/middleware/error.middleware.ts is created in Plan 03.
import {
  errorMiddleware,
  AppError,
  PdfParseError,
  OpenAiTimeoutError,
  PdfNotPdfError,
  PdfTooLargeError,
  PdfScannedError,
  PdfEncryptedError,
  PdfCorruptError,
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

describe('PDF-specific error classes', () => {
  it('PdfNotPdfError has statusCode 415 and code pdf_not_pdf', () => {
    const err = new PdfNotPdfError('File is not a PDF');
    expect(err.statusCode).toBe(415);
    expect(err.code).toBe('pdf_not_pdf');
    expect(err.message).toBe('File is not a PDF');
  });

  it('PdfTooLargeError has statusCode 413 and code pdf_too_large', () => {
    const err = new PdfTooLargeError('File exceeds 10MB limit');
    expect(err.statusCode).toBe(413);
    expect(err.code).toBe('pdf_too_large');
    expect(err.message).toBe('File exceeds 10MB limit');
  });

  it('PdfScannedError has statusCode 422 and code pdf_scanned', () => {
    const err = new PdfScannedError('PDF appears to be scanned image only');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('pdf_scanned');
    expect(err.message).toBe('PDF appears to be scanned image only');
  });

  it('PdfEncryptedError has statusCode 422 and code pdf_encrypted', () => {
    const err = new PdfEncryptedError('PDF is password-protected');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('pdf_encrypted');
    expect(err.message).toBe('PDF is password-protected');
  });

  it('PdfCorruptError has statusCode 422 and code pdf_corrupt', () => {
    const err = new PdfCorruptError('PDF is corrupt or unreadable');
    expect(err.statusCode).toBe(422);
    expect(err.code).toBe('pdf_corrupt');
    expect(err.message).toBe('PDF is corrupt or unreadable');
  });
});
