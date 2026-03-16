import { SSEEvent } from '@/types/sse';
import {
  TranscriptLine,
  CoachingRule,
  CoachingPrompt,
  Scorecard,
} from '@/types';
import {
  SessionManager,
  SessionManagerDeps,
  IRulesEngine,
  ICoachingService,
  IScorecardService,
  IPlaybackService,
} from '@/services/session-manager';

function createMockRule(overrides: Partial<CoachingRule> = {}): CoachingRule {
  return {
    ruleId: 'test-rule',
    name: 'Test Rule',
    description: 'A test rule',
    cooldownMs: 30000,
    callTypes: ['discovery', 'demo', 'objection-handling', 'follow-up'],
    severity: 'medium',
    detect: () => false,
    ...overrides,
  };
}

function createMockScorecard(): Scorecard {
  return {
    entries: [
      {
        ruleId: 'test-rule',
        ruleName: 'Test Rule',
        assessment: 'good',
        comment: 'Well done',
      },
    ],
    overallScore: 85,
    summary: 'Good performance',
  };
}

function createMockPrompt(ruleId = 'test-rule'): CoachingPrompt {
  return {
    ruleId,
    ruleName: 'Test Rule',
    message: 'Try asking a question here',
    timestamp: Date.now(),
  };
}

interface MockPlaybackService extends IPlaybackService {
  _onLine?: (line: TranscriptLine) => void;
  _onComplete?: () => void;
}

function createMockDeps(overrides: Partial<SessionManagerDeps> = {}): SessionManagerDeps {
  const mockRulesEngine: IRulesEngine = {
    evaluate: jest.fn().mockReturnValue([]),
    resetCooldowns: jest.fn(),
  };

  const mockCoachingService: ICoachingService = {
    processTriggeredRules: jest.fn().mockResolvedValue([]),
  };

  const mockScorecardService: IScorecardService = {
    generate: jest.fn().mockResolvedValue(createMockScorecard()),
  };

  const mockEventBus = {
    emit: jest.fn(),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    removeAllListeners: jest.fn(),
  };

  const mockPlayback: MockPlaybackService = {
    loadFixture: jest.fn(),
    start: jest.fn((onLine, onComplete) => {
      mockPlayback._onLine = onLine;
      mockPlayback._onComplete = onComplete;
    }),
    stop: jest.fn(),
  };

  return {
    eventBus: mockEventBus as unknown as SessionManagerDeps['eventBus'],
    rulesEngine: mockRulesEngine,
    coachingService: mockCoachingService,
    scorecardService: mockScorecardService,
    rules: [createMockRule()],
    createPlaybackService: jest.fn(() => mockPlayback),
    createTranscriptService: jest.fn((onLineAdded) => {
      const transcript: TranscriptLine[] = [];
      return {
        addLine: (line: TranscriptLine) => {
          transcript.push(line);
          onLineAdded(line, transcript.slice(-10));
        },
        getTranscript: () => [...transcript],
      };
    }),
    ...overrides,
  };
}

