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
      // process.cwd() works in both CJS (tsx) and ESM — avoids import.meta.url
      // which causes TS1470 when TypeScript targets CJS output
      const req = createRequire(process.cwd() + '/package.json');
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

// Minimum gap (in points) between items to consider them separate groups (left vs right-aligned)
const RIGHT_ALIGN_GAP = 40;

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
  text: string; // concatenated text (left portion if split)
  minX: number; // leftmost X position
  rightText: string | null; // right-aligned portion (if detected)
  rightItems: RawTextItem[]; // items in the right portion
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
  fontInfoMap?: Map<string, { bold: boolean; italic: boolean }>,
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

  // Prefer FontInfo from font descriptor (reliable), fall back to regex on name
  const info = fontInfoMap?.get(item.fontName);
  const bold = info ? (info.bold ?? false) : detectBold(stripped);
  const italic = info ? (info.italic ?? false) : detectItalic(stripped);

  return {
    fontName: family || FONT_FALLBACK.fontName,
    fontSize,
    bold,
    italic,
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

/**
 * Smart-join text items by checking the gap between consecutive items.
 * Only inserts a space when the gap exceeds a threshold based on character width.
 */
function smartJoinItems(items: RawTextItem[]): string {
  if (items.length === 0) return '';
  let text = items[0]!.str;
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1]!;
    const curr = items[i]!;
    const gap = curr.x - (prev.x + prev.width);
    // Only add space if gap is meaningful (> 30% of average character width)
    const avgCharWidth = prev.str.length > 0 ? prev.width / prev.str.length : 5;
    if (gap > avgCharWidth * 0.3) {
      text += ' ';
    }
    text += curr.str;
  }
  return text.trim();
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
  // Ensure items are sorted left-to-right
  const sorted = [...items].sort((a, b) => a.x - b.x);

  const maxHeight = Math.max(...sorted.map((i) => i.height));
  const minX = Math.min(...sorted.map((i) => i.x));

  // Detect right-aligned portion: find the largest gap between consecutive items
  let maxGap = 0;
  let maxGapIdx = -1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!;
    const curr = sorted[i]!;
    const gap = curr.x - (prev.x + prev.width);
    if (gap > maxGap) {
      maxGap = gap;
      maxGapIdx = i;
    }
  }

  // If the largest gap is significant, split into left and right portions
  if (maxGap >= RIGHT_ALIGN_GAP && maxGapIdx > 0) {
    const leftItems = sorted.slice(0, maxGapIdx);
    const rightItems = sorted.slice(maxGapIdx);
    return {
      items: sorted,
      y: sorted[0]!.y,
      maxHeight,
      text: smartJoinItems(leftItems),
      minX,
      rightText: smartJoinItems(rightItems),
      rightItems,
    };
  }

  return {
    items: sorted,
    y: sorted[0]!.y,
    maxHeight,
    text: smartJoinItems(sorted),
    minX,
    rightText: null,
    rightItems: [],
  };
}

