'use client';

import { Scorecard } from '@/types';

interface ScorecardViewProps {
  scorecard: Scorecard;
  onClose?: () => void;
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

export default function ScorecardView({ scorecard, onClose }: ScorecardViewProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-lg">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Scorecard</h2>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            New Session
          </button>
        )}
      </div>

      <div className="mb-8 text-center">
        <div className={`text-7xl font-extrabold ${scoreColor(scorecard.overallScore)}`}>
          {scorecard.overallScore}
        </div>
        <p className="mt-2 text-sm font-medium text-gray-500">Overall Score</p>
      </div>

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

      <div className="rounded-lg bg-blue-50 p-4">
        <p className="text-sm leading-relaxed text-gray-700">{scorecard.summary}</p>
      </div>
    </div>
  );
}
