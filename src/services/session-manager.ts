import { EventBus } from '@/services/event-bus';
import { SSEEvent } from '@/types/sse';
import {
  TranscriptLine,
  CoachingRule,
  CoachingPrompt,
  Session,
  Scorecard,
} from '@/types';

export interface IRulesEngine {
  evaluate(window: TranscriptLine[]): CoachingRule[];
  resetCooldowns(): void;
}

export interface ICoachingService {
  processTriggeredRules(
    triggered: CoachingRule[],
    window: TranscriptLine[],
  ): Promise<CoachingPrompt[]>;
}

export interface IScorecardService {
  generate(
    transcript: TranscriptLine[],
    rules: CoachingRule[],
  ): Promise<Scorecard>;
}

export interface ITranscriptService {
  addLine(line: TranscriptLine): void;
  getTranscript(): TranscriptLine[];
}

export interface IPlaybackService {
  loadFixture(): void;
  start(
    onLine: (line: TranscriptLine) => void,
    onComplete: () => void,
  ): void;
  stop(): void;
}

export interface SessionManagerDeps {
  eventBus: EventBus;
  rulesEngine: IRulesEngine;
  coachingService: ICoachingService;
  scorecardService: IScorecardService;
  rules: CoachingRule[];
  createPlaybackService: (fixtureId: string) => IPlaybackService;
  createTranscriptService: (
    onLineAdded: (line: TranscriptLine, window: TranscriptLine[]) => void,
  ) => ITranscriptService;
}

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private deps: SessionManagerDeps;

  constructor(deps: SessionManagerDeps) {
    this.deps = deps;
  }

  createSession(fixtureId: string): string {
    const id = crypto.randomUUID();
    const session: Session = {
      id,
      status: 'idle',
      fixtureId,
      transcript: [],
      events: [],
    };
    this.sessions.set(id, session);
    return id;
  }

  startSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }
    if (session.status !== 'idle') {
      throw new Error(
        `Session ${sessionId} is not idle (status: ${session.status})`,
      );
    }

    session.status = 'active';
    this.deps.rulesEngine.resetCooldowns();

    const emitAndStore = (event: SSEEvent) => {
      session.events.push(event);
      this.deps.eventBus.emit(sessionId, event);
    };

    const transcriptService = this.deps.createTranscriptService(
      (line: TranscriptLine, window: TranscriptLine[]) => {
        session.transcript.push(line);

        emitAndStore({
          type: 'transcript',
          data: { line },
        });

        const triggered = this.deps.rulesEngine.evaluate(window);

        if (triggered.length > 0) {
          this.deps.coachingService
            .processTriggeredRules(triggered, window)
            .then((prompts) => {
              for (const prompt of prompts) {
                emitAndStore({
                  type: 'coaching_prompt',
                  data: { prompt },
                });
              }
            })
            .catch(() => {
              // Silent skip on Claude error per spec
            });
        }
      },
    );

    const playbackService = this.deps.createPlaybackService(session.fixtureId);
    playbackService.loadFixture();

    playbackService.start(
      (line: TranscriptLine) => transcriptService.addLine(line),
      () => {
        this.deps.scorecardService
          .generate(session.transcript, this.deps.rules)
          .then((scorecard) => {
            session.scorecard = scorecard;
            session.status = 'completed';

            emitAndStore({
              type: 'session_complete',
              data: { scorecard },
            });
          })
          .catch(() => {
            session.status = 'completed';
            emitAndStore({
              type: 'session_complete',
              data: { error: 'Scorecard generation failed' },
            });
          });
      },
    );
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  getEvents(sessionId: string): SSEEvent[] | undefined {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return undefined;
    }
    return [...session.events];
  }

  getScorecard(sessionId: string): Scorecard | undefined {
    const session = this.sessions.get(sessionId);
    if (session && session.status === 'completed') {
      return session.scorecard;
    }
    return undefined;
  }
}
