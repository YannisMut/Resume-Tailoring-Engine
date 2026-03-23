'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AnalysisResult } from '@resume/types';
import { PDF_ERROR_MESSAGES } from './lib/errors';
import type { BulletDecision, WizardStep } from './lib/types';
import { stepToIndex } from './lib/types';
import StepBar from './components/StepBar';
import UploadStep from './components/UploadStep';
import LoadingStep from './components/LoadingStep';
import ReviewStep from './components/ReviewStep';
import DownloadStep from './components/DownloadStep';

export default function WizardPage() {
  const [step, setStep] = useState<WizardStep>({ name: 'upload' });
  const [apiError, setApiError] = useState<string | null>(null);

  // Download step state (separate from WizardStep to avoid re-mounting DownloadStep on each change)
  const [generating, setGenerating] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // --- Upload step ---
  async function submitAnalysis(file: File, jobDescription: string) {
    setApiError(null);
    setStep({ name: 'loading' });

    const form = new FormData();
    form.append('resume', file);
    form.append('jobDescription', jobDescription);

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        body: form,
        // Do NOT set Content-Type — browser sets multipart boundary automatically
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const code: string = typeof (body as { error?: string })?.error === 'string'
          ? (body as { error: string }).error
          : 'unknown';
        const message = PDF_ERROR_MESSAGES[code] ?? PDF_ERROR_MESSAGES['unknown']!;
        setApiError(message);
        setStep({ name: 'upload' });
        return;
      }

      const result: AnalysisResult = await res.json();
      const bullets: BulletDecision[] = result.rewrites.map((r) => ({
        ...r,
        status: 'pending' as const,
      }));
      setStep({ name: 'review', result, bullets });
    } catch {
      setApiError(PDF_ERROR_MESSAGES['unknown']!);
      setStep({ name: 'upload' });
    }
  }

  // --- Bullet decision handlers ---
  function updateBullets(
    currentStep: Extract<WizardStep, { name: 'review' | 'generating' | 'download' }>,
    updater: (bullets: BulletDecision[]) => BulletDecision[],
  ) {
    setStep({ ...currentStep, bullets: updater(currentStep.bullets) });
  }

  function handleAccept(id: string) {
    if (step.name !== 'review') return;
    updateBullets(step, (bullets) =>
      bullets.map((b) => (b.id === id ? { ...b, status: 'approved' as const } : b)),
    );
  }

  function handleReject(id: string) {
    if (step.name !== 'review') return;
    updateBullets(step, (bullets) =>
      bullets.map((b) => (b.id === id ? { ...b, status: 'rejected' as const } : b)),
    );
  }

  function handleEdit(id: string, text: string) {
    if (step.name !== 'review') return;
    updateBullets(step, (bullets) =>
      bullets.map((b) =>
        b.id === id ? { ...b, status: 'edited' as const, editedText: text } : b,
      ),
    );
  }

  function handleRevert(id: string) {
    if (step.name !== 'review') return;
    updateBullets(step, (bullets) =>
      bullets.map((b) => {
        if (b.id !== id) return b;
        const { editedText: _omit, ...rest } = b;
        return { ...rest, status: 'pending' as const };
      }),
    );
  }

  function handleAcceptAll() {
    if (step.name !== 'review') return;
    updateBullets(step, (bullets) =>
      bullets.map((b) => ({ ...b, status: 'approved' as const })),
    );
  }

  // --- DOCX generation ---
  const generateDocx = useCallback(
    async (result: AnalysisResult, bullets: BulletDecision[]) => {
      setGenerating(true);
      setGenerationError(null);
      setDownloadReady(false);

      const approvedBullets = bullets.map((b) => ({
        ...b,
        rewritten: b.status === 'edited' ? (b.editedText ?? b.rewritten) : b.rewritten,
        approved: b.status === 'approved' || b.status === 'edited',
      }));

      try {
        const res = await fetch('/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resumeStructure: result.resumeStructure,
            bullets: approvedBullets,
          }),
        });

        if (!res.ok) {
          setGenerationError('DOCX generation failed. Your edits are preserved — try again.');
          setGenerating(false);
          return;
        }

        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'resume_tailored.docx';
        a.click();
        URL.revokeObjectURL(url);

        setDownloadReady(true);
        setGenerating(false);
      } catch {
        setGenerationError('DOCX generation failed. Your edits are preserved — try again.');
        setGenerating(false);
      }
    },
    [],
  );

  // Auto-generate on arrival at download step
  useEffect(() => {
    if (step.name === 'download') {
      generateDocx(step.result, step.bullets);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.name === 'download']);

  function handleGenerate() {
    if (step.name !== 'review') return;
    const { result, bullets } = step;
    setStep({ name: 'download', result, bullets });
    // Reset download state for fresh generation
    setGenerating(false);
    setDownloadReady(false);
    setGenerationError(null);
  }

  function handleRetry() {
    if (step.name !== 'download') return;
    generateDocx(step.result, step.bullets);
  }

  // --- Render ---
  const currentStepIndex = stepToIndex(step.name);

  return (
    <div className="min-h-screen bg-surface bg-dot-pattern">
      <StepBar currentStep={currentStepIndex} />

      {step.name === 'upload' && (
        <UploadStep
          onSubmit={submitAnalysis}
          apiError={apiError}
          onResetApiError={() => setApiError(null)}
        />
      )}

      {step.name === 'loading' && <LoadingStep />}

      {step.name === 'review' && (
        <ReviewStep
          result={step.result}
          bullets={step.bullets}
          onAccept={handleAccept}
          onReject={handleReject}
          onEdit={handleEdit}
          onRevert={handleRevert}
          onAcceptAll={handleAcceptAll}
          onGenerate={handleGenerate}
        />
      )}

      {step.name === 'generating' && <LoadingStep />}

      {step.name === 'download' && (
        <DownloadStep
          score={step.result.score}
          gaps={step.result.gaps}
          generating={generating}
          downloadReady={downloadReady}
          generationError={generationError}
          onRetry={handleRetry}
        />
      )}

      {step.name === 'error' && (
        <div className="max-w-md mx-auto px-6 py-20 text-center">
          <p className="text-slate-700 mb-4">{step.message}</p>
          <button
            type="button"
            onClick={() => setStep({ name: 'upload' })}
            className="rounded-xl bg-primary-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary-700 shadow-md transition-all duration-200"
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
