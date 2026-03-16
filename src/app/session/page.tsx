'use client';

import { useState, useEffect, useRef } from 'react';
import { useSSE } from '@/hooks/useSSE';
import TranscriptPanel from '@/components/TranscriptPanel';
import CoachingPanel from '@/components/CoachingPanel';
import ScorecardSlideOut from '@/components/ScorecardSlideOut';

type SessionStatus = 'idle' | 'loading' | 'active' | 'completed';

interface CallTypeOption {
  callType: string;
  displayName: string;
}

export default function Home() {
  const [callTypes, setCallTypes] = useState<CallTypeOption[]>([]);
  const [selectedCallType, setSelectedCallType] = useState<string>('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('idle');
  const [showScorecard, setShowScorecard] = useState(false);
  const [scorecardData, setScorecardData] = useState<import('@/types').Scorecard | null>(null);
  const [scorecardLoading, setScorecardLoading] = useState(false);
  const pendingStartIdRef = useRef<string | null>(null);

  const { lines, prompts, scorecard, sessionComplete, isConnected } = useSSE(sessionId);

  // Only show coaching prompts after their triggering transcript line is visible
  const visiblePrompts = prompts.filter(p => p.triggerLineIndex > 0 && p.triggerLineIndex <= lines.length);

  // Fetch call types on mount
  useEffect(() => {
    fetch('/api/fixtures')
      .then((res) => res.json())
      .then((data: CallTypeOption[]) => {
        setCallTypes(data);
        if (data.length > 0) {
          setSelectedCallType(data[0].callType);
        }
      })
      .catch(() => {
        // silently handle fetch errors on mount
      });
  }, []);

  // Start session only after SSE connection is established
  // This prevents coaching prompts from firing before the client receives transcript lines
  useEffect(() => {
    if (isConnected && pendingStartIdRef.current) {
      const id = pendingStartIdRef.current;
      pendingStartIdRef.current = null;
      fetch(`/api/sessions/${id}/start`, { method: 'POST' }).catch(() => {
        setSessionStatus('idle');
      });
    }
  }, [isConnected]);

  // Track connection status
  useEffect(() => {
    if (isConnected && sessionStatus === 'loading') {
      setSessionStatus('active');
    }
  }, [isConnected, sessionStatus]);

  // Update status when session completes (independent of scorecard)
  useEffect(() => {
    if (sessionComplete) {
      setSessionStatus('completed');
    }
  }, [sessionComplete]);

  async function handleStartSession() {
    if (!selectedCallType) return;
    // Clear previous session data
    handleNewSession();
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

      // Connect SSE FIRST — must subscribe before starting playback
      // so no transcript or coaching events are missed
      pendingStartIdRef.current = id;
      setSessionId(id);
      // The useEffect above will call /start once the SSE connection is established
    } catch {
      setSessionStatus('idle');
    }
  }

  async function handleEndCall() {
    if (!sessionId || sessionStatus !== 'active') return;
    if (!window.confirm('Are you sure you want to end this call?')) return;

    setSessionStatus('completed');
    try {
      await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' });
    } catch {
      // SSE session_complete event will handle the status transition
    }
  }

  async function handleGenerateScorecard() {
    // Use cached scorecard from SSE if available
    if (scorecard) {
      setScorecardData(scorecard);
      setShowScorecard(true);
      return;
    }

    // Otherwise fetch from API
    if (!sessionId) return;
    setScorecardLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/scorecard`);
      if (res.ok) {
        const data = await res.json();
        setScorecardData(data);
        setShowScorecard(true);
      } else {
        // Scorecard not ready yet — try ending session first to trigger generation
        await fetch(`/api/sessions/${sessionId}/end`, { method: 'POST' }).catch(() => {});
        // Wait a moment for scorecard to generate, then retry
        await new Promise(r => setTimeout(r, 3000));
        const retryRes = await fetch(`/api/sessions/${sessionId}/scorecard`);
        if (retryRes.ok) {
          const data = await retryRes.json();
          setScorecardData(data);
          setShowScorecard(true);
        }
      }
    } catch {
      // silently handle fetch errors
    } finally {
      setScorecardLoading(false);
    }
  }

  function handleNewSession() {
    setShowScorecard(false);
    setScorecardData(null);
    setScorecardLoading(false);
    setSessionId(null);
    setSessionStatus('idle');
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
            value={selectedCallType}
            onChange={(e) => setSelectedCallType(e.target.value)}
            disabled={sessionStatus === 'loading' || sessionStatus === 'active'}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            aria-label="Select call type"
          >
            {callTypes.map((ct) => (
              <option key={ct.callType} value={ct.callType}>
                {ct.displayName}
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

          {sessionStatus === 'completed' && (
            <button
              onClick={handleNewSession}
              className="rounded-lg bg-green-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
            >
              New Session
            </button>
          )}
        </div>
      </div>

      {/* Main content area — transcript + coaching always visible */}
      <div className="min-h-0 flex-1 px-6 py-6">
        <div className="mx-auto h-full max-w-7xl">
          <div className="grid h-full grid-cols-1 gap-6 md:grid-cols-2">
            <TranscriptPanel lines={lines} />
            <CoachingPanel
              prompts={visiblePrompts}
              sessionCompleted={sessionStatus === 'completed'}
              scorecardLoading={scorecardLoading}
              onGenerateScorecard={handleGenerateScorecard}
            />
          </div>
        </div>
      </div>

      {/* Scorecard slide-out panel */}
      {scorecardData && (
        <ScorecardSlideOut
          scorecard={scorecardData}
          isOpen={showScorecard}
          onClose={() => setShowScorecard(false)}
          onNewSession={handleNewSession}
        />
      )}
    </main>
  );
}
