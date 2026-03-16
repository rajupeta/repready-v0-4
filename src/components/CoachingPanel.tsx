'use client';

import { CoachingPrompt } from '@/types';

interface CoachingPanelProps {
  prompts: CoachingPrompt[];
}

export default function CoachingPanel({ prompts }: CoachingPanelProps) {
  if (prompts.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-xl bg-white p-5 shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Coaching</h2>
        <p className="text-sm text-gray-400">No coaching prompts yet</p>
      </div>
    );
  }

  const sorted = [...prompts].reverse();

  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-5 shadow-md">
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
    </div>
  );
}
