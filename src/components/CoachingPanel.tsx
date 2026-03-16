'use client';

import { CoachingPrompt } from '@/types';

interface CoachingPanelProps {
  prompts: CoachingPrompt[];
  sessionCompleted?: boolean;
  onGenerateScorecard?: () => void;
}

export default function CoachingPanel({ prompts, sessionCompleted, onGenerateScorecard }: CoachingPanelProps) {
  if (prompts.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Coaching</h2>
        <p className="text-sm text-gray-400">No coaching prompts yet</p>
        {sessionCompleted && onGenerateScorecard && (
          <div className="mt-auto pt-4 border-t border-gray-200">
            <button
              onClick={onGenerateScorecard}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              Generate Scorecard
            </button>
          </div>
        )}
      </div>
    );
  }

  const sorted = [...prompts].reverse();

  return (
    <div className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-md">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Coaching</h2>
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {sorted.map((prompt, index) => (
          <div
            key={index}
            className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 shadow-sm"
          >
            <h3 className="text-sm font-bold text-amber-900">
              {prompt.ruleName}
            </h3>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">{prompt.message}</p>
          </div>
        ))}
      </div>
      {sessionCompleted && onGenerateScorecard && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <button
            onClick={onGenerateScorecard}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Generate Scorecard
          </button>
        </div>
      )}
    </div>
  );
}
