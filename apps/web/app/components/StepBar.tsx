'use client';

import { STEP_LABELS } from '../lib/types';

interface StepBarProps {
  currentStep: number; // 0 = Upload, 1 = Review, 2 = Download
}

export default function StepBar({ currentStep }: StepBarProps) {
  return (
    <nav className="w-full border-b border-gray-200 bg-white">
      <ol className="flex items-center justify-center gap-2 py-4 text-sm">
        {STEP_LABELS.map((label, index) => {
          const isActive = index === currentStep;
          const isPast = index < currentStep;

          return (
            <li key={label} className="flex items-center gap-2">
              <span
                className={
                  isActive
                    ? 'font-semibold text-gray-900 underline underline-offset-4'
                    : isPast
                      ? 'font-medium text-gray-500'
                      : 'font-medium text-gray-400'
                }
              >
                {index + 1}. {label}
              </span>
              {index < STEP_LABELS.length - 1 && (
                <span className="text-gray-300" aria-hidden="true">
                  &rarr;
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
