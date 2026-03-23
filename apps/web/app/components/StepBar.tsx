'use client';

import { STEP_LABELS } from '../lib/types';

const STEP_DESCRIPTIONS = ['Upload resume & JD', 'Review AI rewrites', 'Download DOCX'];

interface StepBarProps {
  currentStep: number; // 0 = Upload, 1 = Review, 2 = Download
}

export default function StepBar({ currentStep }: StepBarProps) {
  return (
    <nav className="w-full bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-3xl mx-auto flex items-center justify-between py-5 px-6">
        {STEP_LABELS.map((label, index) => {
          const isActive = index === currentStep;
          const isPast = index < currentStep;

          return (
            <div key={label} className="flex items-center flex-1 last:flex-none">
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                    isPast
                      ? 'bg-primary-600 text-white'
                      : isActive
                        ? 'bg-primary-600 text-white ring-4 ring-primary-100 shadow-md'
                        : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {isPast ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={`text-xs font-semibold transition-colors ${
                    isActive
                      ? 'text-primary-700'
                      : isPast
                        ? 'text-slate-600'
                        : 'text-slate-400'
                  }`}
                >
                  {label}
                </span>
                <span className="text-[10px] text-slate-400 hidden sm:block">
                  {STEP_DESCRIPTIONS[index]}
                </span>
              </div>

              {/* Connecting line */}
              {index < STEP_LABELS.length - 1 && (
                <div className="flex-1 mx-4 mt-[-20px]">
                  <div
                    className={`h-0.5 w-full rounded-full transition-colors duration-500 ${
                      isPast ? 'bg-primary-600' : 'bg-slate-200'
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}
