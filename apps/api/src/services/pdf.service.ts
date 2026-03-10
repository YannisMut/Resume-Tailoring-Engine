/**
 * pdf.service.ts — Core PDF-to-ResumeStructure extraction service.
 *
 * Takes a raw Buffer, uses pdfjs-dist to extract text items per page,
 * runs Y-proximity clustering to group spans into logical lines,
 * classifies lines as headings/header/body using font size,
 * assigns indent levels for bullets, and builds a validated ResumeStructure.
 */

import {
  PdfEncryptedError,
  PdfScannedError,
  PdfCorruptError,
} from '../middleware/error.middleware.js';
import { ResumeStructureSchema } from '@resume/types';
import type { ResumeStructure, HeaderLine, TextStyle, Section, SectionItem } from '@resume/types';
import { createRequire } from 'node:module';

// Lazy-load pdfjs via dynamic import() to get the real ESM module.
// Static imports go through tsx's CJS transpilation, which creates a proxy
// object — setting GlobalWorkerOptions on that proxy has no effect on the
// real pdfjs internals. Dynamic import() always returns the true ESM namespace.
let pdfjsPromise: Promise<typeof import('pdfjs-dist/legacy/build/pdf.mjs')> | null = null;

function getPdfjs() {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((mod) => {
      const req = createRequire(import.meta.url);
      mod.GlobalWorkerOptions.workerSrc = req.resolve(
        'pdfjs-dist/legacy/build/pdf.worker.mjs',
      );
      return mod;
    });
  }
  return pdfjsPromise;
}

// Y-coordinate proximity tolerance: items within this many points share a logical line
const LINE_Y_TOLERANCE = 2.0;

// Heading detection multiplier: a line is a heading if its max height >= this * medianBodyHeight
const HEADING_SIZE_RATIO = 1.2;

// Indent threshold: body lines within this many pts of marginLeft are flush-left (indent 0)
const INDENT_THRESHOLD = 10;

// Default fallback TextStyle when fontName is missing or unresolvable
const FONT_FALLBACK: Pick<TextStyle, 'fontName' | 'fontSize' | 'bold' | 'italic' | 'color'> = {
  fontName: 'Calibri',
  fontSize: 22, // half-points (11pt * 2)
  bold: false,
  italic: false,
  color: '#000000',
};

// Internal representation of a raw text item from pdfjs
interface RawTextItem {
  str: string;
  x: number;
  y: number;
  height: number; // points
  fontName: string;
  width: number;
}

// A line is a group of RawTextItems sharing approximately the same Y coordinate
interface LogicalLine {
  items: RawTextItem[];
  y: number; // representative Y (first item's Y)
  maxHeight: number;
  text: string; // concatenated text
  minX: number; // leftmost X position
}

/** Strip the ABCDEF+ embedded-subset prefix from a PDF font name */
function stripSubsetPrefix(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, '');
}

/** Detect bold from the (stripped) font name */
function detectBold(strippedName: string): boolean {
  return /bold|heavy|black/i.test(strippedName);
}

/** Detect italic from the (stripped) font name */
function detectItalic(strippedName: string): boolean {
  return /italic|oblique/i.test(strippedName);
}

/** Build a TextStyle from a pdfjs TextItem and its page's styles map */
function buildTextStyle(
  item: RawTextItem,
  styles: Record<string, { fontFamily: string }>,
  heightPts: number,
): TextStyle {
  const style = item.fontName ? styles[item.fontName] : undefined;

  if (!style && !item.fontName) {
    // Font metadata missing — apply full fallback (Calibri/22 half-pts per spec)
    console.warn('[pdf.service] font fallback applied for item:', item.str);
    return { ...FONT_FALLBACK };
  }

  const rawFamily = style?.fontFamily ?? '';
  const stripped = stripSubsetPrefix(item.fontName || rawFamily);
  const family = stripped || rawFamily || FONT_FALLBACK.fontName;

  // height in pdfjs is already in points; OOXML uses half-points
  const fontSize = heightPts > 0 ? Math.round(heightPts * 2) : FONT_FALLBACK.fontSize;

  return {
    fontName: family || FONT_FALLBACK.fontName,
    fontSize,
    bold: detectBold(stripped),
    italic: detectItalic(stripped),
    color: '#000000',
  };
}

