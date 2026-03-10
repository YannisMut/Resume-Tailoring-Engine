import OpenAI from 'openai';
import type { Bullet, ResumeStructure } from '@resume/types';
import type { RewrittenBullet } from '@resume/types';
import { OpenAiTimeoutError } from '../middleware/error.middleware.js';

const OPENAI_TIMEOUT_MS = 30_000; // 30s per bullet call
const MAX_ATTEMPTS = 3;

// Delays between retry attempts: 1000ms after attempt 1, 2000ms after attempt 2
const RETRY_DELAYS_MS = [1000, 2000];

// Singleton client — one instance per process, created on first use
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 0, // We handle retries ourselves with custom backoff
    });
  }
  return _client;
}

// Transient HTTP status codes — safe to retry
const TRANSIENT_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

// Check error names via constructor.name, NOT instanceof, because instanceof
// breaks across vi.mock() boundaries (both classes are different references).
function isTransient(err: unknown): boolean {
  const name = (err as Error)?.constructor?.name ?? '';
  if (name === 'APIConnectionTimeoutError' || name === 'APIConnectionError') return true;
  const status = (err as { status?: number })?.status;
  return TRANSIENT_STATUSES.has(status ?? 0);
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === MAX_ATTEMPTS - 1;
      if (isLast || !isTransient(err)) {
        // Surface timeout errors with the user-facing retriable wrapper
        if ((err as Error)?.constructor?.name === 'APIConnectionTimeoutError') {
          throw new OpenAiTimeoutError();
        }
        throw err;
      }
      // Wait before the next attempt (1000ms, 2000ms)
      const delayMs = RETRY_DELAYS_MS[attempt] ?? 1000;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  // TypeScript: unreachable, but required for type narrowing
  throw new Error('unreachable');
}

export const SYSTEM_PROMPT = `You are a professional resume editor. Your task is to rewrite a single resume bullet point to better match a target job description by incorporating relevant keywords.

STRICT RULES — violating any rule makes the rewrite invalid:
1. Do NOT invent, add, or imply any metric, percentage, timeframe, number, or quantity that is not present in the original bullet.
2. Do NOT mention any technology, tool, framework, language, or methodology not named in the original bullet.
3. Keep the same verb tense and first-person perspective as the original.
4. Keep the rewritten bullet to one sentence.
5. If the original bullet cannot be meaningfully improved for keyword alignment, return it unchanged.

Return ONLY the rewritten bullet text — no explanation, no bullet character, no quotes.`;

function buildUserPrompt(original: string, jobDescription: string, gaps: string[]): string {
  const topGaps = gaps.slice(0, 10).join(', ');
  return [
    `Original bullet: ${original}`,
    ``,
    `Job description (excerpt): ${jobDescription.slice(0, 1000)}`,
    ``,
    `Keywords missing from resume: ${topGaps}`,
    ``,
    `Rewrite the bullet to incorporate relevant keywords where they fit naturally.`,
  ].join('\n');
}

export async function rewriteBullet(
  bullet: Bullet,
  jobDescription: string,
  gaps: string[],
): Promise<RewrittenBullet> {
  const client = getClient();
  const content = await withRetry(async () => {
    const response = await client.chat.completions.create(
      {
        model: 'gpt-4o',
        temperature: 0.3,
        max_tokens: 200,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(bullet.text, jobDescription, gaps) },
        ],
      },
      { timeout: OPENAI_TIMEOUT_MS },
    );
    return response.choices[0]?.message?.content ?? bullet.text;
  });
  return {
    id: bullet.id,
    original: bullet.text,
    rewritten: content.trim(),
    approved: false,
  };
}

export async function rewriteAllBullets(
  resume: ResumeStructure,
  jobDescription: string,
  gaps: string[],
): Promise<RewrittenBullet[]> {
  const results: RewrittenBullet[] = [];
  for (const section of resume.sections) {
    for (const item of section.items) {
      for (const bullet of item.bullets) {
        results.push(await rewriteBullet(bullet, jobDescription, gaps));
      }
    }
  }
  return results;
}
