import type { ResumeStructure, AnalysisResult } from '@resume/types';
import type { ExtractedKeyword } from './ai.service.js';
import { rewriteAllBullets, extractKeywords } from './ai.service.js';

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

function buildResumeFullText(resume: ResumeStructure): string {
  const texts: string[] = [];
  for (const h of resume.header) texts.push(h.text);
  for (const section of resume.sections) {
    texts.push(section.heading);
    for (const item of section.items) {
      if (item.title !== undefined) texts.push(item.title);
      if (item.subtitle !== undefined) texts.push(item.subtitle);
      for (const bullet of item.bullets) texts.push(bullet.text);
    }
  }
  return texts.join(' ').toLowerCase();
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function keywordPresent(kw: ExtractedKeyword, text: string): boolean {
  const allForms = [kw.keyword, ...kw.aliases];
  return allForms.some((form) => {
    const escaped = escapeRegex(form.toLowerCase());
    return new RegExp(`\\b${escaped}\\b`, 'i').test(text);
  });
}

const PRIORITY_WEIGHT = { required: 3, preferred: 1 } as const;

export async function analyzeResume(
  resume: ResumeStructure,
  jobDescription: string,
): Promise<AnalysisResult> {
  const jdKeywords = await extractKeywords(jobDescription);
  console.log('[analyzeResume] keyword count:', jdKeywords.length, 'sample:', jdKeywords.slice(0, 3));
  const resumeFullText = buildResumeFullText(resume);

  let earned = 0;
  let possible = 0;
  const gaps: ExtractedKeyword[] = [];

  for (const kw of jdKeywords) {
    const w = PRIORITY_WEIGHT[kw.priority];
    possible += w;
    if (keywordPresent(kw, resumeFullText)) {
      earned += w;
    } else {
      gaps.push(kw);
    }
  }

  const score = possible === 0 ? 0 : Math.round((earned / possible) * 100);

  // Sort gaps: required first so rewrites target the highest-impact keywords first
  gaps.sort((a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]);

  const rewrites = await rewriteAllBullets(resume, jobDescription, gaps);
  const gapStrings = gaps.map((kw) => kw.keyword.toLowerCase());
  return { score, gaps: gapStrings, rewrites, resumeStructure: resume };
}
