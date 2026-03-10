import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PdfEncryptedError, PdfScannedError, PdfCorruptError } from '../middleware/error.middleware.js';

// --- pdfjs-dist mock ---
// vi.mock is hoisted so the factory cannot reference classes defined in the module scope.
// We define the mock using plain inline classes/functions.
vi.mock('pdfjs-dist/legacy/build/pdf.mjs', () => {
  class FakeInvalidPDFException extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = 'InvalidPDFException';
    }
  }

  return {
    GlobalWorkerOptions: { workerSrc: '' },
    getDocument: vi.fn(),
    InvalidPDFException: FakeInvalidPDFException,
  };
});

import * as pdfjsMock from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parsePdf } from '../services/pdf.service.js';

// PasswordException is not exported from pdfjs-dist — simulate by crafting an error
// with name='PasswordException', matching what pdfjs internally throws.
function makePasswordException(code = 1) {
  const err = new Error('Password required');
  err.name = 'PasswordException';
  (err as any).code = code;
  return err;
}

// Helper to build a minimal mock pdfjs TextItem
function makeTextItem(str: string, x: number, y: number, height: number, fontName: string) {
  return {
    str,
    transform: [1, 0, 0, 1, x, y],
    height,
    fontName,
    width: str.length * 6,
  };
}

// Helper to build a mock pdfjs page
function makeMockPage(
  textItems: { str: string; transform: number[]; height: number; fontName: string; width: number }[],
  styles: Record<string, { fontFamily: string }> = {},
) {
  return {
    view: [0, 0, 612, 792],
    getTextContent: vi.fn().mockResolvedValue({ items: textItems, styles }),
  };
}

// Helper to build a mock PDFDocumentProxy
function makeMockDoc(pages: ReturnType<typeof makeMockPage>[]) {
  return {
    numPages: pages.length,
    getPage: vi.fn().mockImplementation((pageNum: number) => Promise.resolve(pages[pageNum - 1])),
  };
}

// --- Tests ---

describe('parsePdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws PdfEncryptedError (code pdf_encrypted, status 422) for a password-protected PDF', async () => {
    const passwordErr = makePasswordException(1);
    (pdfjsMock.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.reject(passwordErr),
    });

    try {
      await parsePdf(Buffer.from('fake'));
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PdfEncryptedError);
      expect((e as PdfEncryptedError).code).toBe('pdf_encrypted');
      expect((e as PdfEncryptedError).statusCode).toBe(422);
    }
  });

  it('throws PdfCorruptError (code pdf_corrupt, status 422) for an InvalidPDFException', async () => {
    const corruptErr = new (pdfjsMock as any).InvalidPDFException('Invalid PDF structure');
    (pdfjsMock.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.reject(corruptErr),
    });

    try {
      await parsePdf(Buffer.from('fake'));
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PdfCorruptError);
      expect((e as PdfCorruptError).code).toBe('pdf_corrupt');
      expect((e as PdfCorruptError).statusCode).toBe(422);
    }
  });

  it('throws PdfScannedError (code pdf_scanned, status 422) when PDF has 0 text items', async () => {
    const emptyPage = makeMockPage([]);
    const mockDoc = makeMockDoc([emptyPage]);
    (pdfjsMock.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(mockDoc),
    });

    try {
      await parsePdf(Buffer.from('fake'));
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PdfScannedError);
      expect((e as PdfScannedError).code).toBe('pdf_scanned');
      expect((e as PdfScannedError).statusCode).toBe(422);
    }
  });

  it('returns a ResumeStructure with 1 section and header lines for a valid PDF', async () => {
    const styles = { f1: { fontFamily: 'Calibri' } };
    const textItems = [
      // Header line (above first heading): y=750, height=14
      makeTextItem('John Doe', 100, 750, 14, 'f1'),
      // Heading: y=700, height=18 — 18 >= 1.2 * median(~12..14)
      makeTextItem('EXPERIENCE', 72, 700, 18, 'f1'),
      // Body bullet: y=680, height=12, indented at x=90
      makeTextItem('Built something great', 90, 680, 12, 'f1'),
    ];
    const mockPage = makeMockPage(textItems, styles);
    const mockDoc = makeMockDoc([mockPage]);
    (pdfjsMock.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(mockDoc),
    });

    const result = await parsePdf(Buffer.from('fake'));

    expect(result.sections).toHaveLength(1);
    expect(result.sections[0]?.heading).toBe('EXPERIENCE');
    expect(result.header.length).toBeGreaterThanOrEqual(1);
    expect(result.header[0]?.text).toBe('John Doe');
  });

  it('uses font fallback (Calibri/22 half-pts/false/false/#000000) when fontName is missing', async () => {
    const textItems = [
      // No fontName (empty string), no matching style
      { str: 'John Doe', transform: [1, 0, 0, 1, 100, 750], height: 14, fontName: '', width: 60 },
      { str: 'EXPERIENCE', transform: [1, 0, 0, 1, 72, 700], height: 18, fontName: '', width: 80 },
      { str: 'Built something', transform: [1, 0, 0, 1, 90, 680], height: 12, fontName: '', width: 80 },
    ];
    const mockPage = makeMockPage(textItems, {});
    const mockDoc = makeMockDoc([mockPage]);
    (pdfjsMock.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(mockDoc),
    });

    const result = await parsePdf(Buffer.from('fake'));

    // Parsing must succeed — fallback is applied, not an error
    expect(result).toBeDefined();
    expect(result.header[0]?.style.fontName).toBe('Calibri');
    expect(result.header[0]?.style.fontSize).toBe(22);
    expect(result.header[0]?.style.bold).toBe(false);
    expect(result.header[0]?.style.italic).toBe(false);
    expect(result.header[0]?.style.color).toBe('#000000');
  });

  it('throws PdfCorruptError when PDF has text but no section has any bullets', async () => {
    // Two heading-sized items but no body text with bullets
    const styles = { f1: { fontFamily: 'Calibri' } };
    const textItems = [
      // Two headings, nothing else — no bullets possible
      makeTextItem('EXPERIENCE', 72, 700, 18, 'f1'),
      makeTextItem('EDUCATION', 72, 600, 18, 'f1'),
    ];
    const mockPage = makeMockPage(textItems, styles);
    const mockDoc = makeMockDoc([mockPage]);
    (pdfjsMock.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve(mockDoc),
    });

    try {
      await parsePdf(Buffer.from('fake'));
      expect.fail('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(PdfCorruptError);
      expect((e as PdfCorruptError).code).toBe('pdf_corrupt');
    }
  });
});
