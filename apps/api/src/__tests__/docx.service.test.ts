import { describe, it, expect } from 'vitest';
import { LineRuleType } from 'docx';
import type { TextStyle, ResumeStructure, RewrittenBullet } from '@resume/types';

// Import functions under test — these will fail (module not found) until Plan 02 creates the service.
// That import failure IS the RED state confirming these are real contracts.
import {
  generateDocx,
  normalizeFontName,
  spacingFromStyle,
  selectBulletText,
} from '../services/docx.service.js';

// --- Fixtures ---

const STYLE: TextStyle = {
  fontName: 'Calibri',
  fontSize: 24,
  bold: false,
  italic: false,
  color: '#000000',
};

const STRUCTURE: ResumeStructure = {
  meta: {
    pageWidth: 612,
    pageHeight: 792,
    marginTop: 72,
    marginBottom: 72,
    marginLeft: 72,
    marginRight: 72,
  },
  header: [{ text: 'Jane Doe', style: { ...STYLE, bold: true, fontSize: 36 } }],
  sections: [
    {
      id: 'exp-0',
      heading: 'Experience',
      headingStyle: STYLE,
      items: [
        {
          id: 'exp-0-item-0',
          bullets: [{ id: 'exp-0-item-0-bullet-0', text: 'Original text', style: STYLE }],
        },
      ],
    },
  ],
};

const APPROVED_BULLET: RewrittenBullet = {
  id: 'exp-0-item-0-bullet-0',
  original: 'Original text',
  rewritten: 'Rewritten text',
  approved: true,
};

const UNAPPROVED_BULLET: RewrittenBullet = {
  id: 'exp-0-item-0-bullet-0',
  original: 'Original text',
  rewritten: 'Rewritten text',
  approved: false,
};

// --- generateDocx (OUT-01) ---

describe('generateDocx', () => {
  it('returns a Buffer (not undefined, not Uint8Array)', async () => {
    const result = await generateDocx(STRUCTURE, [APPROVED_BULLET]);
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('returns a non-empty Buffer', async () => {
    const result = await generateDocx(STRUCTURE, [APPROVED_BULLET]);
    expect(result.length).toBeGreaterThan(0);
  });
});

// --- selectBulletText (pure helper) ---

describe('selectBulletText', () => {
  it('uses rewritten text when bullet is approved', () => {
    const result = selectBulletText('Original text', APPROVED_BULLET);
    expect(result).toBe('Rewritten text');
  });

  it('uses original text when bullet is not approved', () => {
    const result = selectBulletText('Original text', UNAPPROVED_BULLET);
    expect(result).toBe('Original text');
  });

  it('falls back to bulletText when rewrittenBullet is undefined', () => {
    const result = selectBulletText('Original text', undefined);
    expect(result).toBe('Original text');
  });
});

// --- normalizeFontName (pure helper) ---

describe('normalizeFontName', () => {
  it('strips subset prefix ABCDEF+ from font name', () => {
    expect(normalizeFontName('ABCDEF+Calibri')).toBe('Calibri');
  });

  it('passes through font names with no subset prefix unchanged', () => {
    expect(normalizeFontName('Calibri')).toBe('Calibri');
  });

  it('substitutes Garamond with Times New Roman', () => {
    expect(normalizeFontName('Garamond')).toBe('Times New Roman');
  });

  it('strips subset prefix then applies substitution', () => {
    expect(normalizeFontName('XYZABC+Garamond')).toBe('Times New Roman');
  });
});

// --- spacingFromStyle (pure helper) ---

describe('spacingFromStyle', () => {
  it('converts spaceBefore 12pt to 240 TWIPs (× 20)', () => {
    const result = spacingFromStyle({ ...STYLE, spaceBefore: 12 });
    expect(result.before).toBe(240);
  });

  it('converts spaceAfter 6pt to 120 TWIPs (× 20)', () => {
    const result = spacingFromStyle({ ...STYLE, spaceAfter: 6 });
    expect(result.after).toBe(120);
  });

  it('converts lineSpacingPt 14 to 280 TWIPs (× 20) with LineRuleType.EXACT', () => {
    const result = spacingFromStyle({ ...STYLE, lineSpacingPt: 14 });
    expect(result.line).toBe(280);
    expect(result.lineRule).toBe(LineRuleType.EXACT);
  });

  it('returns empty object when style has no spacing fields', () => {
    const result = spacingFromStyle(STYLE);
    expect(result.before).toBeUndefined();
    expect(result.after).toBeUndefined();
    expect(result.line).toBeUndefined();
  });
});
