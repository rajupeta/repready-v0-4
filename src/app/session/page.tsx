'use client';

import { useState, useEffect } from 'react';
import { useSSE } from '@/hooks/useSSE';
import TranscriptPanel from '@/components/TranscriptPanel';
import CoachingPanel from '@/components/CoachingPanel';
import ScorecardView from '@/components/ScorecardView';

type SessionStatus = 'idle' | 'loading' | 'active' | 'completed';

export default function Home() {
  const [fixtures, setFixtures] = useState<string[]>([]);
  const [selectedFixture, setSelectedFixture] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const { lines, prompts, scorecard, isConnected } = useSSE(sessionId);

  // Fetch fixtures on mount
  useEffect(() => {
    fetch('/api/fixtures')
      .then((res) => res.json())
      .then((data: string[]) => {
        setFixtures(data);
        if (data.length > 0) {
          setSelectedFixture(data[0]);
        }
      })
      .catch(() => {
        // silently handle fetch errors on mount
      });
  }, []);

  // Track connection status
  useEffect(() => {
    if (isConnected && sessionStatus === 'loading') {
      setSessionStatus('active');
    }
  }, [isConnected, sessionStatus]);

  // Update status when session completes
  useEffect(() => {
    if (scorecard) {
      setSessionStatus('completed');
    }
  }, [scorecard]);

  async function handleStartSession() {
    if (!selectedFixture) return;
    setSessionStatus('loading');

    try {
      // Create session
      const createRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId: selectedFixture }),
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

  async function handleEndCall() {
    if (!sessionId) return;

    try {
      await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
    } catch {
      // SSE session_complete event will handle the status transition
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
            value={selectedFixture}
            onChange={(e) => setSelectedFixture(e.target.value)}
            disabled={sessionStatus === 'loading' || sessionStatus === 'active'}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            aria-label="Select fixture"
          >
            {fixtures.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>

          <button
            onClick={handleStartSession}
            disabled={
              !selectedFixture ||
              sessionStatus === 'loading' ||
              sessionStatus === 'active'
            }
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sessionStatus === 'loading' ? 'Starting...' : 'Start Session'}
          </button>

          {sessionStatus === 'active' && (
            <>
              <button
                onClick={handleEndCall}
                className="rounded-lg bg-red-600 px-6 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                End Call
              </button>
              <span className="text-sm text-green-600">Live</span>
            </>
          )}
          {sessionStatus === 'completed' && (
            <span className="text-sm text-gray-500">Session Complete</span>
          )}
        </div>

        {/* Scorecard inline or Two-column grid */}
        {scorecard ? (
          <ScorecardView scorecard={scorecard} />
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <TranscriptPanel lines={lines} />
            <CoachingPanel prompts={prompts} />
          </div>
        )}
      </div>
    </main>
  );
}
