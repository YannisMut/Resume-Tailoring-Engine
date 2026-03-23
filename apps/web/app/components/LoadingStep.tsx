'use client';

export default function LoadingStep() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 py-16">
      <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-lg p-12 max-w-md mx-auto flex flex-col items-center gap-6">
        {/* Bouncing dots */}
        <div className="flex gap-2 items-center justify-center" role="status" aria-label="Loading">
          <span
            className="w-3 h-3 rounded-full bg-primary-500 animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-3 h-3 rounded-full bg-primary-400 animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-3 h-3 rounded-full bg-primary-300 animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>

        {/* Shimmer progress bar */}
        <div className="w-64 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <div
            className="h-full w-full rounded-full animate-shimmer"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, var(--color-primary-400) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
            }}
          />
        </div>

        <div className="text-center">
          <p className="font-heading text-xl font-bold text-slate-900">Analyzing your resume...</p>
          <p className="mt-2 text-sm text-slate-500">
            This takes about 15&ndash;30 seconds. Please wait.
          </p>
        </div>
      </div>
    </div>
  );
}
