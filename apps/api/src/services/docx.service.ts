import {
  Document, Packer, Paragraph, TextRun, ExternalHyperlink, LineRuleType,
  LevelFormat, AlignmentType, TabStopType, BorderStyle,
} from 'docx';
import type { ResumeStructure, TextStyle } from '@resume/types';
import type { RewrittenBullet } from '@resume/types';

const BULLET_REF = 'resume-bullet';

// Default spacing (TWIPs: 20 TWIPs = 1pt) applied when PDF parser doesn't provide spacing.
const SPACING = {
  AFTER_HEADER: 160,          // 8pt — gap between header block and first section
  BEFORE_SECTION: 200,        // 10pt
  AFTER_SECTION: 80,          // 4pt
  BEFORE_ITEM_TITLE: 120,     // 6pt — gap between job entries within a section
  BETWEEN_BULLETS: 20,        // 1pt — tight gap between bullets
  BULLET_LINE_HEIGHT: 260,    // 13pt — line height for ~11pt body text
} as const;

const FONT_SUBSTITUTION_MAP: Record<string, string> = {
  'Helvetica': 'Arial',
  'Helvetica-Bold': 'Arial',
  'Helvetica-Oblique': 'Arial',
  'Times-Roman': 'Times New Roman',
  'Times-Bold': 'Times New Roman',
  'TimesNewRomanPS-BoldMT': 'Times New Roman',
  'TimesNewRomanPSMT': 'Times New Roman',
  'CourierNewPSMT': 'Courier New',
  'Garamond': 'Times New Roman',
  'Georgia': 'Times New Roman',
  'Gotham': 'Calibri',
  'Gotham-Book': 'Calibri',
  'Lato': 'Calibri',
  'Roboto': 'Calibri',
  'OpenSans': 'Calibri',
  'Gill Sans': 'Calibri',
  'Futura': 'Calibri',
  'ArialMT': 'Arial',
  'Arial-BoldMT': 'Arial',
  'Arial-ItalicMT': 'Arial',
};

export function normalizeFontName(raw: string): string {
  const stripped = raw.replace(/^[A-Z]{6}\+/, '');
  // If the font name is an encoded PDF reference (e.g., g_d0_f1), use Calibri
  if (/^g_d\d+_f\d+$/.test(stripped)) return 'Calibri';
  return FONT_SUBSTITUTION_MAP[stripped] ?? stripped;
}

export function spacingFromStyle(style: TextStyle): { before?: number; after?: number; line?: number; lineRule?: LineRuleType } {
  const result: { before?: number; after?: number; line?: number; lineRule?: LineRuleType } = {};
  if (style.spaceBefore != null) result.before = Math.round(style.spaceBefore * 20);
  if (style.spaceAfter != null) result.after = Math.round(style.spaceAfter * 20);
  if (style.lineSpacingPt != null) {
    result.line = Math.round(style.lineSpacingPt * 20);
    result.lineRule = LineRuleType.EXACT;
  }
  return result;
}

export function selectBulletText(bulletText: string, rewritten: RewrittenBullet | undefined): string {
  return rewritten?.approved ? rewritten.rewritten : bulletText;
}

function textRunFromStyle(text: string, style: TextStyle): TextRun {
  return new TextRun({
    text,
    font: normalizeFontName(style.fontName),
    size: style.fontSize,                     // half-points: 1:1 with OOXML
    bold: style.bold,
    italics: style.italic,
    color: style.color.replace('#', ''),      // strip leading #
  });
}

