import { TranscriptLine } from '@/types';
import {
  SessionManager,
  SessionManagerDeps,
} from '@/services/session-manager';
import { eventBus } from '@/lib/event-bus-instance';

const globalForSessionManager = globalThis as unknown as {
  sessionManager?: SessionManager;
};

/**
 * Stub dependencies — replaced once TICKET-005 (RulesEngine),
 * TICKET-006 (PlaybackService/TranscriptService), and
 * TICKET-007 (CoachingService/ScorecardService) merge to main.
 */
function createDeps(): SessionManagerDeps {
  return {
    eventBus,
    rulesEngine: {
      evaluate: () => [],
      resetCooldowns: () => {},
    },
    coachingService: {
      processTriggeredRules: async () => [],
    },
    scorecardService: {
      generate: async () => ({
        entries: [],
        overallScore: 0,
        summary: '',
      }),
    },
    rules: [],
    createPlaybackService: () => ({
      loadFixture: () => {},
      start: (_onLine: (line: TranscriptLine) => void, onComplete: () => void) => {
        onComplete();
      },
      stop: () => {},
    }),
    createTranscriptService: (
      onLineAdded: (line: TranscriptLine, window: TranscriptLine[]) => void,
    ) => {
      const transcript: TranscriptLine[] = [];
      return {
        addLine: (line: TranscriptLine) => {
          transcript.push(line);
          onLineAdded(line, transcript.slice(-10));
        },
        getTranscript: () => [...transcript],
      };
    },
  };
}

export const sessionManager =
  globalForSessionManager.sessionManager ?? new SessionManager(createDeps());

if (process.env.NODE_ENV !== 'production') {
  globalForSessionManager.sessionManager = sessionManager;
}
