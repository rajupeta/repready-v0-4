import { TranscriptLine } from '@/types';
import {
  SessionManager,
  SessionManagerDeps,
} from '@/services/session-manager';
import { eventBus } from '@/lib/event-bus-instance';
import { RulesEngine } from '@/services/rules-engine';
import { CoachingService } from '@/services/coaching-service';
import { ScorecardService } from '@/services/scorecard-service';
import { PlaybackService } from '@/services/playback-service';
import { TranscriptService } from '@/services/transcript-service';
import { ClaudeService } from '@/services/claude-service';
import { TranscriptGeneratorService } from '@/services/transcript-generator-service';
import { coachingRules } from '@/rules/coaching-rules';

const globalForSessionManager = globalThis as unknown as {
  sessionManager?: SessionManager;
};

function createDeps(): SessionManagerDeps {
  const claudeService = new ClaudeService();
  const rulesEngine = new RulesEngine(coachingRules);
  const coachingService = new CoachingService(claudeService);
  const scorecardService = new ScorecardService(claudeService);
  const transcriptGeneratorService = new TranscriptGeneratorService();

  return {
    eventBus,
    rulesEngine,
    coachingService,
    scorecardService,
    transcriptGeneratorService,
    rules: coachingRules,
    createPlaybackService: (fixtureId: string) => new PlaybackService(fixtureId),
    createTranscriptService: (
      onLineAdded: (line: TranscriptLine, window: TranscriptLine[]) => void,
    ) => new TranscriptService(onLineAdded),
  };
}

export const sessionManager =
  globalForSessionManager.sessionManager ?? new SessionManager(createDeps());

if (process.env.NODE_ENV !== 'production') {
  globalForSessionManager.sessionManager = sessionManager;
}
