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
      const line: TranscriptLine = JSON.parse(event.data);
      setLines((prev) => [...prev, line]);
    });

    es.addEventListener('coaching_prompt', (event: MessageEvent) => {
      const prompt: CoachingPrompt = JSON.parse(event.data);
      setPrompts((prev) => [...prev, prompt]);
    });

    es.addEventListener('session_complete', (event: MessageEvent) => {
      const data: Scorecard = JSON.parse(event.data);
      setScorecard(data);
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
