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
import { rewriteBullet, rewriteAllBullets, SYSTEM_PROMPT } from '../services/ai.service.js';

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

describe('rewriteBullet', () => {
  it('returns RewrittenBullet with correct shape on success', async () => {
    mockBatchResponse(['Developed scalable backend microservices for e-commerce platform']);

    const result = await rewriteBullet(BULLET_FIXTURE, 'typescript developer role', ['typescript', 'microservices']);

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

    const results = await rewriteAllBullets(RESUME_FIXTURE, 'developer role', ['typescript']);

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

    const results = await rewriteAllBullets(RESUME_FIXTURE, 'developer role', ['typescript']);

    expect(results).toHaveLength(2);
    expect(results[0]!.rewritten).toBe(BULLET_FIXTURE.text);
    expect(results[1]!.rewritten).toBe(BULLET_FIXTURE_2.text);
  });

  it('falls back to originals when response is not valid JSON', async () => {
    mockGenerateContent.mockResolvedValue({
      response: { text: () => 'not json at all' },
    });

    const results = await rewriteAllBullets(RESUME_FIXTURE, 'developer role', ['typescript']);

    expect(results).toHaveLength(2);
    expect(results[0]!.rewritten).toBe(BULLET_FIXTURE.text);
    expect(results[1]!.rewritten).toBe(BULLET_FIXTURE_2.text);
  });
});

describe('SYSTEM_PROMPT content (AI-02)', () => {
  it('contains explicit prohibition against inventing metrics', () => {
    expect(SYSTEM_PROMPT).toContain('Do NOT invent');
  });

  it('contains explicit prohibition against mentioning technologies not in original', () => {
    expect(SYSTEM_PROMPT).toContain('Do NOT mention any technology');
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
