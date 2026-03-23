'use client';

import { useState } from 'react';
import type { BulletDecision } from '../lib/types';

interface BulletCardProps {
  bullet: BulletDecision;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onEdit: (id: string, text: string) => void;
  onRevert: (id: string) => void;
}

export default function BulletCard({ bullet, onAccept, onReject, onEdit, onRevert }: BulletCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(bullet.rewritten);

  const displayRewrite =
    bullet.status === 'edited' && bullet.editedText != null
      ? bullet.editedText
      : bullet.rewritten;

  const hasDecision = bullet.status !== 'pending';

  function handleSave() {
    onEdit(bullet.id, editText);
    setIsEditing(false);
  }

  function handleCancel() {
    setEditText(displayRewrite);
    setIsEditing(false);
  }

  // Status badge config
  const statusConfig: Record<BulletDecision['status'], { className: string; icon: React.ReactNode }> = {
    pending: {
      className: 'bg-slate-100 text-slate-500',
      icon: null,
    },
    approved: {
      className: 'bg-success-100 text-success-700',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      ),
    },
    rejected: {
      className: 'bg-danger-100 text-danger-600',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
    },
    edited: {
      className: 'bg-primary-100 text-primary-700',
      icon: (
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487z" />
        </svg>
      ),
    },
  };

  const badge = statusConfig[bullet.status];

  return (
    <div className={`rounded-xl border p-5 transition-all duration-200 shadow-sm hover:shadow-md ${
      bullet.status === 'approved' || bullet.status === 'edited'
        ? 'border-success-200 bg-success-50/60'
        : bullet.status === 'rejected'
        ? 'border-danger-200 bg-danger-50/60'
        : 'border-slate-200 bg-white'
    }`}>
      {/* Status badge + revert */}
      <div className="mb-4 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${badge.className}`}>
          {badge.icon}
          {bullet.status}
        </span>
        {hasDecision && (
          <button
            type="button"
            aria-label="Revert"
            onClick={() => {
              onRevert(bullet.id);
              setIsEditing(false);
              setEditText(bullet.rewritten);
            }}
            className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-primary-600 transition-colors font-medium"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" />
            </svg>
            Revert
          </button>
        )}
      </div>

      {/* Two-column: original | rewrite */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: original */}
        <div className="pl-3 border-l-2 border-slate-200">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Original</p>
          <p className="text-sm text-slate-700 leading-relaxed">{bullet.original}</p>
        </div>

        {/* Right: rewrite or edit textarea */}
        <div className="pl-3 border-l-2 border-primary-200">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">AI Rewrite</p>
          {isEditing ? (
            <div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 min-h-[80px] resize-y shadow-sm"
                aria-label="Edit bullet text"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  aria-label="Save"
                  onClick={handleSave}
                  className="rounded-lg bg-primary-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary-700 transition-colors shadow-sm"
                >
                  Save
                </button>
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={handleCancel}
                  className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed">{displayRewrite}</p>
          )}
        </div>
      </div>

      {/* Action buttons (only in non-editing state) */}
      {!isEditing && (
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            aria-label="Accept"
            onClick={() => onAccept(bullet.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-150 border ${
              bullet.status === 'approved' || bullet.status === 'edited'
                ? 'bg-success-600 text-white border-success-600 shadow-sm'
                : 'bg-success-50 text-success-700 border-success-200 hover:bg-success-100'
            }`}
          >
            Accept
          </button>
          <button
            type="button"
            aria-label="Edit"
            onClick={() => {
              setEditText(displayRewrite);
              setIsEditing(true);
            }}
            className="flex-1 rounded-lg bg-primary-50 py-2 text-sm font-semibold text-primary-700 border border-primary-200 hover:bg-primary-100 transition-all duration-150"
          >
            Edit
          </button>
          <button
            type="button"
            aria-label="Reject"
            onClick={() => onReject(bullet.id)}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold transition-all duration-150 border ${
              bullet.status === 'rejected'
                ? 'bg-danger-500 text-white border-danger-500 shadow-sm'
                : 'bg-danger-50 text-danger-600 border-danger-200 hover:bg-danger-100'
            }`}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
