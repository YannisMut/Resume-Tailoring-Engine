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

  // Status badge styles
  const statusBadge: Record<BulletDecision['status'], string> = {
    pending: 'bg-gray-100 text-gray-500',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-600',
    edited: 'bg-blue-100 text-blue-700',
  };

  return (
    <div className={`rounded-lg border p-4 transition-colors ${
      bullet.status === 'approved' || bullet.status === 'edited'
        ? 'border-green-200 bg-green-50'
        : bullet.status === 'rejected'
        ? 'border-red-200 bg-red-50'
        : 'border-gray-200 bg-white'
    }`}>
      {/* Status badge */}
      <div className="mb-3 flex items-center justify-between">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadge[bullet.status]}`}>
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
            className="text-xs text-gray-500 underline hover:text-gray-700"
          >
            Revert
          </button>
        )}
      </div>

      {/* Two-column: original | rewrite */}
      <div className="grid grid-cols-2 gap-4">
        {/* Left: original */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">Original</p>
          <p className="text-sm text-gray-700">{bullet.original}</p>
        </div>

        {/* Right: rewrite or edit textarea */}
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">AI Rewrite</p>
          {isEditing ? (
            <div>
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                className="w-full rounded border border-gray-300 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 min-h-[80px] resize-y"
                aria-label="Edit bullet text"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  aria-label="Save"
                  onClick={handleSave}
                  className="rounded bg-gray-900 px-3 py-1 text-xs text-white hover:bg-gray-700"
                >
                  Save
                </button>
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={handleCancel}
                  className="rounded border border-gray-300 px-3 py-1 text-xs text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700">{displayRewrite}</p>
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
            className={`flex-1 rounded py-1.5 text-sm font-medium transition-colors ${
              bullet.status === 'approved' || bullet.status === 'edited'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-green-100 hover:text-green-700'
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
            className="flex-1 rounded bg-gray-100 py-1.5 text-sm font-medium text-gray-700 hover:bg-blue-100 hover:text-blue-700 transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            aria-label="Reject"
            onClick={() => onReject(bullet.id)}
            className={`flex-1 rounded py-1.5 text-sm font-medium transition-colors ${
              bullet.status === 'rejected'
                ? 'bg-red-500 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-red-100 hover:text-red-600'
            }`}
          >
            Reject
          </button>
        </div>
      )}
    </div>
  );
}
