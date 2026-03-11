import {
  Document, Packer, Paragraph, TextRun, LineRuleType,
  LevelFormat, AlignmentType,
} from 'docx';
import type { ResumeStructure, TextStyle } from '@resume/types';
import type { RewrittenBullet } from '@resume/types';

const BULLET_REF = 'resume-bullet';

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

export async function generateDocx(
  structure: ResumeStructure,
  bullets: RewrittenBullet[],
): Promise<Buffer> {
  const bulletMap = new Map(bullets.map(b => [b.id, b]));
  const children: Paragraph[] = [];

  // Header lines
  for (const line of structure.header) {
    children.push(new Paragraph({
      children: [textRunFromStyle(line.text, line.style)],
      spacing: spacingFromStyle(line.style),
    }));
  }

  // Sections
  for (const section of structure.sections) {
    // Section heading
    children.push(new Paragraph({
      children: [textRunFromStyle(section.heading, section.headingStyle)],
      spacing: spacingFromStyle(section.headingStyle),
    }));

    for (const item of section.items) {
      if (item.title && item.titleStyle) {
        children.push(new Paragraph({
          children: [textRunFromStyle(item.title, item.titleStyle)],
          spacing: spacingFromStyle(item.titleStyle),
        }));
      }
      if (item.subtitle && item.subtitleStyle) {
        children.push(new Paragraph({
          children: [textRunFromStyle(item.subtitle, item.subtitleStyle)],
          spacing: spacingFromStyle(item.subtitleStyle),
        }));
      }
      for (const bullet of item.bullets) {
        const rewritten = bulletMap.get(bullet.id);
        const text = selectBulletText(bullet.text, rewritten);
        children.push(new Paragraph({
          numbering: { reference: BULLET_REF, level: 0 },
          children: [textRunFromStyle(text, bullet.style)],
          spacing: spacingFromStyle(bullet.style),
        }));
      }
    }
  }

  const { meta } = structure;
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
            width:  Math.round(meta.pageWidth  * 20),
            height: Math.round(meta.pageHeight * 20),
          },
          margin: {
            top:    Math.round(meta.marginTop    * 20),
            bottom: Math.round(meta.marginBottom * 20),
            left:   Math.round(meta.marginLeft   * 20),
            right:  Math.round(meta.marginRight  * 20),
          },
        },
      },
      children,
    }],
  });

  const buf = await Packer.toBuffer(doc);
  // Defensive: older jszip versions may return Uint8Array
  return Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
}
