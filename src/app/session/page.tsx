'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/useSSE';
import TranscriptPanel from '@/components/TranscriptPanel';
import CoachingPanel from '@/components/CoachingPanel';
import ScorecardView from '@/components/ScorecardView';
import { CallType } from '@/types';

type SessionStatus = 'idle' | 'loading' | 'active' | 'completed';

const CALL_TYPE_OPTIONS: { value: CallType; label: string; fixtureId: string }[] = [
  { value: 'discovery', label: 'Discovery Call', fixtureId: 'discovery-call' },
  { value: 'demo', label: 'Demo Call', fixtureId: 'demo-call' },
  { value: 'objection-handling', label: 'Objection Handling', fixtureId: 'demo-call' },
  { value: 'follow-up', label: 'Follow-up Call', fixtureId: 'discovery-call' },
];

export default function SessionPage() {
  const [selectedCallType, setSelectedCallType] = useState<CallType>('discovery');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [scorecardDismissed, setScorecardDismissed] = useState(false);

  const { lines, prompts, scorecard, isConnected } = useSSE(sessionId);

  // Track connection status
  useEffect(() => {
    if (isConnected && sessionStatus === 'loading') {
      setSessionStatus('active');
    }
  }, [isConnected, sessionStatus]);

  // Show scorecard when session completes
  useEffect(() => {
    if (scorecard && !scorecardDismissed) {
      setSessionStatus('completed');
    }
  }, [scorecard, scorecardDismissed]);

  async function handleStartSession() {
    const callTypeConfig = CALL_TYPE_OPTIONS.find((o) => o.value === selectedCallType);
    if (!callTypeConfig) return;

    setScorecardDismissed(false);
    setSessionStatus('loading');

    try {
      const createRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId: callTypeConfig.fixtureId }),
      });
      const session = await createRes.json();
      const id = session.sessionId;

      await fetch(`/api/sessions/${id}/start`, { method: 'POST' });

      setSessionId(id);
    } catch {
      setSessionStatus('idle');
    }
  }

  async function handleEndCall() {
    if (!sessionId) return;

    try {
      await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
    } catch {
      // If the API call fails, still transition UI to completed
    }

    setSessionStatus('completed');
  }

  function handleNewSession() {
    setScorecardDismissed(true);
    setSessionId(null);
    setSessionStatus('idle');
  }

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">RepReady</h1>
        <p className="text-sm text-gray-500">AI Sales Coaching</p>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* Controls */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={selectedCallType}
            onChange={(e) => setSelectedCallType(e.target.value as CallType)}
            disabled={sessionStatus === 'loading' || sessionStatus === 'active'}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            aria-label="Select call type"
          >
            {CALL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            onClick={handleStartSession}
            disabled={
              sessionStatus === 'loading' ||
              sessionStatus === 'active'
            }
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sessionStatus === 'loading' ? 'Starting...' : 'Start Session'}
          </button>

          {sessionStatus === 'active' && (
            <button
              onClick={handleEndCall}
              className="rounded-lg bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700"
              aria-label="End Call"
            >
              End Call
            </button>
          )}

          {sessionStatus === 'active' && (
            <span className="text-sm text-green-600">Live</span>
          )}
          {sessionStatus === 'completed' && (
            <span className="text-sm text-gray-500">Session Complete</span>
          )}
        </div>

        {/* Scorecard full-width when session completes */}
        {sessionStatus === 'completed' && scorecard ? (
          <div className="mb-6">
            <ScorecardView scorecard={scorecard} onClose={handleNewSession} />
          </div>
        ) : (
          /* Two-column grid for transcript and coaching */
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <TranscriptPanel lines={lines} />
            <CoachingPanel prompts={prompts} />
          </div>
        )}
      </div>
    </main>
  );
}
