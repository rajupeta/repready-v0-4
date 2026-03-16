'use client';

import { Scorecard } from '@/types';

interface ScorecardSlideOutProps {
  scorecard: Scorecard;
  isOpen: boolean;
  onClose: () => void;
  onNewSession: () => void;
}

const assessmentStyles = {
  good: 'bg-green-100 text-green-800 ring-1 ring-green-200',
  'needs-work': 'bg-yellow-100 text-yellow-800 ring-1 ring-yellow-200',
  missed: 'bg-red-100 text-red-800 ring-1 ring-red-200',
} as const;

function scoreColor(score: number): string {
  if (score >= 70) return 'text-green-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

export default function ScorecardSlideOut({
  scorecard,
  isOpen,
  onClose,
  onNewSession,
}: ScorecardSlideOutProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 transition-opacity"
          onClick={onClose}
          data-testid="scorecard-backdrop"
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-label="Scorecard"
        data-testid="scorecard-slideout"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">Scorecard</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Close scorecard"
            data-testid="scorecard-close-button"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6" data-testid="scorecard-content">
          {/* Overall score */}
          <div className="mb-8 text-center">
            <div className={`text-7xl font-extrabold ${scoreColor(scorecard.overallScore)}`}>
              {scorecard.overallScore}
            </div>
            <p className="mt-2 text-sm font-medium text-gray-500">Overall Score</p>
          </div>

          {/* Rule entries */}
          <div className="mb-6 space-y-3">
            {scorecard.entries.map((entry) => (
              <div
                key={entry.ruleId}
                className="flex items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-4 shadow-sm"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">
                      {entry.ruleName}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-md px-2.5 py-0.5 text-xs font-bold ${assessmentStyles[entry.assessment]}`}
                    >
                      {entry.assessment}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-gray-600">{entry.comment}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="rounded-lg bg-blue-50 p-4">
            <p className="text-sm leading-relaxed text-gray-700">{scorecard.summary}</p>
          </div>
        </div>

        {/* Footer with New Session button */}
        <div className="border-t border-gray-200 px-6 py-4">
          <button
            onClick={onNewSession}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            data-testid="new-session-button"
          >
            New Session
          </button>
        </div>
      </div>
    </>
  );
}
