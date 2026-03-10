import { describe, it, expect, vi } from 'vitest';
import type { Request, Response, NextFunction, RequestHandler } from 'express';

// These imports will fail until upload.middleware.ts is created (RED state).
import { uploadMiddleware } from '../middleware/upload.middleware.js';

// uploadMiddleware is [wrapMulter, validateMagicBytes]
// We test validateMagicBytes directly and wrapMulter structure.

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

function makeMockRes(): Response {
  return {} as Response;
}

// Build a fake req.file with given buffer and mimetype
function makeReqWithFile(buffer: Buffer, mimetype = 'application/pdf'): Request {
  return {
    file: {
      buffer,
      mimetype,
      fieldname: 'resume',
      originalname: 'resume.pdf',
      encoding: '7bit',
      size: buffer.length,
    },
  } as unknown as Request;
}

function makeReqWithNoFile(): Request {
  return {} as Request;
}

// Valid PDF magic bytes
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const validPdfBuffer = Buffer.concat([PDF_MAGIC, Buffer.from(' fake content')]);
const spoofedBuffer = Buffer.from('NOT_A_PDF_BUFFER_CONTENT'); // wrong magic bytes

// The second handler in uploadMiddleware is validateMagicBytes
// Use a typed variable to avoid noUncheckedIndexedAccess issues
const [wrapMulterHandler, validateMagicBytesHandler] = uploadMiddleware as [
  RequestHandler,
  RequestHandler,
];

describe('validateMagicBytes (second handler in uploadMiddleware)', () => {
  it('calls next() with no error when req.file exists and has valid PDF magic bytes', () => {
    const req = makeReqWithFile(validPdfBuffer);
    const res = makeMockRes();
    const next = makeNext();

    validateMagicBytesHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith(); // no args = success
  });

  it('calls next(PdfNotPdfError) with statusCode 415 when magic bytes are wrong (spoofed MIME)', () => {
    // MIME is application/pdf but buffer starts with wrong bytes
    const req = makeReqWithFile(spoofedBuffer, 'application/pdf');
    const res = makeMockRes();
    const next = makeNext();

    validateMagicBytesHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      statusCode: number;
      code: string;
    };
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(415);
    expect(error.code).toBe('pdf_not_pdf');
  });

  it('calls next(PdfNotPdfError) with statusCode 415 when no file is attached', () => {
    const req = makeReqWithNoFile();
    const res = makeMockRes();
    const next = makeNext();

    validateMagicBytesHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      statusCode: number;
      code: string;
      message: string;
    };
    expect(error).toBeDefined();
    expect(error.statusCode).toBe(415);
    expect(error.code).toBe('pdf_not_pdf');
    expect(error.message).toMatch(/no file|not pdf/i);
  });
});

describe('wrapMulter (first handler in uploadMiddleware)', () => {
  it('uploadMiddleware exports exactly 2 handlers', () => {
    expect(Array.isArray(uploadMiddleware)).toBe(true);
    expect(uploadMiddleware).toHaveLength(2);
    expect(typeof wrapMulterHandler).toBe('function');
    expect(typeof validateMagicBytesHandler).toBe('function');
  });

  it('wrapMulter accepts (req, res, next) — length is 3', () => {
    expect(wrapMulterHandler.length).toBe(3);
  });
});

describe('integration: wrong MIME type (image/png) with correct magic bytes — multer fileFilter rejects', () => {
  it('calls next(PdfNotPdfError) when req.file is undefined because multer rejected MIME', () => {
    // When fileFilter rejects (wrong MIME), multer does NOT populate req.file.
    // validateMagicBytes must catch this and throw PdfNotPdfError.
    const req = makeReqWithNoFile(); // simulates multer having rejected the file
    const res = makeMockRes();
    const next = makeNext();

    validateMagicBytesHandler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    const error = (next as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as {
      statusCode: number;
      code: string;
    };
    expect(error.statusCode).toBe(415);
    expect(error.code).toBe('pdf_not_pdf');
  });
});

describe('MulterError LIMIT_FILE_SIZE handling', () => {
  it('PdfTooLargeError has statusCode 413 (verified via error class)', async () => {
    // Import error class directly to validate contract
    const { PdfTooLargeError } = await import('../middleware/error.middleware.js');
    const err = new PdfTooLargeError('File exceeds the 10MB size limit.');
    expect(err.statusCode).toBe(413);
    expect(err.code).toBe('pdf_too_large');
  });
});
