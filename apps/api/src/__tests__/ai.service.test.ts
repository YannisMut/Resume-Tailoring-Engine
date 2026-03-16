import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AiTimeoutError } from '../middleware/error.middleware.js';
import type { Bullet, ResumeStructure } from '@resume/types';

const mockGenerateContent = vi.fn();

vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: class MockGoogleGenerativeAI {
    getGenerativeModel() {
      return { generateContent: mockGenerateContent };
    }
  },
}));

// Import after mock setup
import { rewriteBullet, rewriteAllBullets, SYSTEM_PROMPT, KEYWORD_EXTRACTION_PROMPT, extractKeywords } from '../services/ai.service.js';
import type { ExtractedKeyword } from '../services/ai.service.js';

// --- Fixtures ---

const BULLET_FIXTURE: Bullet = {
  id: 'experience-0-item-0-bullet-0',
  text: 'Built backend services for e-commerce platform',
  style: {
    fontName: 'Calibri',
    fontSize: 11,
    bold: false,
    italic: false,
    color: '#000000',
  },
};

const BULLET_FIXTURE_2: Bullet = {
  id: 'experience-0-item-0-bullet-1',
  text: 'Improved team velocity through process changes',
  style: {
    fontName: 'Calibri',
    fontSize: 11,
    bold: false,
    italic: false,
    color: '#000000',
  },
};

const STYLE_FIXTURE = {
  fontName: 'Calibri',
  fontSize: 22,
  bold: true,
  italic: false,
  color: '#000000',
};

const RESUME_FIXTURE: ResumeStructure = {
  meta: {
    pageWidth: 612,
    pageHeight: 792,
    marginTop: 72,
    marginBottom: 72,
    marginLeft: 72,
    marginRight: 72,
  },
  header: [],
  sections: [
    {
      id: 'experience-0',
      heading: 'Experience',
      headingStyle: STYLE_FIXTURE,
      items: [
        {
          id: 'experience-0-item-0',
          bullets: [BULLET_FIXTURE, BULLET_FIXTURE_2],
        },
      ],
    },
  ],
};