/** Compute the median of an array of numbers */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
  }
  return sorted[mid] ?? 0;
}

/** Group raw text items into logical lines using Y-proximity clustering */
function clusterIntoLines(items: RawTextItem[]): LogicalLine[] {
  if (items.length === 0) return [];

  // Sort by Y descending (top of page first), then X ascending (left to right)
  const sorted = [...items].sort((a, b) => {
    if (Math.abs(b.y - a.y) > LINE_Y_TOLERANCE) return b.y - a.y;
    return a.x - b.x;
  });

  const lines: LogicalLine[] = [];
  let currentLine: RawTextItem[] = [];
  let currentY = sorted[0]!.y;

  for (const item of sorted) {
    if (item.str.trim() === '') continue; // skip whitespace-only items

    if (Math.abs(currentY - item.y) <= LINE_Y_TOLERANCE) {
      currentLine.push(item);
    } else {
      if (currentLine.length > 0) {
        lines.push(buildLogicalLine(currentLine));
      }
      currentLine = [item];
      currentY = item.y;
    }
  }

  if (currentLine.length > 0) {
    lines.push(buildLogicalLine(currentLine));
  }

  return lines;
}

function buildLogicalLine(items: RawTextItem[]): LogicalLine {
  const maxHeight = Math.max(...items.map((i) => i.height));
  const minX = Math.min(...items.map((i) => i.x));
  const text = items.map((i) => i.str).join(' ').trim();
  return {
    items,
    y: items[0]!.y,
    maxHeight,
    text,
    minX,
  };
}

/** Slugify a heading for use in bullet IDs */
function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Main PDF parsing function.
 *
 * @param buffer - Raw PDF file bytes
 * @returns Validated ResumeStructure
 * @throws PdfEncryptedError — password-protected PDF
 * @throws PdfScannedError — image-only PDF with no text
 * @throws PdfCorruptError — corrupt/invalid PDF or fails minimum viable structure check
 */
