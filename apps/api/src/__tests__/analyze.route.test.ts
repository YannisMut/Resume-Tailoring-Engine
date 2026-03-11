import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { PdfEncryptedError, PdfScannedError, JdTooLongError, OpenAiTimeoutError } from '../middleware/error.middleware.js';

// Mock pdf.service before importing app so the mock is in place
vi.mock('../services/pdf.service.js', () => ({
  parsePdf: vi.fn(),
}));

// Mock ai.service — factory uses vi.fn() directly (avoids hoisting variable reference issue)
vi.mock('../services/ai.service.js', () => ({
  rewriteAllBullets: vi.fn(),
}));

import * as pdfServiceMock from '../services/pdf.service.js';
import * as aiServiceMock from '../services/ai.service.js';
import app from '../index.js';

const mockRewriteAllBullets = aiServiceMock.rewriteAllBullets as ReturnType<typeof vi.fn>;

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
    // Default: return one rewritten bullet matching MOCK_RESUME_STRUCTURE's bullet
    mockRewriteAllBullets.mockResolvedValue([
      {
        id: 'experience-0-item-0-bullet-0',
        original: 'Built something great',
        rewritten: 'Built something great with TypeScript',
        approved: false,
      },
    ]);
  });

  it('returns 200 with a valid ResumeStructure when a valid PDF is uploaded', async () => {
    (pdfServiceMock.parsePdf as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_RESUME_STRUCTURE);

    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', validPdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' })
      .field('jobDescription', 'Software engineer with TypeScript experience');

    expect(res.status).toBe(200);
    // Route now returns AnalysisResult; resumeStructure contains the parsed resume
    expect(res.body).toMatchObject({
      score: expect.any(Number),
      gaps: expect.any(Array),
      rewrites: expect.any(Array),
      resumeStructure: expect.objectContaining({
        meta: expect.objectContaining({ pageWidth: 612 }),
        header: expect.any(Array),
        sections: expect.any(Array),
      }),
    });
    expect(res.body.resumeStructure.sections).toHaveLength(1);
    expect(res.body.resumeStructure.sections[0].heading).toBe('EXPERIENCE');
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
      .attach('resume', validPdfBuffer, { filename: 'encrypted.pdf', contentType: 'application/pdf' })
      .field('jobDescription', 'Software engineer with TypeScript experience');

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('pdf_encrypted');
  });

  it('returns 422 with error pdf_scanned when parsePdf throws PdfScannedError', async () => {
    (pdfServiceMock.parsePdf as ReturnType<typeof vi.fn>).mockRejectedValue(
      new PdfScannedError('Scanned image PDF'),
    );

    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', validPdfBuffer, { filename: 'scanned.pdf', contentType: 'application/pdf' })
      .field('jobDescription', 'Software engineer with TypeScript experience');

    expect(res.status).toBe(422);
    expect(res.body.error).toBe('pdf_scanned');
  });

  it('returns 415 with error pdf_not_pdf when no file is attached', async () => {
    const res = await request(app).post('/api/analyze');

    expect(res.status).toBe(415);
    expect(res.body.error).toBe('pdf_not_pdf');
  });

  it('returns 400 with jd_too_long when jobDescription field is absent', async () => {
    (pdfServiceMock.parsePdf as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_RESUME_STRUCTURE);

    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', validPdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' });
    // No .field('jobDescription') — omitted intentionally

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('jd_too_long');
  });

  it('returns 400 with jd_too_long when jobDescription exceeds 5000 chars', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', validPdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' })
      .field('jobDescription', 'x'.repeat(5001));

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('jd_too_long');
  });

  it('returns 200 when jobDescription is exactly 5000 chars (boundary)', async () => {
    (pdfServiceMock.parsePdf as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_RESUME_STRUCTURE);

    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', validPdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' })
      .field('jobDescription', 'typescript react '.repeat(294).trimEnd().padEnd(5000, 'x'));

    expect(res.status).toBe(200);
  });

  it('returns populated rewrites array with RewrittenBullet shape when resume has bullets', async () => {
    (pdfServiceMock.parsePdf as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_RESUME_STRUCTURE);
    // mockRewriteAllBullets default return set in beforeEach

    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', validPdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' })
      .field('jobDescription', 'TypeScript React developer with Node.js experience');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.rewrites)).toBe(true);
    expect(res.body.rewrites).toHaveLength(1);
    const bullet = res.body.rewrites[0];
    expect(typeof bullet.id).toBe('string');
    expect(typeof bullet.original).toBe('string');
    expect(typeof bullet.rewritten).toBe('string');
    expect(bullet.approved).toBe(false);
  });

  it('returns 504 with ai_timeout and retryable:true when rewriteAllBullets throws OpenAiTimeoutError', async () => {
    (pdfServiceMock.parsePdf as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_RESUME_STRUCTURE);
    mockRewriteAllBullets.mockRejectedValue(new OpenAiTimeoutError());

    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', validPdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' })
      .field('jobDescription', 'TypeScript React developer');

    expect(res.status).toBe(504);
    expect(res.body.error).toBe('ai_timeout');
    expect(res.body.retryable).toBe(true);
  });

  it('returns score, gaps, rewrites, and resumeStructure on a valid request', async () => {
    (pdfServiceMock.parsePdf as ReturnType<typeof vi.fn>).mockResolvedValue(MOCK_RESUME_STRUCTURE);

    const res = await request(app)
      .post('/api/analyze')
      .attach('resume', validPdfBuffer, { filename: 'resume.pdf', contentType: 'application/pdf' })
      .field('jobDescription', 'TypeScript React developer with Node.js experience');

    expect(res.status).toBe(200);
    expect(typeof res.body.score).toBe('number');
    expect(res.body.score).toBeGreaterThanOrEqual(0);
    expect(res.body.score).toBeLessThanOrEqual(100);
    expect(Array.isArray(res.body.gaps)).toBe(true);
    expect(Array.isArray(res.body.rewrites)).toBe(true);
    expect(res.body.resumeStructure).toBeDefined();
  });
});
