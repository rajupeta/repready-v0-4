'use client';

import { CoachingPrompt } from '@/types';

interface CoachingPanelProps {
  prompts: CoachingPrompt[];
}

export default function CoachingPanel({ prompts }: CoachingPanelProps) {
  if (prompts.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Coaching</h2>
        <p className="text-sm text-gray-500">No coaching prompts yet</p>
      </div>
    );
  }

  const sorted = [...prompts].reverse();

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Coaching</h2>
      <div className="space-y-3">
        {sorted.map((prompt, index) => (
          <div
            key={index}
            className="rounded-lg border border-amber-200 bg-amber-50 p-4"
          >
            <h3 className="text-sm font-semibold text-amber-800">
              {prompt.ruleName}
            </h3>
            <p className="mt-1 text-sm text-amber-700">{prompt.message}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
