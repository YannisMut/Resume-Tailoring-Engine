'use client';

import { useState } from 'react';
import type { AnalysisResult } from '@resume/types';
import { PDF_ERROR_MESSAGES } from './lib/errors';
import type { BulletDecision, WizardStep } from './lib/types';
import { stepToIndex } from './lib/types';
import StepBar from './components/StepBar';
import UploadStep from './components/UploadStep';
import LoadingStep from './components/LoadingStep';

export default function WizardPage() {
  const [step, setStep] = useState<WizardStep>({ name: 'upload' });
  const [apiError, setApiError] = useState<string | null>(null);

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
        const code: string = (body as { error?: { code?: string } })?.error?.code ?? 'unknown';
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

  const currentStepIndex = stepToIndex(step.name);

  return (
    <div className="min-h-screen bg-white">
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
        <div className="max-w-5xl mx-auto px-6 py-12">
          <p className="text-gray-500 text-sm">Review step — coming in Plan 03</p>
        </div>
      )}

      {step.name === 'generating' && <LoadingStep />}

      {step.name === 'download' && (
        <div className="max-w-5xl mx-auto px-6 py-12">
          <p className="text-gray-500 text-sm">Download step — coming in Plan 04</p>
        </div>
      )}

      {step.name === 'error' && (
        <div className="max-w-5xl mx-auto px-6 py-12 text-center">
          <p className="text-red-600 font-medium mb-4">{step.message}</p>
          <button
            type="button"
            onClick={() => setStep({ name: 'upload' })}
            className="px-6 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-700"
          >
            Start Over
          </button>
        </div>
      )}
    </div>
  );
}
