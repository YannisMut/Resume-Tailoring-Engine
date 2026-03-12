'use client';

export default function LoadingStep() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-16">
      <div
        className="h-10 w-10 animate-spin rounded-full border-2 border-gray-200 border-t-gray-900"
        role="status"
        aria-label="Loading"
      />
      <div className="text-center">
        <p className="text-lg font-medium text-gray-900">Analyzing your resume...</p>
        <p className="mt-1 text-sm text-gray-500">
          This takes about 15&ndash;30 seconds. Please wait.
        </p>
      </div>
    </div>
  );
}