/** Detect email addresses in text */
const EMAIL_RE = /[\w.+-]+@[\w.-]+\.\w+/g;
/** Detect URLs in text */
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[\w.-]+\.\w+(?:\/[\w\-./?=&#%]*)?/gi;

/**
 * Build paragraph children with hyperlinks for emails and URLs.
 * Returns an array of TextRun and ExternalHyperlink elements.
 */
function buildHeaderRunsWithLinks(text: string, style: TextStyle): (TextRun | ExternalHyperlink)[] {
  const links: { start: number; end: number; href: string; text: string }[] = [];

  for (const match of text.matchAll(EMAIL_RE)) {
    links.push({
      start: match.index,
      end: match.index + match[0].length,
      href: `mailto:${match[0]}`,
      text: match[0],
    });
  }
  for (const match of text.matchAll(URL_RE)) {
    const overlaps = links.some((l) => match.index < l.end && match.index + match[0].length > l.start);
    if (overlaps) continue;
    const href = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
    links.push({
      start: match.index,
      end: match.index + match[0].length,
      href,
      text: match[0],
    });
  }

  if (links.length === 0) {
    return [textRunFromStyle(text, style)];
  }

  links.sort((a, b) => a.start - b.start);
  const children: (TextRun | ExternalHyperlink)[] = [];
  let cursor = 0;

  for (const link of links) {
    if (cursor < link.start) {
      children.push(textRunFromStyle(text.slice(cursor, link.start), style));
    }
    children.push(new ExternalHyperlink({
      link: link.href,
      children: [new TextRun({
        text: link.text,
        font: normalizeFontName(style.fontName),
        size: style.fontSize,
        bold: style.bold,
        italics: style.italic,
        color: '0563C1',
        underline: { type: 'single' },
        style: 'Hyperlink',
      })],
    }));
    cursor = link.end;
  }

  if (cursor < text.length) {
    children.push(textRunFromStyle(text.slice(cursor), style));
  }

  return children;
}

/** Build a paragraph for a title/subtitle line, with optional right-aligned text via tab stop */
function buildTitleParagraph(
  leftText: string,
  leftStyle: TextStyle,
  rightText: string | undefined,
  rightStyle: TextStyle | undefined,
  contentWidthTwips: number,
  spaceBeforeTwips?: number,
): Paragraph {
  const children: TextRun[] = [textRunFromStyle(leftText, leftStyle)];

  if (rightText && rightStyle) {
    children.push(new TextRun({ text: '\t', font: normalizeFontName(leftStyle.fontName), size: leftStyle.fontSize }));
    children.push(textRunFromStyle(rightText, rightStyle));
  }

  const spacing = spacingFromStyle(leftStyle);

  return new Paragraph({
    children,
    spacing: {
      ...spacing,
      ...(spaceBeforeTwips != null ? { before: spacing.before ?? spaceBeforeTwips } : {}),
    },
    tabStops: rightText ? [{ type: TabStopType.RIGHT, position: contentWidthTwips }] : undefined,
  });
}

export async function generateDocx(
  structure: ResumeStructure,
  bullets: RewrittenBullet[],
): Promise<Buffer> {
  const bulletMap = new Map(bullets.map(b => [b.id, b]));
  const children: Paragraph[] = [];
  const { meta } = structure;
  const pageWidthTwips = Math.round(meta.pageWidth * 20);
  const marginLeftTwips = Math.round(meta.marginLeft * 20);
  const marginRightTwips = Math.round(meta.marginRight * 20);
  const contentWidthTwips = pageWidthTwips - marginLeftTwips - marginRightTwips;

  // Header lines — centered, with hyperlinks for emails/URLs
  for (let i = 0; i < structure.header.length; i++) {
    const line = structure.header[i]!;
    const isLast = i === structure.header.length - 1;
    children.push(new Paragraph({
      children: buildHeaderRunsWithLinks(line.text, line.style),
      spacing: {
        ...spacingFromStyle(line.style),
        after: isLast ? SPACING.AFTER_HEADER : 0,
      },
      alignment: AlignmentType.CENTER,
    }));
  }

  // Sections
  for (const section of structure.sections) {
    // Section heading — bold, with bottom border (horizontal rule)
    children.push(new Paragraph({
      children: [new TextRun({
        text: section.heading,
        font: normalizeFontName(section.headingStyle.fontName),
        size: section.headingStyle.fontSize,
        bold: true,
        italics: section.headingStyle.italic,
        color: section.headingStyle.color.replace('#', ''),
      })],
      spacing: { ...spacingFromStyle(section.headingStyle), before: 200, after: 80 },
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
      },
    }));

    for (let itemIdx = 0; itemIdx < section.items.length; itemIdx++) {
      const item = section.items[itemIdx]!;
      const isFirstItem = itemIdx === 0;
      if (item.title && item.titleStyle) {
        children.push(buildTitleParagraph(
          item.title, item.titleStyle,
          item.titleRight, item.titleRightStyle,
          contentWidthTwips,
          isFirstItem ? undefined : SPACING.BEFORE_ITEM_TITLE,
        ));
      }
      if (item.subtitle && item.subtitleStyle) {
        children.push(buildTitleParagraph(
          item.subtitle, item.subtitleStyle,
          item.subtitleRight, item.subtitleRightStyle,
          contentWidthTwips,
        ));
      }
      for (const bullet of item.bullets) {
        const rewritten = bulletMap.get(bullet.id);
        const text = selectBulletText(bullet.text, rewritten);
        const bulletSpacing = spacingFromStyle(bullet.style);
        children.push(new Paragraph({
          numbering: { reference: BULLET_REF, level: 0 },
          children: [textRunFromStyle(text, bullet.style)],
          spacing: {
            ...bulletSpacing,
            after: bulletSpacing.after ?? SPACING.BETWEEN_BULLETS,
            line: bulletSpacing.line ?? SPACING.BULLET_LINE_HEIGHT,
            lineRule: bulletSpacing.lineRule ?? LineRuleType.EXACT,
          },
        }));
      }
    }
  }

  const doc = new Document({
    numbering: {
      config: [{
        reference: BULLET_REF,
        levels: [{
          level: 0,
          format: LevelFormat.BULLET,
          text: '\u2022',
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        }],
      }],
    },
    sections: [{
      properties: {
        page: {
          size: {
            width:  pageWidthTwips,
            height: Math.round(meta.pageHeight * 20),
          },
          margin: {
            top:    Math.round(meta.marginTop    * 20),
            bottom: Math.round(meta.marginBottom * 20),
            left:   marginLeftTwips,
            right:  marginRightTwips,
          },
        },
      },
      children,
    }],
  });

  const buf = await Packer.toBuffer(doc);
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}
