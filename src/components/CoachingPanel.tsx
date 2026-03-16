'use client';

import { CoachingPrompt } from '@/types';
import { CoachingPromptWithTrigger } from '@/hooks/useSSE';

interface CoachingPanelProps {
  prompts: (CoachingPrompt | CoachingPromptWithTrigger)[];
  sessionCompleted?: boolean;
  scorecardLoading?: boolean;
  onGenerateScorecard?: () => void;
}

export default function CoachingPanel({ prompts, sessionCompleted, scorecardLoading, onGenerateScorecard }: CoachingPanelProps) {
  if (prompts.length === 0) {
    return (
      <div className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Coaching</h2>
        {sessionCompleted && onGenerateScorecard && (
          <div className="mb-4 pb-4 border-b border-gray-200">
            <button
              onClick={onGenerateScorecard}
              disabled={scorecardLoading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              data-testid="generate-scorecard-button"
            >
              {scorecardLoading ? 'Loading...' : 'View Scorecard'}
            </button>
          </div>
        )}
        <p className="text-sm text-gray-400">No coaching prompts yet</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-md">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Coaching</h2>
      {sessionCompleted && onGenerateScorecard && (
        <div className="mb-4 pb-4 border-b border-gray-200">
          <button
            onClick={onGenerateScorecard}
            disabled={scorecardLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            data-testid="generate-scorecard-button"
          >
            {scorecardLoading ? 'Loading...' : 'View Scorecard'}
          </button>
        </div>
      )}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {prompts.map((prompt) => (
          <div
            key={prompt.ruleId}
            className="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4 shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="text-sm font-bold text-amber-900">
                {prompt.ruleName}
              </h3>
              {'triggerLineIndex' in prompt && (
                <span className="shrink-0 text-xs text-amber-600">
                  Line {(prompt as CoachingPromptWithTrigger).triggerLineIndex}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm leading-relaxed text-amber-800">{prompt.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
