import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ExtractedKeyword } from '../services/ai.service.js';

function kw(keyword: string, priority: 'required' | 'preferred' = 'required'): ExtractedKeyword {
  return { keyword, aliases: [], priority, category: 'hard_skill' };
}

// Mock ai.service so analyzeResume tests don't require a real Gemini API key
vi.mock('../services/ai.service.js', () => ({
  rewriteAllBullets: vi.fn().mockResolvedValue([]),
  extractKeywords: vi.fn().mockResolvedValue([
    { keyword: 'typescript', aliases: [], priority: 'required', category: 'hard_skill' },
    { keyword: 'react', aliases: [], priority: 'required', category: 'hard_skill' },
    { keyword: 'kubernetes', aliases: [], priority: 'required', category: 'tool' },
  ]),
}));

import { analyzeResume } from '../services/analysis.service.js';
import { extractKeywords } from '../services/ai.service.js';
const mockExtractKeywords = vi.mocked(extractKeywords);

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
    mockExtractKeywords.mockResolvedValueOnce([kw('typescript'), kw('react'), kw('node')]);
    const result = await analyzeResume(RESUME, 'TypeScript React developer with Node.js experience');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('returns score 0 when JD has only stop words', async () => {
    mockExtractKeywords.mockResolvedValueOnce([]);
    const result = await analyzeResume(RESUME, 'the and or is a an');
    expect(result.score).toBe(0);
  });

  it('returns score 100 when all JD tokens are in the resume', async () => {
    mockExtractKeywords.mockResolvedValueOnce([kw('typescript'), kw('react')]);
    const result = await analyzeResume(RESUME, 'typescript react');
    expect(result.score).toBe(100);
  });

  it('returns an integer score (no decimals)', async () => {
    mockExtractKeywords.mockResolvedValueOnce([kw('typescript'), kw('react'), kw('python')]);
    const result = await analyzeResume(RESUME, 'TypeScript React Python developer');
    expect(result.score).toBe(Math.round(result.score));
  });

  it('returns gaps as an array of strings', async () => {
    mockExtractKeywords.mockResolvedValueOnce([kw('typescript'), kw('react'), kw('kubernetes')]);
    const result = await analyzeResume(RESUME, 'TypeScript React Kubernetes');
    expect(Array.isArray(result.gaps)).toBe(true);
    result.gaps.forEach((gap: unknown) => expect(typeof gap).toBe('string'));
  });

  it('returns only tokens in JD but absent from resume in gaps', async () => {
    mockExtractKeywords.mockResolvedValueOnce([kw('typescript'), kw('kubernetes')]);
    const result = await analyzeResume(RESUME, 'typescript kubernetes');
    // 'typescript' is in resume bullets; 'kubernetes' is not
    expect(result.gaps).not.toContain('typescript');
    expect(result.gaps).toContain('kubernetes');
  });

  it('returns no duplicate entries in gaps', async () => {
    mockExtractKeywords.mockResolvedValueOnce([kw('kubernetes'), kw('python')]);
    const result = await analyzeResume(RESUME, 'kubernetes kubernetes python');
    const unique = [...new Set(result.gaps)];
    expect(result.gaps.length).toBe(unique.length);
  });

  it('returns rewrites as an empty array', async () => {
    mockExtractKeywords.mockResolvedValueOnce([kw('typescript'), kw('react')]);
    const result = await analyzeResume(RESUME, 'TypeScript React developer');
    expect(result.rewrites).toEqual([]);
  });

  it('returns the original resumeStructure in the result', async () => {
    mockExtractKeywords.mockResolvedValueOnce([kw('typescript'), kw('react')]);
    const result = await analyzeResume(RESUME, 'TypeScript React developer');
    expect(result.resumeStructure).toBe(RESUME);
  });

  it('supports multi-word phrase matching in gaps', async () => {
    mockExtractKeywords.mockResolvedValueOnce([kw('machine learning'), kw('typescript')]);
    const result = await analyzeResume(RESUME, 'machine learning typescript');
    // 'typescript' is in resume bullets; 'machine learning' is not
    expect(result.gaps).toContain('machine learning');
    expect(result.gaps).not.toContain('typescript');
  });

  it('matches keyword via alias', async () => {
    const kwWithAlias: ExtractedKeyword = { keyword: 'Kubernetes', aliases: ['K8s'], priority: 'required', category: 'tool' };
    mockExtractKeywords.mockResolvedValueOnce([kwWithAlias]);
    // Resume doesn't contain "kubernetes" but this test verifies alias matching works
    // by using an alias present in the resume text
    const resumeWithK8s = {
      ...RESUME,
      sections: [{
        ...RESUME.sections[0]!,
        items: [{ ...RESUME.sections[0]!.items[0]!, bullets: [{ id: 'b1', text: 'Deployed services on K8s clusters', style: RESUME.sections[0]!.items[0]!.bullets[0]!.style }] }],
      }],
    };
    const result = await analyzeResume(resumeWithK8s, 'Kubernetes required');
    expect(result.gaps).not.toContain('kubernetes');
    expect(result.score).toBe(100);
  });

  it('sorts required gaps before preferred gaps', async () => {
    mockExtractKeywords.mockResolvedValueOnce([
      kw('python', 'preferred'),
      kw('kubernetes', 'required'),
      kw('docker', 'preferred'),
    ]);
    const result = await analyzeResume(RESUME, 'python kubernetes docker');
    // All are missing from resume — required should come first
    expect(result.gaps[0]).toBe('kubernetes');
  });

  it('does not match partial words (word-boundary check)', async () => {
    // "Go" should not match inside "Google" or "algorithm"
    const kwGo: ExtractedKeyword = { keyword: 'Go', aliases: ['Golang'], priority: 'required', category: 'hard_skill' };
    mockExtractKeywords.mockResolvedValueOnce([kwGo]);
    const resumeWithGoogle = {
      ...RESUME,
      sections: [{
        ...RESUME.sections[0]!,
        items: [{ ...RESUME.sections[0]!.items[0]!, bullets: [{ id: 'b1', text: 'Used Google Cloud and algorithms', style: RESUME.sections[0]!.items[0]!.bullets[0]!.style }] }],
      }],
    };
    const result = await analyzeResume(resumeWithGoogle, 'Go developer');
    // "go" should NOT match in "google" or "algorithms"
    expect(result.gaps).toContain('go');
  });
});
