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
    <main className="flex h-screen flex-col bg-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">RepReady</h1>
            <p className="text-sm text-gray-500">AI Sales Coaching</p>
          </div>
          {sessionStatus === 'active' && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Live
            </span>
          )}
          {sessionStatus === 'completed' && (
            <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-600">
              Session Complete
            </span>
          )}
        </div>
      </header>

      {/* Controls */}
      <div className="border-b border-gray-200 bg-white px-6 py-3 shadow-sm">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={selectedFixture}
            onChange={(e) => setSelectedFixture(e.target.value)}
            disabled={sessionStatus === 'loading' || sessionStatus === 'active'}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sessionStatus === 'loading' ? 'Starting...' : 'Start Session'}
          </button>

          {sessionStatus === 'active' && (
            <button
              onClick={handleEndCall}
              className="rounded-lg bg-red-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            >
              End Call
            </button>
          )}
        </div>
      </div>

      {/* Main content area — fills remaining viewport */}
      <div className="min-h-0 flex-1 px-6 py-6">
        <div className="mx-auto h-full max-w-7xl">
          {/* Scorecard replaces split view when session completes */}
          {scorecard ? (
            <ScorecardView scorecard={scorecard} />
          ) : (
            <div className="grid h-full grid-cols-1 gap-6 md:grid-cols-2">
              <TranscriptPanel lines={lines} />
              <CoachingPanel prompts={prompts} />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
