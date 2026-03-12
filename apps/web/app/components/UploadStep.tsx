'use client';

import { useState } from 'react';
import DropZone from './DropZone';

interface UploadStepProps {
  onSubmit: (file: File, jobDescription: string) => void;
  apiError: string | null;
  onResetApiError: () => void;
}

export default function UploadStep({ onSubmit, apiError, onResetApiError }: UploadStepProps) {
  const [file, setFile] = useState<File | null>(null);
  const [jd, setJd] = useState('');

  function handleFile(incoming: File) {
    setFile(incoming);
    // Clear any API error when user selects a new file
    if (apiError) onResetApiError();
  }

  function handleReset() {
    setFile(null);
    onResetApiError();
  }

  function handleJdChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    if (value.length <= 5000) setJd(value);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !jd.trim()) return;
    onSubmit(file, jd);
  }

  const isDisabled = !file || !jd.trim();

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto px-6 py-12">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left column: resume drop zone */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Your Resume
          </label>
          <DropZone
            file={file}
            onFile={handleFile}
            error={apiError}
            onReset={handleReset}
          />
        </div>

        {/* Right column: job description textarea */}
        <div>
          <label
            htmlFor="job-description"
            className="block text-sm font-semibold text-gray-700 mb-2"
          >
            Job Description
          </label>
          <textarea
            id="job-description"
            value={jd}
            onChange={handleJdChange}
            placeholder="Paste the job description here..."
            className="w-full min-h-[240px] rounded-lg border border-gray-300 p-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-gray-900"
          />
          <p className="mt-1 text-xs text-gray-400 text-right">
            {jd.length.toLocaleString()} / 5,000 characters
          </p>
        </div>
      </div>

      {/* Submit button */}
      <div className="mt-8 flex justify-center">
        <button
          type="submit"
          disabled={isDisabled}
          className={`px-8 py-3 rounded-lg text-sm font-semibold transition-colors ${
            isDisabled
              ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
              : 'bg-gray-900 text-white hover:bg-gray-700'
          }`}
        >
          Analyze Resume &rarr;
        </button>
      </div>
    </form>
  );
}