function mockBatchResponse(texts: string[]) {
  mockGenerateContent.mockResolvedValue({
    response: { text: () => JSON.stringify(texts) },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

const KW_TS: ExtractedKeyword = { keyword: 'typescript', aliases: [], priority: 'required', category: 'hard_skill' };
const KW_MICRO: ExtractedKeyword = { keyword: 'microservices', aliases: [], priority: 'preferred', category: 'domain_term' };
const KW_PYTHON: ExtractedKeyword = { keyword: 'python', aliases: [], priority: 'required', category: 'hard_skill' };

describe('rewriteBullet', () => {
  it('returns RewrittenBullet with correct shape on success', async () => {
    mockBatchResponse(['Developed scalable backend microservices for e-commerce platform']);

    const result = await rewriteBullet(BULLET_FIXTURE, 'typescript developer role', [KW_TS, KW_MICRO]);

    expect(result.id).toBe(BULLET_FIXTURE.id);
    expect(result.original).toBe(BULLET_FIXTURE.text);
    expect(result.rewritten).toBe('Developed scalable backend microservices for e-commerce platform');
    expect(result.approved).toBe(false);
  });

  it('trims whitespace from Gemini response', async () => {
    mockBatchResponse(['  Improved bullet with extra whitespace  ']);

    const result = await rewriteBullet(BULLET_FIXTURE, 'jd', []);

    expect(result.rewritten).toBe('Improved bullet with extra whitespace');
  });

  it('falls back to bullet.text when response.text() throws (blocked/empty response)', async () => {
    mockGenerateContent.mockResolvedValue({
      response: {
        text: () => {
          throw new Error('Response was blocked');
        },
      },
    });

    const result = await rewriteBullet(BULLET_FIXTURE, 'jd', []);

    expect(result.rewritten).toBe(BULLET_FIXTURE.text);
    expect(result.original).toBe(BULLET_FIXTURE.text);
  });
});

describe('rewriteAllBullets', () => {
  it('returns one RewrittenBullet per bullet across all sections and items (AI-01)', async () => {
    mockBatchResponse(['Rewritten bullet 1', 'Rewritten bullet 2']);

    const results = await rewriteAllBullets(RESUME_FIXTURE, 'developer role', [KW_TS]);

    expect(results).toHaveLength(2);
    expect(results[0]!.id).toBe(BULLET_FIXTURE.id);
    expect(results[0]!.rewritten).toBe('Rewritten bullet 1');
    expect(results[1]!.id).toBe(BULLET_FIXTURE_2.id);
    expect(results[1]!.rewritten).toBe('Rewritten bullet 2');
    // Only one API call for all bullets
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('falls back to originals when JSON array length does not match bullet count', async () => {
    mockBatchResponse(['Only one rewrite']);

    const results = await rewriteAllBullets(RESUME_FIXTURE, 'developer role', [KW_TS]);

    expect(results).toHaveLength(2);
    expect(results[0]!.rewritten).toBe(BULLET_FIXTURE.text);
    expect(results[1]!.rewritten).toBe(BULLET_FIXTURE_2.text);
  });

  it('falls back to originals when response is not valid JSON', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'not json at all' },
    });

    const results = await rewriteAllBullets(RESUME_FIXTURE, 'developer role', [KW_TS]);

    expect(results).toHaveLength(2);
    expect(results[0]!.rewritten).toBe(BULLET_FIXTURE.text);
    expect(results[1]!.rewritten).toBe(BULLET_FIXTURE_2.text);
  });

  it('includes skills section context in the user prompt', async () => {
    mockBatchResponse(['Rewritten bullet 1', 'Rewritten bullet 2']);

    const resumeWithSkills: ResumeStructure = {
      ...RESUME_FIXTURE,
      sections: [
        ...RESUME_FIXTURE.sections,
        {
          id: 'skills-0',
          heading: 'SKILLS AND INTERESTS',
          headingStyle: STYLE_FIXTURE,
          items: [
            {
              id: 'skills-0-item-0',
              title: 'Computer skills: Proficient in Python; familiar with HTML, CSS, Java, Figma',
              bullets: [],
            },
          ],
        },
      ],
    };

    await rewriteAllBullets(resumeWithSkills, 'developer role', [KW_PYTHON]);

    const callArg = mockGenerateContent.mock.calls[0]![0] as { contents: Array<{ parts: Array<{ text: string }> }> };
    const promptText = callArg.contents[0]!.parts[0]!.text;
    expect(promptText).toContain('Computer skills: Proficient in Python');
    expect(promptText).toContain("do not redundantly add these to bullets");
  });

  it('includes section and title context in the user prompt', async () => {
    mockBatchResponse(['Rewritten bullet 1', 'Rewritten bullet 2']);

    await rewriteAllBullets(RESUME_FIXTURE, 'developer role', [KW_TS]);

    const callArg = mockGenerateContent.mock.calls[0]![0] as { contents: Array<{ parts: Array<{ text: string }> }> };
    const promptText = callArg.contents[0]!.parts[0]!.text;
    // Bullets should have [section | title] context prefix
    expect(promptText).toContain('[Experience]');
  });

  it('formats gap keywords with REQUIRED/PREFERRED tags in the prompt', async () => {
    mockBatchResponse(['Rewritten bullet 1', 'Rewritten bullet 2']);
    const kwRequired: ExtractedKeyword = { keyword: 'docker', aliases: [], priority: 'required', category: 'tool' };
    const kwPreferred: ExtractedKeyword = { keyword: 'terraform', aliases: [], priority: 'preferred', category: 'tool' };

    await rewriteAllBullets(RESUME_FIXTURE, 'developer role', [kwRequired, kwPreferred]);

    const callArg = mockGenerateContent.mock.calls[0]![0] as { contents: Array<{ parts: Array<{ text: string }> }> };
    const promptText = callArg.contents[0]!.parts[0]!.text;
    expect(promptText).toContain('[REQUIRED] docker');
    expect(promptText).toContain('[PREFERRED] terraform');
  });
});

describe('SYSTEM_PROMPT content (AI-02)', () => {
  it('contains explicit prohibition against inventing metrics', () => {
    expect(SYSTEM_PROMPT).toContain('Do NOT invent');
  });

  it('instructs to incorporate gap keywords', () => {
    expect(SYSTEM_PROMPT).toContain('INCORPORATE gap keywords');
  });

  it('prohibits fabricating new experiences', () => {
    expect(SYSTEM_PROMPT).toContain('Do NOT fabricate');
  });

  it('instructs to improve writing quality even when no keyword fits', () => {
    expect(SYSTEM_PROMPT).toContain('never return a bullet completely unchanged');
  });
});

describe('extractKeywords', () => {
  it('returns array of ExtractedKeyword objects on success', async () => {
    const mockKeywords: ExtractedKeyword[] = [
      { keyword: 'Python', aliases: ['py'], priority: 'required', category: 'hard_skill' },
      { keyword: 'machine learning', aliases: ['ML'], priority: 'preferred', category: 'domain_term' },
      { keyword: 'AWS', aliases: ['Amazon Web Services'], priority: 'required', category: 'tool' },
    ];
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(mockKeywords) },
    });

    const result = await extractKeywords('Looking for a Python developer with machine learning and AWS experience');

    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject({ keyword: 'Python', priority: 'required', category: 'hard_skill' });
    expect(result[1]).toMatchObject({ keyword: 'machine learning', priority: 'preferred', category: 'domain_term' });
    expect(result[2]).toMatchObject({ keyword: 'AWS', priority: 'required', category: 'tool' });
  });

  it('preserves canonical keyword form (does not lowercase)', async () => {
    const mockKeywords: ExtractedKeyword[] = [
      { keyword: 'Python', aliases: [], priority: 'required', category: 'hard_skill' },
      { keyword: 'AWS', aliases: [], priority: 'required', category: 'tool' },
    ];
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify(mockKeywords) },
    });

    const result = await extractKeywords('some jd text');

    expect(result[0]!.keyword).toBe('Python');
    expect(result[1]!.keyword).toBe('AWS');
  });

  it('normalises unknown priority to "preferred"', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify([{ keyword: 'Docker', aliases: [], priority: 'unknown', category: 'tool' }]) },
    });

    const result = await extractKeywords('some jd text');

    expect(result[0]!.priority).toBe('preferred');
  });

  it('normalises unknown category to "hard_skill"', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => JSON.stringify([{ keyword: 'Docker', aliases: [], priority: 'required', category: 'bogus' }]) },
    });

    const result = await extractKeywords('some jd text');

    expect(result[0]!.category).toBe('hard_skill');
  });

  it('falls back to tokenized keywords when Gemini returns invalid JSON', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'not json at all' },
    });

    const result = await extractKeywords('Python developer with AWS experience');

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((kw) => kw.keyword === 'python')).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('non-JSON'), expect.anything());
    warnSpy.mockRestore();
  });

  it('falls back to tokenized keywords when Gemini returns non-array', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGenerateContent.mockResolvedValue({
      response: { text: () => '{"keywords": ["python"]}' },
    });

    const result = await extractKeywords('Python developer with AWS experience');

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((kw) => kw.keyword === 'python')).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('invalid structure'), expect.anything());
    warnSpy.mockRestore();
  });

  it('falls back when response.text() throws', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockGenerateContent.mockResolvedValue({
      response: { text: () => { throw new Error('blocked'); } },
    });

    const result = await extractKeywords('Python developer');

    expect(result.length).toBeGreaterThan(0);
    expect(result.some((kw) => kw.keyword === 'python')).toBe(true);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('blocked/empty'), expect.anything());
    warnSpy.mockRestore();
  });
});

