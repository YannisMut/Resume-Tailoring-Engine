'use client';

import type { AnalysisResult, ResumeStructure } from '@resume/types';
import type { BulletDecision } from '../lib/types';
import BulletCard from './BulletCard';

interface ReviewStepProps {
  result: AnalysisResult;
  bullets: BulletDecision[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onRevert: (id: string) => void;
  onAcceptAll: () => void;
  onGenerate: () => void;
}

function groupBulletsBySection(
  sections: ResumeStructure['sections'],
  bullets: BulletDecision[],
): Array<{ sectionName: string; bullets: BulletDecision[] }> {
  const bulletMap = new Map(bullets.map((b) => [b.id, b]));
  const groups: Array<{ sectionName: string; bullets: BulletDecision[] }> = [];

  for (const section of sections) {
    const sectionBullets: BulletDecision[] = [];
    for (const item of section.items) {
      for (const bullet of item.bullets) {
        const decision = bulletMap.get(bullet.id);
        if (decision) sectionBullets.push(decision);
      }
    }
    if (sectionBullets.length > 0) {
      groups.push({ sectionName: section.heading, bullets: sectionBullets });
    }
  }
  return groups;
}

/** Mini SVG circular score ring */
function ScoreRing({ score }: { score: number }) {
  const r = 10;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0" aria-hidden="true">
      <circle cx="14" cy="14" r={r} fill="none" stroke="currentColor" strokeWidth="3" className="text-slate-200" />
      <circle
        cx="14" cy="14" r={r} fill="none" stroke="currentColor" strokeWidth="3"
        className="text-primary-600"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}

export default function ReviewStep({
  result,
  bullets,
  onAccept,
  onReject,
  onEdit,
  onRevert,
  onAcceptAll,
  onGenerate,
}: ReviewStepProps) {
  const groups = groupBulletsBySection(result.resumeStructure.sections, bullets);

  return (
    <div className="pb-24">
      {/* Main content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Top summary card */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-5 mb-6 flex items-center justify-between">
          <button
            type="button"
            onClick={onAcceptAll}
            className="bg-primary-600 text-white hover:bg-primary-700 rounded-lg px-5 py-2 text-sm font-semibold shadow-sm transition-all duration-200 active:scale-[0.98]"
          >
            Accept All
          </button>
          <div className="inline-flex items-center gap-2 bg-primary-50 rounded-full px-4 py-1.5">
            <ScoreRing score={result.score} />
            <span className="text-sm font-bold text-primary-700">{result.score}%</span>
            <span className="text-xs text-primary-500 font-medium">match</span>
          </div>
        </div>

        {/* Keyword gaps strip */}
        {result.gaps.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent-700 mr-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              Keyword Gaps:
            </span>
            {result.gaps.map((gap) => (
              <span
                key={gap}
                className="rounded-full bg-accent-100 border border-accent-200 px-3 py-1 text-xs font-medium text-accent-700"
              >
                {gap}
              </span>
            ))}
          </div>
        )}

        {/* Grouped bullet cards */}
        {groups.map((group) => (
          <div key={group.sectionName}>
            <h2 className="mt-8 mb-3 text-xs font-bold uppercase tracking-widest text-primary-700 border-b-2 border-primary-200 pb-1.5">
              {group.sectionName}
            </h2>
            <div className="flex flex-col gap-4">
              {group.bullets.map((bullet) => (
                <BulletCard
                  key={bullet.id}
                  bullet={bullet}
                  onAccept={onAccept}
                  onReject={onReject}
                  onEdit={onEdit}
                  onRevert={onRevert}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Sticky "Generate DOCX" footer */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-slate-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] py-4 z-40">
        <div className="w-full max-w-5xl mx-auto px-6">
          <button
            type="button"
            onClick={onGenerate}
            className="w-full bg-primary-600 text-white hover:bg-primary-700 rounded-xl py-3.5 text-base font-bold shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.99] flex items-center justify-center gap-2"
          >
            Generate DOCX
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
