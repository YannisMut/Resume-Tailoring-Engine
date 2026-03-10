import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { PdfEncryptedError, PdfScannedError } from '../middleware/error.middleware.js';

// Mock pdf.service before importing app so the mock is in place
vi.mock('../services/pdf.service.js', () => ({
  parsePdf: vi.fn(),
}));

import * as pdfServiceMock from '../services/pdf.service.js';
import app from '../index.js';

// Minimal valid ResumeStructure fixture for the parsePdf mock
const MOCK_RESUME_STRUCTURE = {
  meta: {
    pageWidth: 612,
    pageHeight: 792,
    marginTop: 72,
    marginBottom: 72,
    marginLeft: 72,
    marginRight: 72,
  },
  header: [
    {
      text: 'Jane Doe',
      style: { fontName: 'Calibri', fontSize: 28, bold: true, italic: false, color: '#000000' },
    },
  ],
  sections: [
    {
      id: 'experience-0',
      heading: 'EXPERIENCE',
      headingStyle: { fontName: 'Calibri', fontSize: 24, bold: true, italic: false, color: '#000000' },
      items: [
        {
          id: 'experience-0-item-0',
          title: 'Software Engineer',
          titleStyle: { fontName: 'Calibri', fontSize: 22, bold: false, italic: false, color: '#000000' },
          bullets: [
            {
              id: 'experience-0-item-0-bullet-0',
              text: 'Built something great',
              style: { fontName: 'Calibri', fontSize: 22, bold: false, italic: false, color: '#000000' },
            },
          ],
        },
      ],
    },
  ],
};

// Minimal valid PDF magic bytes buffer
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const validPdfBuffer = Buffer.concat([PDF_MAGIC, Buffer.from('-1.4 minimal content')]);

// A buffer that does NOT start with %PDF (PNG-like)
const nonPdfBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG header

// 11MB buffer with valid PDF magic bytes (triggers size limit in multer)
const largePdfBuffer = Buffer.concat([
  PDF_MAGIC,
  Buffer.alloc(11 * 1024 * 1024 - PDF_MAGIC.length),
]);

describe('POST /api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 with a valid ResumeStructure when a valid PDF is uploaded', async () => {
    (pdfServiceMock.parsePdf as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_RESUME_STRUCTURE);

    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', validPdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      meta: expect.objectContaining({ pageWidth: 612 }),
      header: expect.any(Array),
      sections: expect.any(Array),
    });
    // Validate shape matches ResumeStructureSchema
    expect(res.body.sections).toHaveLength(1);
    expect(res.body.sections[0].heading).toBe('EXPERIENCE');
  });

  it('returns 415 with error pdf_not_pdf when a PNG file is uploaded', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', nonPdfBuffer, { filename: 'image.png', contentType: 'image/png' });

    expect(res.status).toBe(415);
    expect(res.body.error).toBe('pdf_not_pdf');
  });

  it('returns 413 with error pdf_too_large when a file over 10MB is uploaded', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', largePdfBuffer, { filename: 'large.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(413);
    expect(res.body.error).toBe('pdf_too_large');
  });

  it('returns 422 with error pdf_encrypted when parsePdf throws PdfEncryptedError', async () => {
    (pdfServiceMock.parsePdf as ReturnType<typeof vi.fn>).mockRejectedValue(
      new PdfEncryptedError('Password protected'),
    );

    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', validPdfBuffer, { filename: 'encrypted.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('pdf_encrypted');
  });

  it('returns 422 with error pdf_scanned when parsePdf throws PdfScannedError', async () => {
    (pdfServiceMock.parsePdf as ReturnType<typeof vi.fn>).mockRejectedValue(
      new PdfScannedError('Scanned image PDF'),
    );

    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', validPdfBuffer, { filename: 'scanned.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('pdf_scanned');
  });

  it('returns 415 with error pdf_not_pdf when no file is attached', async () => {
    const res = await request(app).post('/api/analyze');

    expect(res.status).toBe(415);
    expect(res.body.error).toBe('pdf_not_pdf');
  });
});
