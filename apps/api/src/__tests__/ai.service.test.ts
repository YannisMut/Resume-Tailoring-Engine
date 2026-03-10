import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAiTimeoutError } from '../middleware/error.middleware.js';
import type { Bullet, ResumeStructure } from '@resume/types';

const mockCreate = vi.fn();

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockCreate } };
  },
}));

// Import after mock setup
import { rewriteBullet, rewriteAllBullets } from '../services/ai.service.js';

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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('rewriteBullet', () => {
  it('returns RewrittenBullet with correct shape on success', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Developed scalable backend microservices for e-commerce platform' } }],
    });

    const result = await rewriteBullet(BULLET_FIXTURE, 'typescript developer role', ['typescript', 'microservices']);

    expect(result.id).toBe(BULLET_FIXTURE.id);
    expect(result.original).toBe(BULLET_FIXTURE.text);
    expect(result.rewritten).toBe('Developed scalable backend microservices for e-commerce platform');
    expect(result.approved).toBe(false);
  });

  it('trims whitespace from GPT response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '  Improved bullet with extra whitespace  ' } }],
    });

    const result = await rewriteBullet(BULLET_FIXTURE, 'jd', []);

    expect(result.rewritten).toBe('Improved bullet with extra whitespace');
  });

  it('falls back to bullet.text when choices[0].message.content is null', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: null } }],
    });

    const result = await rewriteBullet(BULLET_FIXTURE, 'jd', []);

    expect(result.rewritten).toBe(BULLET_FIXTURE.text);
    expect(result.original).toBe(BULLET_FIXTURE.text);
  });
});

describe('rewriteAllBullets', () => {
  it('returns one RewrittenBullet per bullet across all sections and items (AI-01)', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'Rewritten bullet' } }],
    });

    const results = await rewriteAllBullets(RESUME_FIXTURE, 'developer role', ['typescript']);

    expect(results).toHaveLength(2);
    expect(results[0]!.id).toBe(BULLET_FIXTURE.id);
    expect(results[1]!.id).toBe(BULLET_FIXTURE_2.id);
  });
});

describe('SYSTEM_PROMPT content (AI-02)', () => {
  it('contains explicit prohibition against inventing metrics', async () => {
    // We inspect the module to find the SYSTEM_PROMPT
    // The constraint is verified by checking mockCreate was called with the right system content
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'rewritten' } }],
    });

    await rewriteBullet(BULLET_FIXTURE, 'jd', []);

    const callArgs = mockCreate.mock.calls[0]![0] as { messages: { role: string; content: string }[] };
    const systemMessage = callArgs.messages.find((m) => m.role === 'system');
    expect(systemMessage!.content).toContain('Do NOT invent');
  });

  it('contains explicit prohibition against mentioning technologies not in original', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: 'rewritten' } }],
    });

    await rewriteBullet(BULLET_FIXTURE, 'jd', []);

    const callArgs = mockCreate.mock.calls[0]![0] as { messages: { role: string; content: string }[] };
    const systemMessage = callArgs.messages.find((m) => m.role === 'system');
    expect(systemMessage!.content).toContain('Do NOT mention any technology');
  });
});

describe('withRetry — retry behavior (AI-03, AI-04)', () => {
  it('retries 3 times on repeated transient failure then throws OpenAiTimeoutError', async () => {
    vi.useFakeTimers();

    // Simulate APIConnectionTimeoutError using constructor.name check pattern
    const timeoutError = new Error('Connection timed out');
    Object.defineProperty(timeoutError, 'constructor', {
      value: { name: 'APIConnectionTimeoutError' },
    });

    mockCreate.mockRejectedValue(timeoutError);

    const promise = rewriteBullet(BULLET_FIXTURE, 'jd', []);
    // Attach rejection handler immediately to prevent unhandled rejection
    const assertion = expect(promise).rejects.toBeInstanceOf(OpenAiTimeoutError);

    // Advance through backoff delays: 1000ms after attempt 1, 2000ms after attempt 2
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    await assertion;
    expect(mockCreate).toHaveBeenCalledTimes(3);

    vi.useRealTimers();
  });

  it('waits 1000ms before attempt 2 and 2000ms before attempt 3', async () => {
    vi.useFakeTimers();

    const timeoutError = new Error('Connection timed out');
    Object.defineProperty(timeoutError, 'constructor', {
      value: { name: 'APIConnectionTimeoutError' },
    });

    mockCreate.mockRejectedValue(timeoutError);

    const promise = rewriteBullet(BULLET_FIXTURE, 'jd', []);
    // Attach rejection handler immediately to prevent unhandled rejection
    const assertion = expect(promise).rejects.toBeInstanceOf(OpenAiTimeoutError);

    // After attempt 1 fails, should wait 1000ms
    // Only 1 call so far at this point
    expect(mockCreate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(999);
    // Still only 1 call — delay not elapsed
    expect(mockCreate).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1); // 1000ms elapsed — triggers attempt 2
    expect(mockCreate).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1999);
    // Still only 2 calls — 2000ms delay not elapsed
    expect(mockCreate).toHaveBeenCalledTimes(2);

    await vi.advanceTimersByTimeAsync(1); // 2000ms elapsed — triggers attempt 3
    expect(mockCreate).toHaveBeenCalledTimes(3);

    // Now the final attempt fails and throws
    await assertion;

    vi.useRealTimers();
  });

  it('does NOT retry when error has status 400 (permanent error)', async () => {
    const permanentError = new Error('Bad Request');
    (permanentError as unknown as { status: number }).status = 400;

    mockCreate.mockRejectedValue(permanentError);

    await expect(rewriteBullet(BULLET_FIXTURE, 'jd', [])).rejects.toThrow('Bad Request');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry when error has status 401 (permanent error)', async () => {
    const permanentError = new Error('Unauthorized');
    (permanentError as unknown as { status: number }).status = 401;

    mockCreate.mockRejectedValue(permanentError);

    await expect(rewriteBullet(BULLET_FIXTURE, 'jd', [])).rejects.toThrow('Unauthorized');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});
