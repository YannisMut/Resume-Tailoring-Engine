import { describe, it, expect } from 'vitest';

// These imports will fail until packages/types/src/index.ts is created in Plan 02.
// That is intentional — Wave 0 establishes the test contract before implementation.
import {
  ResumeStructureSchema,
  HeaderLineSchema,
  RewrittenBulletSchema,
  AnalysisResultSchema,
} from '../index';

const validTextStyle = {
  fontName: 'Calibri',
  fontSize: 24,
  bold: false,
  italic: false,
  color: '#000000',
};

const validBullet = {
  id: 'experience-0-item-0-bullet-0',
  text: 'Led a team of 5 engineers',
  style: validTextStyle,
};

const validSectionItem = {
  id: 'experience-0-item-0',
  bullets: [validBullet],
};

const validSection = {
  id: 'experience-0',
  heading: 'WORK EXPERIENCE',
  headingStyle: validTextStyle,
  items: [validSectionItem],
};

const validHeaderLine = {
  text: 'John Smith',
  style: validTextStyle,
};

const validResumeStructure = {
  meta: {
    pageWidth: 612,
    pageHeight: 792,
    marginTop: 72,
    marginBottom: 72,
    marginLeft: 72,
    marginRight: 72,
  },
  sections: [validSection],
  header: [validHeaderLine],
};

describe('ResumeStructureSchema', () => {
  it('accepts a valid full ResumeStructure with layout metadata', () => {
    const result = ResumeStructureSchema.safeParse(validResumeStructure);
    expect(result.success).toBe(true);
  });

  it('rejects a structure missing fontName in TextStyle', () => {
    const invalid = {
      ...validResumeStructure,
      sections: [
        {
          ...validSection,
          headingStyle: { fontSize: 24, bold: false, italic: false, color: '#000000' },
        },
      ],
    };
    const result = ResumeStructureSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a structure missing meta.marginTop', () => {
    const { marginTop: _, ...metaWithoutMarginTop } = validResumeStructure.meta;
    const invalid = { ...validResumeStructure, meta: metaWithoutMarginTop };
    const result = ResumeStructureSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('rejects a bullet with a non-string id', () => {
    const invalid = {
      ...validResumeStructure,
      sections: [
        {
          ...validSection,
          items: [
            {
              ...validSectionItem,
              bullets: [{ ...validBullet, id: 42 }],
            },
          ],
        },
      ],
    };
    const result = ResumeStructureSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('accepts a structure with an empty header array', () => {
    const result = ResumeStructureSchema.safeParse({ ...validResumeStructure, header: [] });
    expect(result.success).toBe(true);
  });

  it('rejects a structure missing the header field', () => {
    const { header: _, ...withoutHeader } = validResumeStructure;
    const result = ResumeStructureSchema.safeParse(withoutHeader);
    expect(result.success).toBe(false);
  });

  it('rejects a header line missing the text field', () => {
    const result = ResumeStructureSchema.safeParse({
      ...validResumeStructure,
      header: [{ style: validTextStyle }],
    });
    expect(result.success).toBe(false);
  });
});

describe('HeaderLineSchema', () => {
  it('accepts a valid header line with text and style', () => {
    const result = HeaderLineSchema.safeParse(validHeaderLine);
    expect(result.success).toBe(true);
  });

  it('rejects a header line with no style', () => {
    const result = HeaderLineSchema.safeParse({ text: 'John Smith' });
    expect(result.success).toBe(false);
  });

  it('rejects a header line with no text', () => {
    const result = HeaderLineSchema.safeParse({ style: validTextStyle });
    expect(result.success).toBe(false);
  });
});

describe('RewrittenBulletSchema', () => {
  it('accepts a valid RewrittenBullet', () => {
    const result = RewrittenBulletSchema.safeParse({
      id: 'experience-0-item-0-bullet-0',
      original: 'Led a team',
      rewritten: 'Led a cross-functional team of engineers',
      approved: false,
    });
    expect(result.success).toBe(true);
  });

  it('defaults approved to false when omitted', () => {
    const result = RewrittenBulletSchema.safeParse({
      id: 'experience-0-item-0-bullet-0',
      original: 'Led a team',
      rewritten: 'Led a cross-functional team of engineers',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.approved).toBe(false);
    }
  });
});

describe('AnalysisResultSchema', () => {
  it('accepts a valid AnalysisResult', () => {
    const result = AnalysisResultSchema.safeParse({
      score: 72,
      gaps: ['TypeScript', 'React'],
      rewrites: [],
      resumeStructure: validResumeStructure,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a score below 0', () => {
    const result = AnalysisResultSchema.safeParse({
      score: -1,
      gaps: [],
      rewrites: [],
      resumeStructure: validResumeStructure,
    });
    expect(result.success).toBe(false);
  });

  it('rejects a score above 100', () => {
    const result = AnalysisResultSchema.safeParse({
      score: 101,
      gaps: [],
      rewrites: [],
      resumeStructure: validResumeStructure,
    });
    expect(result.success).toBe(false);
  });
});
