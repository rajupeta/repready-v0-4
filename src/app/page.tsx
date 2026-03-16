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
  const [showScorecard, setShowScorecard] = useState(false);

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

  // Show scorecard when session completes
  useEffect(() => {
    if (scorecard) {
      setSessionStatus('completed');
      setShowScorecard(true);
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
    <main className="flex h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-blue-700 px-6 py-4 shadow-md">
        <h1 className="text-2xl font-bold text-white">RepReady</h1>
        <p className="text-sm text-blue-200">AI Sales Coaching</p>
      </header>

      {/* Controls */}
      <div className="mx-auto w-full max-w-7xl px-6 py-4">
        <div className="flex flex-col gap-3 rounded-xl bg-white p-4 shadow-sm sm:flex-row sm:items-center">
          <select
            value={selectedFixture}
            onChange={(e) => setSelectedFixture(e.target.value)}
            disabled={sessionStatus === 'loading' || sessionStatus === 'active'}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 transition hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none disabled:opacity-50"
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
            className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 hover:shadow-md active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {sessionStatus === 'loading' ? 'Starting...' : 'Start Session'}
          </button>

          {sessionStatus === 'active' && (
            <>
              <button
                onClick={handleEndCall}
                className="rounded-lg bg-red-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 hover:shadow-md active:bg-red-800"
              >
                End Call
              </button>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-green-600">
                <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-green-500" />
                Live
              </span>
            </>
          )}
          {sessionStatus === 'completed' && (
            <span className="text-sm font-medium text-gray-500">Session Complete</span>
          )}
        </div>
      </div>

      {/* Two-column grid — fills remaining viewport */}
      <div className="mx-auto w-full max-w-7xl flex-1 overflow-hidden px-6 pb-6">
        <div className="grid h-full grid-cols-1 gap-6 md:grid-cols-2">
          <TranscriptPanel lines={lines} />
          <CoachingPanel prompts={prompts} />
        </div>
      </div>

      {/* Scorecard — full-width replacing split layout */}
      {showScorecard && scorecard && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-gray-50/95 p-6">
          <div className="mx-auto max-w-2xl">
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