export async function parsePdf(buffer: Buffer): Promise<ResumeStructure> {
  // --- Step 1: Load document ---
  const { getDocument } = await getPdfjs();
  let pdfDoc: Awaited<ReturnType<typeof getDocument>['promise']>;

  try {
    const loadingTask = getDocument({ data: new Uint8Array(buffer) });
    pdfDoc = await loadingTask.promise;
  } catch (err: unknown) {
    const errObj = err as { name?: string; message?: string };

    if (errObj?.name === 'PasswordException') {
      throw new PdfEncryptedError('This PDF is password-protected. Please remove the password and try again.');
    }

    if (errObj?.name === 'InvalidPDFException' || err instanceof Error && err.name === 'InvalidPDFException') {
      throw new PdfCorruptError('This PDF appears to be corrupt or unreadable.');
    }

    // Unknown load error
    throw new PdfCorruptError(`Failed to open PDF: ${errObj?.message ?? 'unknown error'}`);
  }

  // --- Step 2: Collect all text items across all pages ---
  interface PageData {
    rawItems: RawTextItem[];
    styles: Record<string, { fontFamily: string }>;
    pageWidth: number;
    pageHeight: number;
  }

  const pages: PageData[] = [];
  let totalTextItems = 0;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.view as number[]; // [x0, y0, x1, y1]
    const pageWidth = (viewport[2] ?? 0) - (viewport[0] ?? 0);
    const pageHeight = (viewport[3] ?? 0) - (viewport[1] ?? 0);

    const textContent = await page.getTextContent();
    const styles = (textContent.styles ?? {}) as Record<string, { fontFamily: string }>;

    const rawItems: RawTextItem[] = [];
    for (const item of textContent.items) {
      // Filter to TextItems only (have 'str' property)
      if (!('str' in item)) continue;
      const ti = item as {
        str: string;
        transform: number[];
        height: number;
        fontName: string;
        width: number;
      };
      if (!ti.str) continue; // skip empty

      rawItems.push({
        str: ti.str,
        x: ti.transform[4] ?? 0,
        y: ti.transform[5] ?? 0,
        height: ti.height,
        fontName: ti.fontName ?? '',
        width: ti.width,
      });
    }

    totalTextItems += rawItems.length;
    pages.push({ rawItems, styles, pageWidth, pageHeight });
  }

  // --- Step 3: Scanned PDF check ---
  if (totalTextItems === 0) {
    throw new PdfScannedError('This PDF appears to be a scanned image. Please use a text-based PDF.');
  }

  // --- Step 4-8: Parse structure using first page (primary layout) ---
  // Use the first page's dimensions for meta; combine all items
  const firstPage = pages[0] ?? { pageWidth: 612, pageHeight: 792 };

  // Collect all items across all pages for layout analysis
  const allRawItems: RawTextItem[] = [];
  const allStyles: Record<string, { fontFamily: string }> = {};

  for (const page of pages) {
    allRawItems.push(...page.rawItems);
    Object.assign(allStyles, page.styles);
  }

  // Cluster all items into logical lines
  const allLines = clusterIntoLines(allRawItems);

  // Compute median height for heading detection
  const allHeights = allLines.map((l) => l.maxHeight);
  const medianHeight = median(allHeights);
  const headingThreshold = HEADING_SIZE_RATIO * medianHeight;

  // Classify lines: heading vs. header vs. body
  const headerLines: HeaderLine[] = [];
  const sections: Section[] = [];
  let foundFirstHeading = false;
  let currentSection: {
    heading: string;
    headingStyle: TextStyle;
    bodyLines: LogicalLine[];
    idx: number;
  } | null = null;

  // Determine marginLeft using headings as the reference anchor.
  // Section headings (e.g. "EXPERIENCE", "EDUCATION") are flush against the page margin,
  // so their X position is the most reliable proxy for the left margin.
  // This avoids the trap of using body/bullet text — which is typically indented.
  const headingXValues = allLines
    .filter((l) => l.maxHeight >= headingThreshold)
    .map((l) => l.minX);
  const marginLeft = headingXValues.length > 0 ? Math.min(...headingXValues) : 72;

  for (const line of allLines) {
    const isHeading = line.maxHeight >= headingThreshold;

    if (!foundFirstHeading) {
      if (isHeading) {
        foundFirstHeading = true;
        // Save previous body lines as header
        // (already accumulated) — start first section
        currentSection = {
          heading: line.text,
          headingStyle: buildTextStyle(line.items[0]!, allStyles, line.maxHeight),
          bodyLines: [],
          idx: 0,
        };
      } else {
        // Pre-heading line → header block
        headerLines.push({
          text: line.text,
          style: buildTextStyle(line.items[0]!, allStyles, line.maxHeight),
        });
      }
    } else {
      if (isHeading) {
        // Finalize current section, start new one
        if (currentSection !== null) {
          sections.push(buildSection(currentSection.heading, currentSection.headingStyle, currentSection.bodyLines, currentSection.idx, allStyles, marginLeft));
        }
        const newIdx = sections.length; // will be pushed after we close
        currentSection = {
          heading: line.text,
          headingStyle: buildTextStyle(line.items[0]!, allStyles, line.maxHeight),
          bodyLines: [],
          idx: newIdx,
        };
      } else {
        // Body line — append to current section
        currentSection?.bodyLines.push(line);
      }
    }
  }

  // Finalize last section
  if (currentSection !== null) {
    sections.push(buildSection(currentSection.heading, currentSection.headingStyle, currentSection.bodyLines, currentSection.idx, allStyles, marginLeft));
  }

  // --- Step 10: Minimum viable check ---
  const hasBullets = sections.some((s) => s.items.some((item) => item.bullets.length > 0));
  if (sections.length === 0 || !hasBullets) {
    throw new PdfCorruptError(
      'This PDF does not appear to be a standard resume — no sections with bullet points were found.',
    );
  }

  // Compute page margins (rough approximation based on text bounds)
  const allX = allRawItems.map((i) => i.x);
  const allY = allRawItems.map((i) => i.y);
  const computedMarginLeft = allX.length > 0 ? Math.min(...allX) : 72;
  const computedMarginRight = allX.length > 0 ? firstPage.pageWidth - Math.max(...allX) : 72;
  const computedMarginTop = allY.length > 0 ? firstPage.pageHeight - Math.max(...allY) : 72;
  const computedMarginBottom = allY.length > 0 ? Math.min(...allY) : 72;

  const raw: ResumeStructure = {
    meta: {
      pageWidth: firstPage.pageWidth,
      pageHeight: firstPage.pageHeight,
      marginTop: computedMarginTop,
      marginBottom: computedMarginBottom,
      marginLeft: computedMarginLeft,
      marginRight: computedMarginRight,
    },
    sections,
    header: headerLines,
  };

  // --- Step 11: Zod validation ---
  try {
    return ResumeStructureSchema.parse(raw);
  } catch {
    throw new PdfCorruptError('PDF parsed but structure failed validation — the document may be malformed.');
  }
}