/** Slugify a heading for use in bullet IDs */
function slugify(text: string): string {
  return text.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Fallback heading detector for resumes where section headings use the same
 * font size as body text (distinguished only by bold + ALL CAPS).
 * Matches short all-uppercase lines like "EDUCATION" or "WORK EXPERIENCE".
 */
function isAllCapsHeading(text: string): boolean {
  const t = text.trim();
  if (t.length === 0 || t.length > 50) return false;
  // Must be all uppercase letters/spaces/ampersands — no lowercase allowed
  return /^[A-Z][A-Z\s&/\-]+$/.test(t) && /[A-Z]{3,}/.test(t);
}

/** Check if text starts with a bullet character */
const BULLET_CHAR_RE = /^[•\-–—*]\s/;

/**
 * Preprocess body lines to join continuation lines.
 * A continuation line is an indented line that does NOT start with a bullet character.
 * It gets joined to the previous line (title or bullet).
 */
function joinContinuationLines(bodyLines: LogicalLine[], marginLeft: number): LogicalLine[] {
  if (bodyLines.length === 0) return [];

  const result: LogicalLine[] = [];

  for (const line of bodyLines) {
    const isFlushLeft = line.minX <= marginLeft + INDENT_THRESHOLD;
    const startsWithBullet = BULLET_CHAR_RE.test(line.text);
    const isContinuation = !isFlushLeft && !startsWithBullet;

    if (isContinuation && result.length > 0) {
      // Join to previous line's text
      const prev = result[result.length - 1]!;
      prev.text = prev.text + ' ' + line.text;
      // Keep the previous line's style/position properties
    } else {
      // New line — shallow clone so we can safely mutate text
      result.push({ ...line });
    }
  }

  return result;
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
  type FontInfoMap = Map<string, { bold: boolean; italic: boolean }>;

  interface PageData {
    rawItems: RawTextItem[];
    styles: Record<string, { fontFamily: string }>;
    fontInfoMap: FontInfoMap;
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

    // Resolve real font names via commonObjs (getTextContent only exposes encoded names
    // like g_d0_f1; the real names like "TimesNewRomanPS-BoldMT" live on fontObj.name).
    const fontInfoMap: FontInfoMap = new Map();
    try {
      await page.getOperatorList();
      for (const fontName of Object.keys(styles)) {
        if (page.commonObjs.has(fontName)) {
          try {
            const fontObj = page.commonObjs.get(fontName);
            const realName: string = fontObj?.name ?? '';
            if (realName) {
              const stripped = stripSubsetPrefix(realName);
              fontInfoMap.set(fontName, {
                bold: detectBold(stripped),
                italic: detectItalic(stripped),
              });
            }
          } catch { /* font not resolved — skip */ }
        }
      }
      page.cleanup();
    } catch { /* getOperatorList failed — fall back to regex-only */ }

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
    pages.push({ rawItems, styles, fontInfoMap, pageWidth, pageHeight });
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
  const allFontInfo: FontInfoMap = new Map();

  for (const page of pages) {
    allRawItems.push(...page.rawItems);
    Object.assign(allStyles, page.styles);
    for (const [k, v] of page.fontInfoMap) allFontInfo.set(k, v);
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

  // Determine heading detection strategy.
  // If ALL size-based candidates are non-all-caps (e.g. only the resume owner's name
  // is larger), the actual section headings must be same-size bold/caps. In that case,
  // add all-caps detection alongside size-based so "EDUCATION" etc. are found.
  const sizeBasedHeadings = allLines.filter((l) => l.maxHeight >= headingThreshold);
  const allSizeHeadingsAreNonCaps = sizeBasedHeadings.every((l) => !isAllCapsHeading(l.text));
  const useAllCaps = allSizeHeadingsAreNonCaps;

  const headingXValues = allLines
    .filter((l) => l.maxHeight >= headingThreshold || (useAllCaps && isAllCapsHeading(l.text)))
    .map((l) => l.minX);
  const marginLeft = headingXValues.length > 0 ? Math.min(...headingXValues) : 72;

  for (const line of allLines) {
    const isSizeHeading = line.maxHeight >= headingThreshold;
    const isCapsHeading = useAllCaps && isAllCapsHeading(line.text);
    const isHeading = isSizeHeading || isCapsHeading;

    if (!foundFirstHeading) {
      // The first section heading must be all-caps (e.g., "EDUCATION").
      // Large non-caps text (e.g., the person's name "Yannis Mutsinzi") is header, not a section.
      const isSectionHeading = isAllCapsHeading(line.text) && isHeading;

      if (isSectionHeading) {
        foundFirstHeading = true;
        currentSection = {
          heading: line.text,
          headingStyle: buildTextStyle(line.items[0]!, allStyles, line.maxHeight, allFontInfo),
          bodyLines: [],
          idx: 0,
        };
      } else {
        // Pre-heading line → header block (name, contact info, etc.)
        headerLines.push({
          text: line.text,
          style: buildTextStyle(line.items[0]!, allStyles, line.maxHeight, allFontInfo),
        });
      }
    } else {
      if (isHeading) {
        // Finalize current section, start new one
        if (currentSection !== null) {
          sections.push(buildSection(currentSection.heading, currentSection.headingStyle, currentSection.bodyLines, currentSection.idx, allStyles, marginLeft, allFontInfo));
        }
        const newIdx = sections.length; // will be pushed after we close
        currentSection = {
          heading: line.text,
          headingStyle: buildTextStyle(line.items[0]!, allStyles, line.maxHeight, allFontInfo),
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
    sections.push(buildSection(currentSection.heading, currentSection.headingStyle, currentSection.bodyLines, currentSection.idx, allStyles, marginLeft, allFontInfo));
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
  fontInfoMap?: Map<string, { bold: boolean; italic: boolean }>,
): Section {
  const slug = slugify(heading);
  const id = `${slug}-${sectionIdx}`;

  // Preprocess: join continuation lines before building items
  const processedLines = joinContinuationLines(bodyLines, marginLeft);

  // Group body lines into SectionItems by indent level and bullet detection
  const items: SectionItem[] = [];
  let currentItem: {
    title?: string;
    titleStyle?: TextStyle;
    titleRight?: string;
    titleRightStyle?: TextStyle;
    subtitle?: string;
    subtitleStyle?: TextStyle;
    subtitleRight?: string;
    subtitleRightStyle?: TextStyle;
    bullets: { id: string; text: string; style: TextStyle }[];
    itemIdx: number;
  } | null = null;

  function flushItem() {
    if (currentItem !== null) {
      items.push({
        id: `${id}-item-${currentItem.itemIdx}`,
        title: currentItem.title,
        titleStyle: currentItem.titleStyle,
        titleRight: currentItem.titleRight,
        titleRightStyle: currentItem.titleRightStyle,
        subtitle: currentItem.subtitle,
        subtitleStyle: currentItem.subtitleStyle,
        subtitleRight: currentItem.subtitleRight,
        subtitleRightStyle: currentItem.subtitleRightStyle,
        bullets: currentItem.bullets,
      });
    }
  }

  for (const line of processedLines) {
    const isFlushLeft = line.minX <= marginLeft + INDENT_THRESHOLD;
    const startsWithBullet = BULLET_CHAR_RE.test(line.text);
    const firstItem = line.items[0];
    if (!firstItem) continue;
    const lineStyle = buildTextStyle(firstItem, styles, line.maxHeight, fontInfoMap);

    // Flush-left line that starts with a bullet character → treat as bullet, not title
    if (isFlushLeft && startsWithBullet) {
      if (currentItem === null) {
        currentItem = { bullets: [], itemIdx: items.length };
      }
      const bulletIdx = currentItem.bullets.length;
      const bulletText = line.text.replace(/^[•\-–—*]\s*/, '').trim();
      currentItem.bullets.push({
        id: `${id}-item-${currentItem.itemIdx}-bullet-${bulletIdx}`,
        text: bulletText,
        style: lineStyle,
      });
    } else if (isFlushLeft && !startsWithBullet) {
      // Flush-left, no bullet char → title or subtitle
      if (currentItem === null || currentItem.title !== undefined) {
        // Start a new item
        if (currentItem !== null && currentItem.title !== undefined) {
          flushItem();
        }
        currentItem = {
          title: line.text,
          titleStyle: lineStyle,
          titleRight: line.rightText ?? undefined,
          titleRightStyle: line.rightText && line.rightItems.length > 0
            ? buildTextStyle(line.rightItems[0]!, styles, line.maxHeight, fontInfoMap)
            : undefined,
          bullets: [],
          itemIdx: items.length,
        };
      } else {
        // Second flush-left line before any bullet = subtitle
        currentItem.subtitle = line.text;
        currentItem.subtitleStyle = lineStyle;
        currentItem.subtitleRight = line.rightText ?? undefined;
        currentItem.subtitleRightStyle = line.rightText && line.rightItems.length > 0
          ? buildTextStyle(line.rightItems[0]!, styles, line.maxHeight, fontInfoMap)
          : undefined;
      }
    } else {
      // Indented line with bullet char → new bullet
      if (currentItem === null) {
        currentItem = { bullets: [], itemIdx: items.length };
      }
      const bulletIdx = currentItem.bullets.length;
      const bulletText = line.text.replace(/^[•\-–—*]\s*/, '').trim();
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
