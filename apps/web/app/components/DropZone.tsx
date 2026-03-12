'use client';

import { useRef, useState } from 'react';
import { PDF_ERROR_MESSAGES } from '../lib/errors';

interface DropZoneProps {
  onFile: (file: File) => void;
  error: string | null;
  onReset: () => void;
  file: File | null;
}

export default function DropZone({ onFile, error, onReset, file }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = error ?? localError;

  function validateAndSetFile(incoming: File) {
    setLocalError(null);

    if (
      !incoming.name.toLowerCase().endsWith('.pdf') &&
      incoming.type !== 'application/pdf'
    ) {
      setLocalError(PDF_ERROR_MESSAGES['pdf_not_pdf']!);
      return;
    }

    if (incoming.size > 10 * 1024 * 1024) {
      setLocalError(PDF_ERROR_MESSAGES['pdf_too_large']!);
      return;
    }

    onFile(incoming);
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const dropped = e.dataTransfer.files[0];
    if (dropped) validateAndSetFile(dropped);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (picked) validateAndSetFile(picked);
    // Reset input so the same file can be re-selected after a reset
    e.target.value = '';
  }

  function handleReset() {
    setLocalError(null);
    onReset();
    if (inputRef.current) inputRef.current.value = '';
  }

  // Determine border style
  let borderClass = 'border-2 border-dashed border-gray-300';
  if (isDragging) borderClass = 'border-2 border-dashed border-gray-900';
  if (displayError) borderClass = 'border-2 border-dashed border-red-500';
  if (file && !displayError) borderClass = 'border-2 border-gray-300';

  return (
    <div>
      <div
        className={`${borderClass} flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-lg bg-gray-50 p-6 transition-colors hover:bg-gray-100`}
        onClick={() => !displayError && inputRef.current?.click()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!displayError) inputRef.current?.click();
          }
        }}
        aria-label="Drop zone for resume PDF"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={handleInputChange}
          aria-hidden="true"
          tabIndex={-1}
        />

        {displayError ? (
          /* Error state */
          <div className="flex flex-col items-center gap-3 text-center">
            <svg
              className="h-10 w-10 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
            <p className="text-sm font-medium text-red-600">{displayError}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="mt-1 rounded-md bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              Try another file
            </button>
          </div>
        ) : file ? (
          /* File selected state */
          <div className="flex flex-col items-center gap-3 text-center">
            <svg
              className="h-10 w-10 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
            <p className="text-sm font-medium text-gray-900">{file.name}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReset();
              }}
              className="text-sm text-gray-500 underline hover:text-gray-700"
            >
              Change file
            </button>
          </div>
        ) : (
          /* Default / drag state */
          <div className="flex flex-col items-center gap-3 text-center">
            <svg
              className="h-10 w-10 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-700">
                Drop your resume here or{' '}
                <span className="text-gray-900 underline">click to browse</span>
              </p>
              <p className="mt-1 text-xs text-gray-400">PDF only &middot; max 10MB</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
