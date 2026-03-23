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
      {/* Hero headline */}
      <div className="text-center mb-10">
        <h1 className="font-heading text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">
          Tailor Your Resume in Seconds
        </h1>
        <p className="mt-3 text-lg text-slate-500 max-w-2xl mx-auto">
          Upload your resume and paste the job description. Our AI analyzes keyword gaps and rewrites your bullets to match.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left column: resume drop zone */}
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
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
        <div className="bg-white rounded-2xl shadow-md border border-slate-100 p-6">
          <label
            htmlFor="job-description"
            className="block text-sm font-semibold text-slate-700 mb-3"
          >
            Job Description
          </label>
          <textarea
            id="job-description"
            value={jd}
            onChange={handleJdChange}
            placeholder="Paste the job description here..."
            className="w-full min-h-[240px] rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-shadow shadow-sm"
          />
          <p className="mt-2 text-xs text-slate-400 text-right">
            {jd.length.toLocaleString()} / 5,000 characters
          </p>
        </div>
      </div>

      {/* Submit button */}
      <div className="mt-10 flex justify-center">
        <button
          type="submit"
          disabled={isDisabled}
          className={`flex items-center gap-2 px-10 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 ${
            isDisabled
              ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
              : 'bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg active:scale-[0.98]'
          }`}
        >
          Analyze Resume
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>
      </div>
    </form>
  );
}