/** Build a Section from a heading and its body lines */
function buildSection(
  heading: string,
  headingStyle: TextStyle,
  bodyLines: LogicalLine[],
  sectionIdx: number,
  styles: Record<string, { fontFamily: string }>,
  marginLeft: number,
): Section {
  const slug = slugify(heading);
  const id = `${slug}-${sectionIdx}`;

  // Group body lines into SectionItems by indent level
  // indent 0 (within INDENT_THRESHOLD of marginLeft) = title/subtitle candidate
  // indent 1+ = bullet candidate
  const items: SectionItem[] = [];
  let currentItem: {
    title?: string;
    titleStyle?: TextStyle;
    subtitle?: string;
    subtitleStyle?: TextStyle;
    bullets: { id: string; text: string; style: TextStyle }[];
    itemIdx: number;
  } | null = null;

  function flushItem() {
    if (currentItem !== null) {
      items.push({
        id: `${id}-item-${currentItem.itemIdx}`,
        title: currentItem.title,
        titleStyle: currentItem.titleStyle,
        subtitle: currentItem.subtitle,
        subtitleStyle: currentItem.subtitleStyle,
        bullets: currentItem.bullets,
      });
    }
  }

  for (const line of bodyLines) {
    const isFlushLeft = line.minX <= marginLeft + INDENT_THRESHOLD;
    const firstItem = line.items[0];
    if (!firstItem) continue;
    const lineStyle = buildTextStyle(firstItem, styles, line.maxHeight);

    if (isFlushLeft) {
      // Flush-left line: could be a title or subtitle within the item
      if (currentItem === null || currentItem.title !== undefined) {
        // Start a new item when we already have a title, or have no item yet
        if (currentItem !== null && currentItem.title !== undefined) {
          flushItem();
        }
        const itemIdx = items.length + (currentItem !== null && currentItem.title !== undefined ? 1 : 0);
        currentItem = {
          title: line.text,
          titleStyle: lineStyle,
          bullets: [],
          itemIdx: items.length,
        };
      } else {
        // Second flush-left line before any bullet = subtitle
        currentItem.subtitle = line.text;
        currentItem.subtitleStyle = lineStyle;
      }
    } else {
      // Indented line = bullet
      if (currentItem === null) {
        // Bullet without a title — create implicit item
        currentItem = {
          bullets: [],
          itemIdx: items.length,
        };
      }
      const bulletIdx = currentItem.bullets.length;
      const bulletText = line.text.replace(/^[•\-–—*]\s*/, '').trim(); // strip leading bullet chars
      currentItem.bullets.push({
        id: `${id}-item-${currentItem.itemIdx}-bullet-${bulletIdx}`,
        text: bulletText,
        style: lineStyle,
      });
    }
  }

  flushItem();

  return {
    id,
    heading,
    headingStyle,
    items,
  };
}