describe('withRetry — retry behavior (AI-03, AI-04)', () => {
  it('retries 3 times on repeated transient failure then throws', async () => {
    vi.useFakeTimers();

    const transientError = new Error('Service Unavailable');
    (transientError as unknown as { status: number }).status = 503;

    mockGenerateContent.mockRejectedValue(transientError);

    const promise = rewriteAllBullets(RESUME_FIXTURE, 'jd', []);
    const assertion = expect(promise).rejects.toThrow('Service Unavailable');

    // Advance through backoff delays: 20s after attempt 1, 30s after attempt 2
    await vi.advanceTimersByTimeAsync(20_000);
    await vi.advanceTimersByTimeAsync(30_000);

    await assertion;
    expect(mockGenerateContent).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('does NOT retry when error has status 400 (permanent error)', async () => {
    const permanentError = new Error('Bad Request');
    (permanentError as unknown as { status: number }).status = 400;

    mockGenerateContent.mockRejectedValue(permanentError);

    await expect(rewriteAllBullets(RESUME_FIXTURE, 'jd', [])).rejects.toThrow('Bad Request');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry when error has status 401 (permanent error)', async () => {
    const permanentError = new Error('Unauthorized');
    (permanentError as unknown as { status: number }).status = 401;

    mockGenerateContent.mockRejectedValue(permanentError);

    await expect(rewriteAllBullets(RESUME_FIXTURE, 'jd', [])).rejects.toThrow('Unauthorized');
    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
  });

  it('throws AiTimeoutError when generateContent never resolves within timeout', async () => {
    vi.useFakeTimers();

    // Never resolves
    mockGenerateContent.mockImplementation(() => new Promise(() => {}));

    const promise = rewriteAllBullets(RESUME_FIXTURE, 'jd', []);
    const assertion = expect(promise).rejects.toBeInstanceOf(AiTimeoutError);

    await vi.advanceTimersByTimeAsync(60_000);

    await assertion;

    vi.useRealTimers();
  });
});
