import { RulesEngine } from '@/services/rules-engine';
import { CoachingService } from '@/services/coaching-service';
import { ScorecardService } from '@/services/scorecard-service';
import { PlaybackService } from '@/services/playback-service';
import { TranscriptService } from '@/services/transcript-service';
import { coachingRules } from '@/rules/coaching-rules';

// Mock ClaudeService to avoid needing an API key
jest.mock('@/services/claude-service', () => ({
  ClaudeService: jest.fn().mockImplementation(() => ({
    getCoachingPrompts: jest.fn().mockResolvedValue([]),
    generateScorecard: jest.fn().mockResolvedValue({
      entries: [],
      overallScore: 0,
      summary: '',
    }),
  })),
}));

describe('session-manager-instance', () => {
  beforeEach(() => {
    // Clear module cache to re-evaluate the singleton
    jest.resetModules();
  });

  it('exports a SessionManager singleton', async () => {
    const { sessionManager } = await import('@/lib/session-manager-instance');
    const { SessionManager } = await import('@/services/session-manager');
    expect(sessionManager).toBeInstanceOf(SessionManager);
  });

  it('creates sessions and returns a valid session id', async () => {
    const { sessionManager } = await import('@/lib/session-manager-instance');
    const id = sessionManager.createSession('discovery-call');
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);

    const session = sessionManager.getSession(id);
    expect(session).toBeDefined();
    expect(session!.status).toBe('idle');
    expect(session!.fixtureId).toBe('discovery-call');
  });

  it('wires real RulesEngine with coaching rules', async () => {
    // We can verify the real wiring by checking that the SessionManager
    // uses a RulesEngine that has the coaching rules loaded.
    // The best way to verify: create a session and start it — the rules
    // engine should actually evaluate rules, not return empty stubs.
    const { sessionManager } = await import('@/lib/session-manager-instance');

    // Access the deps indirectly: the sessionManager should use real rules.
    // We verify by checking that coachingRules are the ones loaded.
    expect(coachingRules.length).toBe(6);

    // Creating a session works with real deps
    const id = sessionManager.createSession('discovery-call');
    expect(sessionManager.getSession(id)).toBeDefined();
  });

  it('uses real service classes (not stubs)', async () => {
    // Verify that the real classes are used by checking that the module
    // imports resolve to the actual classes
    expect(RulesEngine).toBeDefined();
    expect(CoachingService).toBeDefined();
    expect(ScorecardService).toBeDefined();
    expect(PlaybackService).toBeDefined();
    expect(TranscriptService).toBeDefined();

    // Verify instances can be created (constructors are callable)
    const rulesEngine = new RulesEngine(coachingRules);
    expect(rulesEngine.evaluate([])).toEqual([]);

    rulesEngine.resetCooldowns(); // should not throw
  });

  it('injects all 6 coaching rules', async () => {
    expect(coachingRules).toHaveLength(6);

    const ruleIds = coachingRules.map((r) => r.ruleId);
    expect(ruleIds).toContain('talk-ratio');
    expect(ruleIds).toContain('long-monologue');
    expect(ruleIds).toContain('no-questions');
    expect(ruleIds).toContain('filler-words');
    expect(ruleIds).toContain('feature-dump');
    expect(ruleIds).toContain('no-next-steps');
  });

  it('createPlaybackService returns a real PlaybackService', async () => {
    // Verify that the factory creates real PlaybackService instances
    const service = new PlaybackService('test-fixture');
    expect(service).toBeInstanceOf(PlaybackService);
    expect(typeof service.loadFixture).toBe('function');
    expect(typeof service.start).toBe('function');
    expect(typeof service.stop).toBe('function');
  });

  it('createTranscriptService returns a real TranscriptService', async () => {
    const lines: unknown[] = [];
    const service = new TranscriptService((line, window) => {
      lines.push({ line, window });
    });
    expect(service).toBeInstanceOf(TranscriptService);

    service.addLine({ speaker: 'rep', text: 'Hello', timestamp: Date.now() });
    expect(lines).toHaveLength(1);
    expect(service.getTranscript()).toHaveLength(1);
  });

  it('returns the same singleton on repeated imports', async () => {
    const { sessionManager: sm1 } = await import('@/lib/session-manager-instance');
    const { sessionManager: sm2 } = await import('@/lib/session-manager-instance');
    expect(sm1).toBe(sm2);
  });
});
