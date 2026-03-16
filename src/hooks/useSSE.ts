'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { TranscriptLine, CoachingPrompt, Scorecard } from '@/types';

interface UseSSEReturn {
  lines: TranscriptLine[];
  prompts: CoachingPrompt[];
  scorecard: Scorecard | null;
  sessionComplete: boolean;
  isConnected: boolean;
}

export function useSSE(sessionId: string | null): UseSSEReturn {
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [prompts, setPrompts] = useState<CoachingPrompt[]>([]);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [sessionComplete, setSessionComplete] = useState(false);
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
      setSessionComplete(false);
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
      setPrompts((prev) => {
        const existingIdx = prev.findIndex((p) => p.ruleId === prompt.ruleId);
        if (existingIdx >= 0) {
          // Replace existing prompt for this rule with the latest one
          const updated = [...prev];
          updated[existingIdx] = prompt;
          return updated;
        }
        return [...prev, prompt];
      });
    });

    es.addEventListener('session_complete', (event: MessageEvent) => {
      const data = JSON.parse(event.data) as { scorecard?: Scorecard };
      if (data.scorecard) {
        setScorecard(data.scorecard);
      }
      setSessionComplete(true);
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

  return { lines, prompts, scorecard, sessionComplete, isConnected };
}
