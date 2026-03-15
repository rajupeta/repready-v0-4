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
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Transcript</h2>
        <p className="text-sm text-gray-500">Waiting for call to start...</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Transcript</h2>
      <div
        ref={containerRef}
        className="max-h-96 space-y-2 overflow-y-auto"
      >
        {lines.map((line, index) => (
          <div key={index} className="flex items-start gap-2">
            <span
              className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-xs font-medium ${
                line.speaker === 'rep'
                  ? 'bg-blue-100 text-blue-800'
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {line.speaker === 'rep' ? 'Rep' : 'Prospect'}
            </span>
            <span className="text-sm text-gray-700">{line.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
