import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Bullet, ResumeStructure } from '@resume/types';
import type { RewrittenBullet } from '@resume/types';
import { AiTimeoutError } from '../middleware/error.middleware.js';

export type ExtractedKeyword = {
  keyword: string;
  aliases: string[];
  priority: 'required' | 'preferred';
  category: 'hard_skill' | 'tool' | 'certification' | 'methodology' | 'domain_term';
};

const FALLBACK_STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'shall', 'can', 'not', 'no', 'nor',
  'so', 'yet', 'both', 'either', 'neither', 'each', 'that', 'this',
  'these', 'those', 'which', 'who', 'whom', 'whose', 'what', 'when',
  'where', 'how', 'why', 'if', 'as', 'than', 'then', 'while', 'after',
  'before', 'during', 'between', 'through', 'per', 'it', 'its', 'we',
  'our', 'you', 'your', 'their', 'they', 'he', 'she', 'him', 'her',
  'his', 'i', 'me', 'my', 'us', 'up', 'out', 'about', 'into', 'also',
]);

function fallbackTokenize(text: string): ExtractedKeyword[] {
  return Array.from(new Set(
    text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
      .filter((t) => t.length > 2 && !FALLBACK_STOP_WORDS.has(t))
  )).map((keyword) => ({ keyword, aliases: [], priority: 'preferred' as const, category: 'hard_skill' as const }));
}

function stripCodeFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  return fenced ? fenced[1]! : text.trim();
}

const GEMINI_TIMEOUT_MS = 120_000; // 2 minutes — two sequential Gemini calls can each take up to 60s
const MAX_ATTEMPTS = 3;
const MODEL_NAME = 'gemini-3-flash-preview';

// Delays between retry attempts: 20s, 30s — respects Gemini free tier rate limits
const RETRY_DELAYS_MS = [20_000, 30_000];

