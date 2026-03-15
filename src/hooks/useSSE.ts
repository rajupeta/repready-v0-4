'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TranscriptLine, CoachingPrompt, Scorecard } from '@/types';

interface UseSSEReturn {
  lines: TranscriptLine[];
  prompts: CoachingPrompt[];
  scorecard: Scorecard | null;
  isConnected: boolean;
}

export function useSSE(sessionId: string | null): UseSSEReturn {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [prompts, setPrompts] = useState<CoachingPrompt[]>([]);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
  }, []);

  useEffect(() => {
    if (!sessionId) {
      cleanup();
      setLines([]);
      setPrompts([]);
      setScorecard(null);
      return;
    }

    // Close any existing connection
    cleanup();

    const es = new EventSource(`/api/sessions/${sessionId}/stream`);
    eventSourceRef.current = es;

    es.onopen = () => {
      setIsConnected(true);
    };

    es.addEventListener('transcript', (event: MessageEvent) => {
      const { line } = JSON.parse(event.data) as { line: TranscriptLine };
      setLines((prev) => [...prev, line]);
    });

    es.addEventListener('coaching_prompt', (event: MessageEvent) => {
      const { prompt } = JSON.parse(event.data) as { prompt: CoachingPrompt };
      setPrompts((prev) => [...prev, prompt]);
    });

    es.addEventListener('session_complete', (event: MessageEvent) => {
      const { scorecard } = JSON.parse(event.data) as { scorecard: Scorecard };
      setScorecard(scorecard);
    });

    es.addEventListener('heartbeat', () => {
      // no-op — keeps connection alive
    });

    es.onerror = () => {
      setIsConnected(false);
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [sessionId, cleanup]);

  return { lines, prompts, scorecard, isConnected };
}
