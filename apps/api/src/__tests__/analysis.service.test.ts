import { describe, it, expect } from 'vitest';
import { analyzeResume } from '../services/analysis.service.js';

const RESUME = {
  meta: { pageWidth: 612, pageHeight: 792, marginTop: 72, marginBottom: 72, marginLeft: 72, marginRight: 72 },
  header: [{ text: 'Jane Doe', style: { fontName: 'Calibri', fontSize: 28, bold: true, italic: false, color: '#000000' } }],
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
              text: 'Built TypeScript React applications with Node.js backend',
              style: { fontName: 'Calibri', fontSize: 22, bold: false, italic: false, color: '#000000' },
            },
          ],
        },
      ],
    },
  ],
};

describe('analyzeResume()', () => {
  it('returns score between 0 and 100', async () => {
    const result = await analyzeResume(RESUME, 'TypeScript React developer with Node.js experience');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns score 0 when JD has only stop words', async () => {
    const result = await analyzeResume(RESUME, 'the and or is a an');
    expect(result.score).toBe(0);
  });

  it('returns score 100 when all JD tokens are in the resume', async () => {
    const result = await analyzeResume(RESUME, 'typescript react');
    expect(result.score).toBe(100);
  });

  it('returns an integer score (no decimals)', async () => {
    const result = await analyzeResume(RESUME, 'TypeScript React developer with Node.js experience');
    expect(result.score).toBe(Math.round(result.score));
  });

  it('returns gaps as an array of strings', async () => {
    const result = await analyzeResume(RESUME, 'TypeScript React Kubernetes');
    expect(Array.isArray(result.gaps)).toBe(true);
    result.gaps.forEach((gap: unknown) => expect(typeof gap).toBe('string'));
  });

  it('returns only tokens in JD but absent from resume in gaps', async () => {
    const result = await analyzeResume(RESUME, 'typescript kubernetes');
    // 'typescript' is in resume bullets; 'kubernetes' is not
    expect(result.gaps).not.toContain('typescript');
    expect(result.gaps).toContain('kubernetes');
  });

  it('returns no duplicate entries in gaps', async () => {
    const result = await analyzeResume(RESUME, 'kubernetes kubernetes python');
    const unique = [...new Set(result.gaps)];
    expect(result.gaps.length).toBe(unique.length);
  });

  it('returns rewrites as an empty array', async () => {
    const result = await analyzeResume(RESUME, 'TypeScript React developer');
    expect(result.rewrites).toEqual([]);
  });

  it('returns the original resumeStructure in the result', async () => {
    const result = await analyzeResume(RESUME, 'TypeScript React developer');
    expect(result.resumeStructure).toBe(RESUME);
  });
});
