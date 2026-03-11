import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Bullet, ResumeStructure } from '@resume/types';
import type { RewrittenBullet } from '@resume/types';
import { AiTimeoutError } from '../middleware/error.middleware.js';

const GEMINI_TIMEOUT_MS = 60_000; // 60s for batch call
const MAX_ATTEMPTS = 3;
const MODEL_NAME = 'gemini-2.5-flash';

// Delays between retry attempts: 20s, 30s — respects Gemini free tier rate limits
const RETRY_DELAYS_MS = [20_000, 30_000];

// Singleton client — one instance per process, created on first use
let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    _client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY ?? '');
  }
  return _client;
}

// Transient HTTP status codes — safe to retry
const TRANSIENT_STATUSES = new Set([408, 409, 429, 500, 502, 503, 504]);

function isTransient(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  return TRANSIENT_STATUSES.has(status ?? 0);
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const isLast = attempt === MAX_ATTEMPTS - 1;
      if (isLast || !isTransient(err)) throw err;
      const delayMs = RETRY_DELAYS_MS[attempt] ?? 20_000;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  // TypeScript: unreachable, but required for type narrowing
  throw new Error('unreachable');
}

export const SYSTEM_PROMPT = `You are a professional resume editor. Your task is to rewrite resume bullet points to better match a target job description by incorporating relevant keywords.

STRICT RULES — violating any rule makes the rewrite invalid:
1. Do NOT invent, add, or imply any metric, percentage, timeframe, number, or quantity that is not present in the original bullet.
2. Do NOT mention any technology, tool, framework, language, or methodology not named in the original bullet.
3. Keep the same verb tense and first-person perspective as the original.
4. Keep each rewritten bullet to one sentence.
5. If a bullet cannot be meaningfully improved for keyword alignment, return it unchanged.

You will receive a numbered list of bullets. Return a JSON array of strings, one rewritten bullet per input, in the same order. No explanation, no bullet characters, no wrapping — just the JSON array.`;

function buildBatchUserPrompt(bullets: Bullet[], jobDescription: string, gaps: string[]): string {
  const topGaps = gaps.slice(0, 10).join(', ');
  const numberedBullets = bullets.map((b, i) => `${i + 1}. ${b.text}`).join('\n');
  return [
    `Bullets to rewrite:`,
    numberedBullets,
    ``,
    `Job description (excerpt): ${jobDescription.slice(0, 1000)}`,
    ``,
    `Keywords missing from resume: ${topGaps}`,
    ``,
    `Rewrite each bullet to incorporate relevant keywords where they fit naturally. Return a JSON array of strings.`,
  ].join('\n');
}

// Single-bullet rewrite — used by tests and for individual rewrites
export async function rewriteBullet(
  bullet: Bullet,
  jobDescription: string,
  gaps: string[],
): Promise<RewrittenBullet> {
  const results = await rewriteAllBullets(
    { meta: { pageWidth: 0, pageHeight: 0, marginTop: 0, marginBottom: 0, marginLeft: 0, marginRight: 0 }, header: [], sections: [{ id: 'tmp', heading: '', headingStyle: bullet.style, items: [{ id: 'tmp', bullets: [bullet] }] }] },
    jobDescription,
    gaps,
  );
  return results[0]!;
}

// Batch rewrite — sends all bullets in a single API call to stay within rate limits
export async function rewriteAllBullets(
  resume: ResumeStructure,
  jobDescription: string,
  gaps: string[],
): Promise<RewrittenBullet[]> {
  const allBullets: Bullet[] = [];
  for (const section of resume.sections) {
    for (const item of section.items) {
      for (const bullet of item.bullets) {
        allBullets.push(bullet);
      }
    }
  }

  if (allBullets.length === 0) return [];

  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: SYSTEM_PROMPT,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AiTimeoutError()), GEMINI_TIMEOUT_MS);
  });

  try {
    const rewrittenTexts = await Promise.race([
      withRetry(async () => {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: buildBatchUserPrompt(allBullets, jobDescription, gaps) }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 2000, responseMimeType: 'application/json' },
        });
        let responseText: string;
        try {
          responseText = result.response.text();
        } catch {
          // Blocked or empty response — return originals
          return allBullets.map((b) => b.text);
        }
        try {
          const parsed = JSON.parse(responseText);
          if (Array.isArray(parsed) && parsed.length === allBullets.length) {
            return parsed as string[];
          }
          // Wrong length — fall back to originals
          return allBullets.map((b) => b.text);
        } catch {
          // Failed to parse JSON — fall back to originals
          return allBullets.map((b) => b.text);
        }
      }),
      timeoutPromise,
    ]);

    return allBullets.map((bullet, i) => ({
      id: bullet.id,
      original: bullet.text,
      rewritten: (rewrittenTexts[i] ?? bullet.text).trim(),
      approved: false,
    }));
  } finally {
    clearTimeout(timer);
  }
}