// Singleton client — one instance per process, created on first use
let _client: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
  if (!_client) {
    console.log('[ai.service] GEMINI_API_KEY configured:', !!process.env.GEMINI_API_KEY);
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

export const SYSTEM_PROMPT = `You are an expert resume editor. For every bullet point you receive, you must do TWO things:

1. IMPROVE the writing — start with a strong past-tense action verb; cut filler words; fix grammar; keep it one concise sentence; be specific about what was done and why it mattered.
2. INCORPORATE gap keywords where they fit naturally and truthfully.

KEYWORD RULES:
- You will receive a list of keywords missing from the resume, tagged [REQUIRED] or [PREFERRED]. Incorporate REQUIRED keywords first.
- Use each gap keyword at most ONCE across all bullets — never repeat the same keyword in multiple bullets.
- If a keyword cannot fit naturally into any bullet, skip it entirely.
- Do NOT add keywords that are already listed in the candidate's existing skills section.

WRITING QUALITY RULES:
- Replace weak openers: "Was responsible for" → the action verb; "Helped with" → the specific contribution; "Worked on" → what was built or achieved.
- Remove filler phrases and redundancy.
- Keep each bullet to one clear sentence.
- Do NOT invent, add, or imply any metric, percentage, timeframe, quantity, or responsibility not present in the original bullet.
- Do NOT fabricate new responsibilities or experiences.
- Even when no gap keyword applies to a bullet, still improve its phrasing — never return a bullet completely unchanged unless it is already excellent.

Each bullet is prefixed with [section | job title] context — use it to judge whether a keyword fits that role.

You will receive a numbered list of bullets. Return a JSON array of strings, one rewritten bullet per input, in the same order. No explanation, no bullet characters, no wrapping — just the JSON array.`;

export const KEYWORD_EXTRACTION_PROMPT = `You are an ATS (Applicant Tracking System) keyword analyst. Given a job description, extract the specific technical and domain keywords that an ATS would use to score a candidate's resume.

For each keyword return a JSON object with exactly these fields:
- "keyword": the canonical full form with correct capitalisation (e.g. "Kubernetes" not "k8s", "JavaScript" not "js", "machine learning" not "ML")
- "aliases": array of alternate forms, abbreviations, or common spellings a resume might use (e.g. ["K8s", "kube"] for Kubernetes, ["JS", "ES6", "ECMAScript"] for JavaScript, ["ML"] for machine learning). Use [] if there are no common aliases.
- "priority": "required" if the keyword appears in a requirements / qualifications / must-have section or is repeated 3+ times in the JD; "preferred" if it appears only in a nice-to-have / bonus / preferred section or is mentioned just once in passing
- "category": one of "hard_skill", "tool", "certification", "methodology", "domain_term"

INCLUDE:
- Named technologies, languages, and frameworks
- Named tools, platforms, and services
- Named methodologies and practices (e.g. "Scrum", "CI/CD", "Test-Driven Development")
- Domain-specific named concepts (e.g. "machine learning", "A/B testing", "HIPAA compliance", "data pipeline")
- Certifications and credentials

DO NOT INCLUDE:
- Soft skills or generic verbs (collaborate, communicate, lead, manage, drive, deliver, etc.)
- Generic nouns (team, role, experience, solutions, environment, opportunity, skills, projects)
- Personality adjectives (motivated, detail-oriented, passionate, fast-paced, etc.)
- Education levels (bachelor's, master's) unless a specific degree field is required
- Years of experience
- General processes that are universal to software ("code review", "debugging", "testing", "deployment")
- Business jargon with no technical specificity ("stakeholder alignment", "cross-functional collaboration", "go-to-market")
- Example projects, aspirational content, or illustrative scenarios (e.g. "A chatbot that...", "Example projects may include...") — extract only from requirements, qualifications, and responsibilities sections

FIELD-AGNOSTIC TEST — apply before including any keyword:
"Would this term appear meaningfully on a resume for a nurse, a teacher, or an accountant?"
If yes — exclude it. It has no ATS discriminating power.

ATS FILTER TEST — apply before including any keyword:
"Would a recruiter paste this exact term (or one of its aliases) into a keyword screening filter?"
If not — exclude it.

For "domain_term" category specifically: only include named concepts specific to a technical or regulated domain. Do NOT use this category for general processes or phrases that lack technical precision.

Return a JSON array of objects. Return only keywords you are confident belong in an ATS filter. If the JD only has 8 strong keywords, return 8 — do not pad to reach the cap of 30. Return [] if the JD has no concrete ATS-scannable keywords.`;

function buildBatchUserPrompt(resume: ResumeStructure, jobDescription: string, gaps: ExtractedKeyword[], skillsContext: string): string {
  // Build numbered bullets prefixed with [section | job title] context
  let idx = 1;
  const lines: string[] = [];
  for (const section of resume.sections) {
    for (const item of section.items) {
      const parts = [item.title, item.subtitle].filter((x): x is string => !!x);
      const context = parts.length > 0 ? `${section.heading} | ${parts.join(' — ')}` : section.heading;
      for (const bullet of item.bullets) {
        lines.push(`${idx}. [${context}] ${bullet.text}`);
        idx++;
      }
    }
  }

  // Format gap keywords with priority tags so the model knows which matter most
  const gapList = gaps.length > 0
    ? gaps.map((g) => `- [${g.priority === 'required' ? 'REQUIRED' : 'PREFERRED'}] ${g.keyword}`).join('\n')
    : 'None — focus on improving writing quality only.';

  return [
    `Bullets to rewrite:`,
    lines.join('\n'),
    ``,
    `Keywords missing from resume — incorporate where natural, REQUIRED first:`,
    gapList,
    ``,
    `Job description:`,
    jobDescription.slice(0, 2000),
    ``,
    `Candidate's existing skills (already on resume — do not redundantly add these to bullets):`,
    skillsContext,
    ``,
    `Rewrite EVERY bullet to be stronger and more impactful. Incorporate gap keywords where they fit naturally. Use each keyword at most once across all bullets. Return a JSON array of strings.`,
  ].join('\n');
}

// Single-bullet rewrite — used by tests and for individual rewrites
export async function rewriteBullet(
  bullet: Bullet,
  jobDescription: string,
  gaps: ExtractedKeyword[],
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
  gaps: ExtractedKeyword[],
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

  // Extract skills section content to give the AI context about what's already on the resume
  const skillsSectionRe = /skill|language|technolog|certif|tool|proficien/i;
  const skillsLines: string[] = [];
  for (const section of resume.sections) {
    if (skillsSectionRe.test(section.heading)) {
      for (const item of section.items) {
        if (item.title) skillsLines.push(item.title);
        if (item.subtitle) skillsLines.push(item.subtitle);
      }
    }
  }
  const skillsContext = skillsLines.join('\n') || 'None listed';

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
          contents: [{ role: 'user', parts: [{ text: buildBatchUserPrompt(resume, jobDescription, gaps, skillsContext) }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 16384, responseMimeType: 'application/json' },
        });
        let responseText: string;
        try {
          responseText = result.response.text();
        } catch {
          // Blocked or empty response — return originals
          return allBullets.map((b) => b.text);
        }
        try {
          const parsed = JSON.parse(stripCodeFences(responseText));
          if (Array.isArray(parsed) && parsed.length === allBullets.length) {
            return parsed as string[];
          }
          // Wrong length — fall back to originals
          return allBullets.map((b) => b.text);
        } catch {
          console.warn('[rewriteAllBullets] Failed to parse JSON, falling back to originals:', responseText.slice(0, 200));
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
  } catch (err) {
    console.warn('[rewriteAllBullets] Gemini call failed, returning originals:', err);
    return allBullets.map((bullet) => ({
      id: bullet.id, original: bullet.text, rewritten: bullet.text, approved: false,
    }));
  } finally {
    clearTimeout(timer);
  }
}

function isKeywordObject(item: unknown): item is Record<string, unknown> {
  return typeof item === 'object' && item !== null && typeof (item as Record<string, unknown>).keyword === 'string' && ((item as Record<string, unknown>).keyword as string).trim() !== '';
}

function normalizeKeyword(item: Record<string, unknown>): ExtractedKeyword {
  const aliases = Array.isArray(item.aliases)
    ? (item.aliases as unknown[]).filter((a): a is string => typeof a === 'string')
    : [];
  const priority = item.priority === 'required' ? 'required' : 'preferred';
  const validCategories = ['hard_skill', 'tool', 'certification', 'methodology', 'domain_term'] as const;
  const category = validCategories.includes(item.category as (typeof validCategories)[number])
    ? (item.category as ExtractedKeyword['category'])
    : 'hard_skill';
  return { keyword: (item.keyword as string).trim(), aliases, priority, category };
}

export async function extractKeywords(jobDescription: string): Promise<ExtractedKeyword[]> {
  console.log('[extractKeywords] called, JD length:', jobDescription.length);
  const client = getClient();
  const model = client.getGenerativeModel({
    model: MODEL_NAME,
    systemInstruction: KEYWORD_EXTRACTION_PROMPT,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AiTimeoutError()), GEMINI_TIMEOUT_MS);
  });

  try {
    const keywords = await Promise.race([
      withRetry(async () => {
        const result = await model.generateContent({
          contents: [{ role: 'user', parts: [{ text: jobDescription.slice(0, 3000) }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096, responseMimeType: 'application/json' },
        });
        let responseText: string;
        try {
          responseText = result.response.text();
          console.log('[extractKeywords] raw response:', responseText.slice(0, 300));
        } catch (err) {
          console.warn('[extractKeywords] Gemini response blocked/empty, falling back to tokenizer:', err);
          return fallbackTokenize(jobDescription);
        }
        try {
          const parsed = JSON.parse(stripCodeFences(responseText));
          if (Array.isArray(parsed) && parsed.length > 0 && parsed.every(isKeywordObject)) {
            const keywords = (parsed as Record<string, unknown>[]).map(normalizeKeyword);
            console.log('[extractKeywords] AI extracted', keywords.length, 'keywords:', keywords.slice(0, 3));
            return keywords;
          }
          console.warn('[extractKeywords] Gemini returned invalid structure, falling back to tokenizer:', JSON.stringify(parsed).slice(0, 200));
          return fallbackTokenize(jobDescription);
        } catch {
          console.warn('[extractKeywords] Gemini returned non-JSON, falling back to tokenizer:', responseText.slice(0, 200));
          return fallbackTokenize(jobDescription);
        }
      }),
      timeoutPromise,
    ]);
    return keywords;
  } catch (err) {
    console.warn('[extractKeywords] Gemini call failed, falling back to tokenizer:', err);
    return fallbackTokenize(jobDescription);
  } finally {
    clearTimeout(timer);
  }
}
