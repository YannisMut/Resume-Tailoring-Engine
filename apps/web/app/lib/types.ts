import type { RewrittenBullet, AnalysisResult } from '@resume/types';

export interface BulletDecision extends RewrittenBullet {
  status: 'pending' | 'approved' | 'rejected' | 'edited';
  editedText?: string;
}

export type WizardStep =
  | { name: 'upload' }
  | { name: 'loading' }
  | { name: 'review'; result: AnalysisResult; bullets: BulletDecision[] }
  | { name: 'generating'; result: AnalysisResult; bullets: BulletDecision[] }
  | { name: 'download'; result: AnalysisResult; bullets: BulletDecision[] }
  | { name: 'error'; message: string };

export const STEP_LABELS = ['Upload', 'Review', 'Download'] as const;

export function stepToIndex(name: WizardStep['name']): number {
  if (name === 'upload' || name === 'loading') return 0;
  if (name === 'review' || name === 'generating') return 1;
  return 2; // download or error
}
