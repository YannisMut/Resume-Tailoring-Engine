'use client';

interface DownloadStepProps {
  score: number;
  gaps: string[];
  generating: boolean;
  downloadReady: boolean;
  generationError: string | null;
  onRetry: () => void;
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
      {/* Score + Gaps — always visible on Step 3 */}
      <div className="w-full rounded-lg border border-gray-200 bg-gray-50 p-6">
        <div className="mb-4 flex items-baseline gap-2">
          <span className="text-4xl font-bold text-gray-900">{score}</span>
          <span className="text-lg text-gray-500">/ 100 keyword match score</span>
        </div>
        {gaps.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-gray-600">Keywords to add:</p>
            <div className="flex flex-wrap gap-2">
              {gaps.map((gap) => (
                <span
                  key={gap}
                  className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800"
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
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900" />
          <p className="text-sm text-gray-600">Generating your tailored resume...</p>
        </div>
      )}

      {/* State: error */}
      {generationError && !generating && (
        <div className="w-full rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="mb-3 text-sm text-red-700">{generationError}</p>
          <button
            type="button"
            aria-label="Retry"
            onClick={onRetry}
            className="rounded bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* State: ready */}
      {downloadReady && !generating && !generationError && (
        <div className="flex flex-col items-center gap-3">
          <p className="text-sm text-gray-600">Your tailored resume is ready.</p>
          <button
            type="button"
            aria-label="Download resume_tailored.docx"
            className="rounded-lg bg-gray-900 px-8 py-3 text-base font-semibold text-white hover:bg-gray-700 transition-colors"
          >
            Download DOCX
          </button>
          <p className="text-xs text-gray-400">resume_tailored.docx</p>
        </div>
      )}

      {/* State: idle (auto-generation not yet started) */}
      {!generating && !downloadReady && !generationError && (
        <p className="text-sm text-gray-500">Preparing your download...</p>
      )}
    </div>
  );
}
