'use client';

interface DownloadStepProps {
  score: number;
  gaps: string[];
  generating: boolean;
  downloadReady: boolean;
  generationError: string | null;
  onRetry: () => void;
}

/** Large circular progress ring for score visualization */
function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);

  return (
    <div className="relative w-[140px] h-[140px] flex items-center justify-center">
      <svg width="140" height="140" viewBox="0 0 140 140" aria-hidden="true">
        {/* Background ring */}
        <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="10" className="text-slate-200" />
        {/* Progress ring */}
        <circle
          cx="70" cy="70" r={r} fill="none" stroke="currentColor" strokeWidth="10"
          className="text-primary-600"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      {/* Score number in center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-3xl font-bold text-primary-700">{score}</span>
        <span className="text-xs text-slate-400 font-medium">/ 100</span>
      </div>
    </div>
  );
}

export default function DownloadStep({
  score,
  gaps,
  generating,
  downloadReady,
  generationError,
  onRetry,
}: DownloadStepProps) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 flex flex-col items-center gap-8">
      {/* Score card — always visible */}
      <div className="w-full bg-white rounded-2xl shadow-lg border border-slate-100 p-8 flex flex-col items-center gap-6">
        <ScoreRing score={score} />
        <p className="text-sm font-semibold text-slate-500">Keyword Match Score</p>

        {gaps.length > 0 && (
          <div className="w-full">
            <p className="mb-2 text-xs font-semibold text-accent-700 flex items-center gap-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
              Keywords to add manually:
            </p>
            <div className="flex flex-wrap gap-2">
              {gaps.map((gap) => (
                <span
                  key={gap}
                  className="rounded-full bg-accent-100 border border-accent-200 px-3 py-1 text-xs font-medium text-accent-700"
                >
                  {gap}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* State: generating */}
      {generating && (
        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2 items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-primary-500 animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2.5 h-2.5 rounded-full bg-primary-400 animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2.5 h-2.5 rounded-full bg-primary-300 animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <p className="text-sm text-slate-500 font-medium">Generating your tailored resume...</p>
        </div>
      )}

      {/* State: error */}
      {generationError && !generating && (
        <div className="w-full rounded-xl border border-danger-200 bg-danger-50 p-5">
          <p className="mb-3 text-sm text-danger-700 font-medium">{generationError}</p>
          <button
            type="button"
            aria-label="Retry"
            onClick={onRetry}
            className="rounded-lg bg-danger-600 px-5 py-2 text-sm font-semibold text-white hover:bg-danger-700 shadow-sm transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* State: ready */}
      {downloadReady && !generating && !generationError && (
        <div className="flex flex-col items-center gap-4">
          {/* Success banner */}
          <div className="inline-flex items-center gap-2 bg-success-50 border border-success-200 rounded-lg px-4 py-2">
            <svg className="w-5 h-5 text-success-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-semibold text-success-700">Your tailored resume is ready!</span>
          </div>

          {/* Download button */}
          <button
            type="button"
            aria-label="Download resume_tailored.docx"
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-12 py-4 text-lg font-bold text-white hover:bg-primary-700 shadow-lg hover:shadow-xl transition-all duration-200 active:scale-[0.98]"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download DOCX
          </button>
          <p className="text-xs text-slate-400">resume_tailored.docx</p>
        </div>
      )}

      {/* State: idle (auto-generation not yet started) */}
      {!generating && !downloadReady && !generationError && (
        <p className="text-sm text-slate-500">Preparing your download...</p>
      )}
    </div>
  );
}
