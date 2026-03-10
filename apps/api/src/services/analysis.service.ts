import type { ResumeStructure, AnalysisResult } from '@resume/types';

const STOP_WORDS = new Set([
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

export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

export function extractResumeTokens(resume: ResumeStructure): Set<string> {
  const texts: string[] = [];

  for (const h of resume.header) {
    texts.push(h.text);
  }

  for (const section of resume.sections) {
    texts.push(section.heading);
    for (const item of section.items) {
      if (item.title !== undefined) texts.push(item.title);
      if (item.subtitle !== undefined) texts.push(item.subtitle);
      for (const bullet of item.bullets) {
        texts.push(bullet.text);
      }
    }
  }

  return new Set(texts.flatMap(tokenize));
}

export function analyzeResume(resume: ResumeStructure, jobDescription: string): AnalysisResult {
  const resumeTokens = extractResumeTokens(resume);
  const jdTokens = Array.from(new Set(tokenize(jobDescription)));
  const matched = jdTokens.filter((t) => resumeTokens.has(t));
  const score = jdTokens.length === 0 ? 0 : Math.round((matched.length / jdTokens.length) * 100);
  const gaps = jdTokens.filter((t) => !resumeTokens.has(t));
  return { score, gaps, rewrites: [], resumeStructure: resume };
}