describe('SessionManager', () => {
  describe('createSession', () => {
    it('returns a unique session ID', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      const id1 = manager.createSession('discovery-call-001');
      const id2 = manager.createSession('objection-handling-001');

      expect(id1).toBeDefined();
      expect(id2).toBeDefined();
      expect(id1).not.toBe(id2);
    });

    it('stores session with idle status', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      const session = manager.getSession(id);

      expect(session).toBeDefined();
      expect(session!.id).toBe(id);
      expect(session!.status).toBe('idle');
      expect(session!.fixtureId).toBe('discovery-call-001');
      expect(session!.transcript).toEqual([]);
      expect(session!.scorecard).toBeUndefined();
    });
  });

  describe('startSession', () => {
    it('throws if session does not exist', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      expect(() => manager.startSession('nonexistent')).toThrow(
        'Session nonexistent not found',
      );
    });

    it('throws if session is not idle', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      expect(() => manager.startSession(id)).toThrow('is not idle');
    });

    it('transitions session status from idle to active', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      expect(manager.getSession(id)!.status).toBe('active');
    });

    it('resets rules engine cooldowns', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      expect(deps.rulesEngine.resetCooldowns).toHaveBeenCalled();
    });

    it('creates PlaybackService with the correct fixtureId', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      expect(deps.createPlaybackService).toHaveBeenCalledWith('discovery-call-001');
    });

    it('creates TranscriptService with an onLineAdded callback', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      expect(deps.createTranscriptService).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it('loads fixture and starts playback', () => {
      const mockPlayback: MockPlaybackService = {
        loadFixture: jest.fn(),
        start: jest.fn(),
        stop: jest.fn(),
      };
      const deps = createMockDeps({
        createPlaybackService: jest.fn(() => mockPlayback),
      });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      expect(mockPlayback.loadFixture).toHaveBeenCalled();
      expect(mockPlayback.start).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
      );
    });
  });

  describe('transcript pipeline', () => {
    it('emits transcript SSE event when a line is added', () => {
      const emittedEvents: { sessionId: string; event: SSEEvent }[] = [];
      const mockEventBus = {
        emit: jest.fn((sessionId: string, event: SSEEvent) => {
          emittedEvents.push({ sessionId, event });
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockPlayback: MockPlaybackService = {
        loadFixture: jest.fn(),
        start: jest.fn((onLine, onComplete) => {
          mockPlayback._onLine = onLine;
          mockPlayback._onComplete = onComplete;
        }),
        stop: jest.fn(),
      };

      const deps = createMockDeps({
        eventBus: mockEventBus as unknown as SessionManagerDeps['eventBus'],
        createPlaybackService: jest.fn(() => mockPlayback),
      });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      const line: TranscriptLine = {
        speaker: 'rep',
        text: 'Hello there',
        timestamp: 1000,
      };
      mockPlayback._onLine!(line);

      const transcriptEvents = emittedEvents.filter(
        (e) => e.event.type === 'transcript',
      );
      expect(transcriptEvents).toHaveLength(1);
      expect(transcriptEvents[0].sessionId).toBe(id);
      expect(transcriptEvents[0].event.data).toEqual({ line });
    });

    it('adds lines to the session transcript', () => {
      const mockPlayback: MockPlaybackService = {
        loadFixture: jest.fn(),
        start: jest.fn((onLine, onComplete) => {
          mockPlayback._onLine = onLine;
          mockPlayback._onComplete = onComplete;
        }),
        stop: jest.fn(),
      };

      const deps = createMockDeps({
        createPlaybackService: jest.fn(() => mockPlayback),
      });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      const line1: TranscriptLine = {
        speaker: 'rep',
        text: 'Hi',
        timestamp: 1000,
      };
      const line2: TranscriptLine = {
        speaker: 'prospect',
        text: 'Hello',
        timestamp: 2000,
      };

      mockPlayback._onLine!(line1);
      mockPlayback._onLine!(line2);

      const session = manager.getSession(id);
      expect(session!.transcript).toHaveLength(2);
      expect(session!.transcript[0]).toEqual(line1);
      expect(session!.transcript[1]).toEqual(line2);
    });

    it('evaluates rules for each line', () => {
      const mockPlayback: MockPlaybackService = {
        loadFixture: jest.fn(),
        start: jest.fn((onLine, onComplete) => {
          mockPlayback._onLine = onLine;
          mockPlayback._onComplete = onComplete;
        }),
        stop: jest.fn(),
      };

      const deps = createMockDeps({
        createPlaybackService: jest.fn(() => mockPlayback),
      });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      mockPlayback._onLine!({
        speaker: 'rep',
        text: 'Hello',
        timestamp: 1000,
      });

      expect(deps.rulesEngine.evaluate).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ speaker: 'rep', text: 'Hello' }),
        ]),
        id,
      );
    });

    it('calls coachingService when rules trigger and emits coaching_prompt events', async () => {
      const mockPrompt = createMockPrompt();
      const triggeredRule = createMockRule({ ruleId: 'triggered' });

      const emittedEvents: SSEEvent[] = [];
      const mockEventBus = {
        emit: jest.fn((_sid: string, event: SSEEvent) => {
          emittedEvents.push(event);
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockPlayback: MockPlaybackService = {
        loadFixture: jest.fn(),
        start: jest.fn((onLine, onComplete) => {
          mockPlayback._onLine = onLine;
          mockPlayback._onComplete = onComplete;
        }),
        stop: jest.fn(),
      };

      const deps = createMockDeps({
        eventBus: mockEventBus as unknown as SessionManagerDeps['eventBus'],
        rulesEngine: {
          evaluate: jest.fn().mockReturnValue([triggeredRule]),
          resetCooldowns: jest.fn(),
        },
        coachingService: {
          processTriggeredRules: jest
            .fn()
            .mockResolvedValue([mockPrompt]),
        },
        createPlaybackService: jest.fn(() => mockPlayback),
      });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      mockPlayback._onLine!({
        speaker: 'rep',
        text: 'Let me tell you about features',
        timestamp: 1000,
      });

      // Wait for async coaching service call
      await new Promise((r) => setTimeout(r, 10));

      expect(deps.coachingService.processTriggeredRules).toHaveBeenCalledWith(
        [triggeredRule],
        expect.any(Array),
      );

      const coachingEvents = emittedEvents.filter(
        (e) => e.type === 'coaching_prompt',
      );
      expect(coachingEvents).toHaveLength(1);
      expect(coachingEvents[0].data).toEqual({ prompt: mockPrompt });
    });

    it('silently skips coaching errors', async () => {
      const triggeredRule = createMockRule({ ruleId: 'triggered' });

      const mockPlayback: MockPlaybackService = {
        loadFixture: jest.fn(),
        start: jest.fn((onLine, onComplete) => {
          mockPlayback._onLine = onLine;
          mockPlayback._onComplete = onComplete;
        }),
        stop: jest.fn(),
      };

      const deps = createMockDeps({
        rulesEngine: {
          evaluate: jest.fn().mockReturnValue([triggeredRule]),
          resetCooldowns: jest.fn(),
        },
        coachingService: {
          processTriggeredRules: jest
            .fn()
            .mockRejectedValue(new Error('Claude API error')),
        },
        createPlaybackService: jest.fn(() => mockPlayback),
      });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      // Should not throw
      mockPlayback._onLine!({
        speaker: 'rep',
        text: 'Hello',
        timestamp: 1000,
      });

      await new Promise((r) => setTimeout(r, 10));

      // Session still active — no crash
      expect(manager.getSession(id)!.status).toBe('active');
    });
  });

  describe('session completion', () => {
    it('generates scorecard, stores it, emits session_complete, and sets status to completed', async () => {
      const mockScorecard = createMockScorecard();
      const emittedEvents: SSEEvent[] = [];
      const mockEventBus = {
        emit: jest.fn((_sid: string, event: SSEEvent) => {
          emittedEvents.push(event);
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockPlayback: MockPlaybackService = {
        loadFixture: jest.fn(),
        start: jest.fn((onLine, onComplete) => {
          mockPlayback._onLine = onLine;
          mockPlayback._onComplete = onComplete;
        }),
        stop: jest.fn(),
      };

      const deps = createMockDeps({
        eventBus: mockEventBus as unknown as SessionManagerDeps['eventBus'],
        scorecardService: {
          generate: jest.fn().mockResolvedValue(mockScorecard),
        },
        createPlaybackService: jest.fn(() => mockPlayback),
      });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);

      // Feed some lines
      mockPlayback._onLine!({
        speaker: 'rep',
        text: 'Hi',
        timestamp: 1000,
      });

      // Trigger completion
      mockPlayback._onComplete!();

      // Wait for async scorecard generation
      await new Promise((r) => setTimeout(r, 10));

      expect(deps.scorecardService.generate).toHaveBeenCalledWith(
        expect.any(Array),
        deps.rules,
      );

      const session = manager.getSession(id);
      expect(session!.status).toBe('completed');
      expect(session!.scorecard).toEqual(mockScorecard);

      const completeEvents = emittedEvents.filter(
        (e) => e.type === 'session_complete',
      );
      expect(completeEvents).toHaveLength(1);
      expect(completeEvents[0].data).toEqual({ scorecard: mockScorecard });
    });

    it('still completes session if scorecard generation fails', async () => {
      const emittedEvents: SSEEvent[] = [];
      const mockEventBus = {
        emit: jest.fn((_sid: string, event: SSEEvent) => {
          emittedEvents.push(event);
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockPlayback: MockPlaybackService = {
        loadFixture: jest.fn(),
        start: jest.fn((onLine, onComplete) => {
          mockPlayback._onLine = onLine;
          mockPlayback._onComplete = onComplete;
        }),
        stop: jest.fn(),
      };

      const deps = createMockDeps({
        eventBus: mockEventBus as unknown as SessionManagerDeps['eventBus'],
        scorecardService: {
          generate: jest
            .fn()
            .mockRejectedValue(new Error('Claude API error')),
        },
        createPlaybackService: jest.fn(() => mockPlayback),
      });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      manager.startSession(id);
      mockPlayback._onComplete!();

      await new Promise((r) => setTimeout(r, 10));

      const session = manager.getSession(id);
      expect(session!.status).toBe('completed');

      const completeEvents = emittedEvents.filter(
        (e) => e.type === 'session_complete',
      );
      expect(completeEvents).toHaveLength(1);
    });
  });

  describe('full lifecycle', () => {
    it('create → start → lines flow → completion', async () => {
      const mockScorecard = createMockScorecard();
      const mockPrompt = createMockPrompt();
      const triggeredRule = createMockRule({
        ruleId: 'talk-ratio',
        detect: () => true,
      });

      const emittedEvents: SSEEvent[] = [];
      const mockEventBus = {
        emit: jest.fn((_sid: string, event: SSEEvent) => {
          emittedEvents.push(event);
        }),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const mockPlayback: MockPlaybackService = {
        loadFixture: jest.fn(),
        start: jest.fn((onLine, onComplete) => {
          mockPlayback._onLine = onLine;
          mockPlayback._onComplete = onComplete;
        }),
        stop: jest.fn(),
      };

      let evaluateCallCount = 0;
      const deps = createMockDeps({
        eventBus: mockEventBus as unknown as SessionManagerDeps['eventBus'],
        rulesEngine: {
          evaluate: jest.fn(() => {
            evaluateCallCount++;
            // Trigger rule on second line
            return evaluateCallCount === 2 ? [triggeredRule] : [];
          }),
          resetCooldowns: jest.fn(),
        },
        coachingService: {
          processTriggeredRules: jest.fn().mockResolvedValue([mockPrompt]),
        },
        scorecardService: {
          generate: jest.fn().mockResolvedValue(mockScorecard),
        },
        createPlaybackService: jest.fn(() => mockPlayback),
      });
      const manager = new SessionManager(deps);

      // Step 1: Create session
      const id = manager.createSession('discovery-call-001');
      expect(manager.getSession(id)!.status).toBe('idle');

      // Step 2: Start session
      manager.startSession(id);
      expect(manager.getSession(id)!.status).toBe('active');

      // Step 3: Lines flow
      const line1: TranscriptLine = {
        speaker: 'rep',
        text: 'Hi Sarah',
        timestamp: 1000,
      };
      const line2: TranscriptLine = {
        speaker: 'rep',
        text: 'Let me tell you about our product',
        timestamp: 2000,
      };

      mockPlayback._onLine!(line1);
      mockPlayback._onLine!(line2);

      // Wait for async coaching
      await new Promise((r) => setTimeout(r, 10));

      // Verify transcript events emitted
      const transcriptEvents = emittedEvents.filter(
        (e) => e.type === 'transcript',
      );
      expect(transcriptEvents).toHaveLength(2);

      // Verify coaching prompt emitted for second line
      const coachingEvents = emittedEvents.filter(
        (e) => e.type === 'coaching_prompt',
      );
      expect(coachingEvents).toHaveLength(1);

      // Step 4: Completion
      mockPlayback._onComplete!();

      await new Promise((r) => setTimeout(r, 10));

      expect(manager.getSession(id)!.status).toBe('completed');
      expect(manager.getSession(id)!.scorecard).toEqual(mockScorecard);

      const completeEvents = emittedEvents.filter(
        (e) => e.type === 'session_complete',
      );
      expect(completeEvents).toHaveLength(1);

      // Verify getScorecard works
      expect(manager.getScorecard(id)).toEqual(mockScorecard);
    });
  });

  describe('getSession', () => {
    it('returns undefined for unknown session', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      expect(manager.getSession('nonexistent')).toBeUndefined();
    });
  });

  describe('getScorecard', () => {
    it('returns undefined for unknown session', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      expect(manager.getScorecard('nonexistent')).toBeUndefined();
    });

    it('returns undefined for non-completed session', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001');
      expect(manager.getScorecard(id)).toBeUndefined();
    });
  });

  describe('singleton instance', () => {
    it('exports a SessionManager singleton from session-manager-instance', () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { sessionManager } = require('@/lib/session-manager-instance');
      expect(sessionManager).toBeInstanceOf(SessionManager);
    });
  });
});
