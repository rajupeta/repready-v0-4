'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/useSSE';
import TranscriptPanel from '@/components/TranscriptPanel';
import CoachingPanel from '@/components/CoachingPanel';
import ScorecardView from '@/components/ScorecardView';

type SessionStatus = 'idle' | 'loading' | 'active' | 'completed';

const CALL_TYPES = [
  { value: 'discovery', label: 'Discovery Call' },
  { value: 'demo', label: 'Demo' },
  { value: 'objection-handling', label: 'Objection Handling' },
  { value: 'follow-up', label: 'Follow-up' },
] as const;

export default function Home() {
  const [selectedCallType, setSelectedCallType] = useState<string>('discovery');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [showScorecard, setShowScorecard] = useState(false);

  const { lines, prompts, scorecard, isConnected } = useSSE(sessionId);

  // Track connection status
  useEffect(() => {
    if (isConnected && sessionStatus === 'loading') {
      setSessionStatus('active');
    }
  }, [isConnected, sessionStatus]);

  // Show scorecard when session completes
  useEffect(() => {
    if (scorecard) {
      setSessionStatus('completed');
      setShowScorecard(true);
    }
  }, [scorecard]);

  async function handleStartSession() {
    if (!selectedCallType) return;
    setSessionStatus('loading');

    try {
      // Create session
      const createRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callType: selectedCallType }),
      });
      const session = await createRes.json();
      const id = session.sessionId;

      // Start session
      await fetch(`/api/sessions/${id}/start`, { method: 'POST' });

      // Connect SSE
      setSessionId(id);
    } catch {
      setSessionStatus('idle');
    }
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">RepReady</h1>
        <p className="text-sm text-gray-500">AI Sales Coaching</p>
      </header>

      {/* Controls */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={selectedCallType}
            onChange={(e) => setSelectedCallType(e.target.value)}
            disabled={sessionStatus === 'loading' || sessionStatus === 'active'}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            aria-label="Select call type"
          >
            {CALL_TYPES.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleStartSession}
            disabled={
              !selectedCallType ||
              sessionStatus === 'loading' ||
              sessionStatus === 'active'
            }
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sessionStatus === 'loading' ? 'Starting...' : 'Start Session'}
          </button>

          {sessionStatus === 'active' && (
            <span className="text-sm text-green-600">Live</span>
          )}
          {sessionStatus === 'completed' && (
            <span className="text-sm text-gray-500">Session Complete</span>
          )}
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <TranscriptPanel lines={lines} />
          <CoachingPanel prompts={prompts} />
        </div>
      </div>

      {/* Scorecard overlay */}
      {showScorecard && scorecard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg">
            <ScorecardView
              scorecard={scorecard}
              onClose={() => setShowScorecard(false)}
            />
          </div>
        </div>
      )}
    </main>
  );
}
