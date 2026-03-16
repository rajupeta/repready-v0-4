'use client';

import { useEffect, useRef } from 'react';
import { TranscriptLine } from '@/types';

interface TranscriptPanelProps {
  lines: TranscriptLine[];
}

export default function TranscriptPanel({ lines }: TranscriptPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [lines]);

  if (lines.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-xl bg-white p-5 shadow-md">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Transcript</h2>
        <p className="text-sm text-gray-400">Waiting for call to start...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-xl bg-white p-5 shadow-md">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Transcript</h2>
      <div
        ref={containerRef}
        className="flex-1 space-y-3 overflow-y-auto pr-1"
      >
        {lines.map((line, index) => (
          <div key={index} className="flex items-start gap-3">
            <span
              className={`inline-flex shrink-0 items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${
                line.speaker === 'rep'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-500 text-white'
              }`}
            >
              {line.speaker === 'rep' ? 'Rep' : 'Prospect'}
            </span>
            <span className="text-sm leading-relaxed text-gray-700">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
