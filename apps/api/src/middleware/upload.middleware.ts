import multer, { MulterError } from 'multer';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { PdfNotPdfError, PdfTooLargeError } from './error.middleware.js';

const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF

const storage = multer.memoryStorage();
const multerUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — throws MulterError LIMIT_FILE_SIZE
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(null, false); // silent reject — validateMagicBytes will throw PdfNotPdfError
    }
  },
}).single('resume');

function wrapMulter(req: Request, res: Response, next: NextFunction): void {
  multerUpload(req, res, (err) => {
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        next(new PdfTooLargeError('File exceeds the 10MB size limit.'));
      } else {
        next(err);
      }
    } else if (err) {
      next(err);
    } else {
      next();
    }
  });
}

function validateMagicBytes(req: Request, _res: Response, next: NextFunction): void {
  if (!req.file) {
    next(new PdfNotPdfError('No file uploaded or file type is not PDF.'));
    return;
  }
  const head = req.file.buffer.slice(0, 4);
  if (!head.equals(PDF_MAGIC)) {
    next(new PdfNotPdfError('File is not a valid PDF (magic bytes mismatch).'));
    return;
  }
  next();
}

export const uploadMiddleware: RequestHandler[] = [wrapMulter, validateMagicBytes];
