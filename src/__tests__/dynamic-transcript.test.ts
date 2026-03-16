import {
  TranscriptLine,
  CoachingRule,
  Scorecard,
} from '@/types';
import type { FixtureLine } from '@/types/transcript';
import {
  SessionManager,
  SessionManagerDeps,
  IRulesEngine,
  ICoachingService,
  IScorecardService,
  IPlaybackService,
  ITranscriptGeneratorService,
} from '@/services/session-manager';

function createMockRule(): CoachingRule {
  return {
    ruleId: 'test-rule',
    name: 'Test Rule',
    description: 'A test rule',
    cooldownMs: 30000,
    callTypes: ['discovery', 'demo', 'objection-handling', 'follow-up'],
    severity: 'medium',
    detect: () => false,
  };
}

function createMockScorecard(): Scorecard {
  return {
    entries: [
      { ruleId: 'test-rule', ruleName: 'Test Rule', assessment: 'good', comment: 'Well done' },
    ],
    overallScore: 85,
    summary: 'Good performance',
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
    loadLines: jest.fn(),
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

describe('SessionManager — dynamic transcript generation', () => {
  describe('createSession with dynamic flag', () => {
    it('stores dynamic flag on session when true', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001', 'discovery', true);
      const session = manager.getSession(id);

      expect(session).toBeDefined();
      expect(session!.dynamic).toBe(true);
    });

    it('stores dynamic as false by default', () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001', 'discovery');
      const session = manager.getSession(id);

      expect(session!.dynamic).toBe(false);
    });
  });

  describe('startSession with dynamic transcript', () => {
    it('uses generated lines when dynamic is true and generation succeeds', async () => {
      const generatedLines: FixtureLine[] = [
        { speaker: 'rep', text: 'Generated line 1' },
        { speaker: 'prospect', text: 'Generated line 2' },
      ];

      const mockGenerator: ITranscriptGeneratorService = {
        generateTranscript: jest.fn().mockResolvedValue(generatedLines),
      };

      const deps = createMockDeps({ transcriptGeneratorService: mockGenerator });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001', 'discovery', true);
      await manager.startSession(id);

      const playbackService = (deps.createPlaybackService as jest.Mock).mock.results[0].value;
      expect(mockGenerator.generateTranscript).toHaveBeenCalledWith('discovery');
      expect(playbackService.loadLines).toHaveBeenCalledWith(generatedLines);
      expect(playbackService.loadFixture).not.toHaveBeenCalled();
    });

    it('falls back to static fixture when dynamic generation fails', async () => {
      const mockGenerator: ITranscriptGeneratorService = {
        generateTranscript: jest.fn().mockRejectedValue(new Error('API error')),
      };

      const deps = createMockDeps({ transcriptGeneratorService: mockGenerator });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001', 'discovery', true);
      await manager.startSession(id);

      const playbackService = (deps.createPlaybackService as jest.Mock).mock.results[0].value;
      expect(mockGenerator.generateTranscript).toHaveBeenCalledWith('discovery');
      expect(playbackService.loadFixture).toHaveBeenCalled();
      expect(playbackService.loadLines).not.toHaveBeenCalled();
    });

    it('uses static fixture when dynamic is false', async () => {
      const mockGenerator: ITranscriptGeneratorService = {
        generateTranscript: jest.fn(),
      };

      const deps = createMockDeps({ transcriptGeneratorService: mockGenerator });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001', 'discovery', false);
      await manager.startSession(id);

      const playbackService = (deps.createPlaybackService as jest.Mock).mock.results[0].value;
      expect(mockGenerator.generateTranscript).not.toHaveBeenCalled();
      expect(playbackService.loadFixture).toHaveBeenCalled();
    });

    it('uses static fixture when no generator service is provided', async () => {
      const deps = createMockDeps();
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001', 'discovery', true);
      await manager.startSession(id);

      const playbackService = (deps.createPlaybackService as jest.Mock).mock.results[0].value;
      expect(playbackService.loadFixture).toHaveBeenCalled();
    });

    it('dynamic session produces unique transcript events', async () => {
      const generatedLines: FixtureLine[] = [
        { speaker: 'rep', text: 'Dynamically generated hello' },
        { speaker: 'prospect', text: 'Dynamically generated response' },
      ];

      const mockGenerator: ITranscriptGeneratorService = {
        generateTranscript: jest.fn().mockResolvedValue(generatedLines),
      };

      const mockEventBus = {
        emit: jest.fn(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn(),
        removeAllListeners: jest.fn(),
      };

      const deps = createMockDeps({
        transcriptGeneratorService: mockGenerator,
        eventBus: mockEventBus as unknown as SessionManagerDeps['eventBus'],
      });
      const manager = new SessionManager(deps);

      const id = manager.createSession('discovery-call-001', 'discovery', true);
      await manager.startSession(id);

      // Simulate playback emitting lines
      const playbackService = (deps.createPlaybackService as jest.Mock).mock.results[0].value;
      const onLine = playbackService._onLine!;

      const line: TranscriptLine = { speaker: 'rep', text: 'Dynamically generated hello', timestamp: Date.now() };
      onLine(line);

      // Verify the transcript event was emitted
      expect(mockEventBus.emit).toHaveBeenCalledWith(
        id,
        expect.objectContaining({
          type: 'transcript',
          data: { line },
        }),
      );
    });

    it('generates different transcripts for different call types', async () => {
      const mockGenerator: ITranscriptGeneratorService = {
        generateTranscript: jest.fn()
          .mockResolvedValueOnce([{ speaker: 'rep', text: 'Discovery talk' }])
          .mockResolvedValueOnce([{ speaker: 'rep', text: 'Objection talk' }]),
      };

      const deps = createMockDeps({ transcriptGeneratorService: mockGenerator });
      const manager = new SessionManager(deps);

      const id1 = manager.createSession('discovery-call-001', 'discovery', true);
      await manager.startSession(id1);

      const id2 = manager.createSession('objection-handling-001', 'objection-handling', true);
      await manager.startSession(id2);

      expect(mockGenerator.generateTranscript).toHaveBeenCalledWith('discovery');
      expect(mockGenerator.generateTranscript).toHaveBeenCalledWith('objection-handling');
    });
  });
});
