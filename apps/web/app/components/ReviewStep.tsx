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
        {/* Top bar: Accept All + Match Score */}
        <div className="flex items-center justify-between mb-4">
          <button
            type="button"
            onClick={onAcceptAll}
            className="border border-gray-300 rounded px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
          >
            Accept All
          </button>
          <span className="text-sm text-gray-500">
            Match Score: <span className="font-medium text-gray-700">{result.score}%</span>
          </span>
        </div>

        {/* Keyword gaps strip */}
        {result.gaps.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-semibold text-gray-500 mr-1">Keyword Gaps:</span>
            {result.gaps.map((gap) => (
              <span
                key={gap}
                className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
              >
                {gap}
              </span>
            ))}
          </div>
        )}

        {/* Grouped bullet cards */}
        {groups.map((group) => (
          <div key={group.sectionName}>
            <h2 className="mt-8 mb-3 text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-gray-200 pb-1">
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
      <div className="sticky bottom-0 bg-white border-t border-gray-200 py-4">
        <div className="w-full max-w-5xl mx-auto px-6">
          <button
            type="button"
            onClick={onGenerate}
            className="w-full bg-gray-900 text-white hover:bg-gray-700 rounded-lg py-3 text-base font-semibold transition-colors"
          >
            Generate DOCX &rarr;
          </button>
        </div>
      </div>
    </div>
  );
}
