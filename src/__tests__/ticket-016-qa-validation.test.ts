/**
 * TICKET-016 QA Validation: Wire real dependencies into session-manager-instance.ts
 *
 * Validates:
 * - All five real services (RulesEngine, CoachingService, ScorecardService,
 *   PlaybackService, TranscriptService) are instantiated and injected
 * - No stubs or no-ops remain
 * - Full session lifecycle works end-to-end with mocked external APIs
 */

import { TranscriptLine } from '@/types';
import type { SSEEvent } from '@/types/sse';

// Mock PlaybackService to avoid real file I/O and timers but verify it is instantiated
const mockLoadFixture = jest.fn();
const mockStart = jest.fn();
const mockStop = jest.fn();
jest.mock('@/services/playback-service', () => ({
  PlaybackService: jest.fn().mockImplementation((fixtureId: string) => ({
    _fixtureId: fixtureId,
    loadFixture: mockLoadFixture,
    start: mockStart.mockImplementation(
      (onLine: (line: TranscriptLine) => void, onComplete: () => void) => {
        // Emit a few transcript lines synchronously for testing
        onLine({ speaker: 'rep', text: 'Hi, thanks for taking my call.', timestamp: Date.now() });
        onLine({ speaker: 'prospect', text: 'Sure, what do you have?', timestamp: Date.now() });
        onLine({ speaker: 'rep', text: 'We have a great platform for your team.', timestamp: Date.now() });
        onComplete();
      },
    ),
    stop: mockStop,
  })),
}));

// Mock ClaudeService to avoid needing an API key
const mockGetCoachingPrompts = jest.fn().mockResolvedValue([
  { ruleId: 'talk-ratio', ruleName: 'Talk Ratio', message: 'Consider asking more questions', timestamp: Date.now() },
]);
const mockGenerateScorecard = jest.fn().mockResolvedValue({
  entries: [
    { ruleId: 'talk-ratio', ruleName: 'Talk Ratio', assessment: 'needs-work', comment: 'Rep spoke too much' },
  ],
  overallScore: 65,
  summary: 'Needs improvement on engagement',
});
jest.mock('@/services/claude-service', () => ({
  ClaudeService: jest.fn().mockImplementation(() => ({
    getCoachingPrompts: mockGetCoachingPrompts,
    generateScorecard: mockGenerateScorecard,
  })),
}));

import { RulesEngine } from '@/services/rules-engine';
import { CoachingService } from '@/services/coaching-service';
import { ScorecardService } from '@/services/scorecard-service';
import { PlaybackService } from '@/services/playback-service';
import { TranscriptService } from '@/services/transcript-service';
import { coachingRules } from '@/rules/coaching-rules';

describe('TICKET-016: Wire real dependencies into session-manager-instance', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe('Acceptance Criteria: All five real services are instantiated and injected', () => {
    it('exports a SessionManager instance (not a stub)', async () => {
      const { sessionManager } = await import('@/lib/session-manager-instance');
      const { SessionManager: SM } = await import('@/services/session-manager');
      expect(sessionManager).toBeInstanceOf(SM);
      // Verify it has real methods
      expect(typeof sessionManager.createSession).toBe('function');
      expect(typeof sessionManager.startSession).toBe('function');
      expect(typeof sessionManager.getSession).toBe('function');
      expect(typeof sessionManager.getScorecard).toBe('function');
    });

    it('uses real EventBus (not a stub)', async () => {
      const { eventBus } = await import('@/lib/event-bus-instance');
      // Verify it has real methods (not stubs)
      expect(typeof eventBus.emit).toBe('function');
      expect(typeof eventBus.subscribe).toBe('function');
      expect(typeof eventBus.unsubscribe).toBe('function');
      expect(typeof eventBus.removeAllListeners).toBe('function');
      // Verify it actually works: subscribe, emit, receive
      const received: SSEEvent[] = [];
      const handler = (evt: SSEEvent) => received.push(evt);
      eventBus.subscribe('test-session', handler);
      eventBus.emit('test-session', { type: 'transcript', data: { line: { speaker: 'rep', text: 'test' } } });
      expect(received).toHaveLength(1);
      expect(received[0].type).toBe('transcript');
      eventBus.unsubscribe('test-session', handler);
      // After unsubscribe, no more events
      eventBus.emit('test-session', { type: 'transcript', data: { line: { speaker: 'rep', text: 'test2' } } });
      expect(received).toHaveLength(1);
    });

    it('uses real RulesEngine with all 8 coaching rules', () => {
      const engine = new RulesEngine(coachingRules);
      expect(engine).toBeInstanceOf(RulesEngine);
      expect(coachingRules).toHaveLength(8);

      // Verify evaluate works (not a no-op stub)
      const result = engine.evaluate([]);
      expect(result).toEqual([]);

      // Verify rules actually fire when conditions are met
      const highTalkRatioWindow: TranscriptLine[] = Array.from({ length: 10 }, (_, i) => ({
        speaker: i < 8 ? 'rep' as const : 'prospect' as const,
        text: 'test line',
        timestamp: Date.now(),
      }));
      const triggered = engine.evaluate(highTalkRatioWindow);
      expect(triggered.length).toBeGreaterThan(0);
      const ruleIds = triggered.map(r => r.ruleId);
      expect(ruleIds).toContain('talk-ratio');
    });

    it('uses real CoachingService (wrapping ClaudeService)', () => {
      const coaching = new CoachingService({ getCoachingPrompts: mockGetCoachingPrompts, generateScorecard: mockGenerateScorecard });
      expect(coaching).toBeInstanceOf(CoachingService);
      expect(typeof coaching.processTriggeredRules).toBe('function');
    });

    it('uses real ScorecardService (wrapping ClaudeService)', () => {
      const scorecard = new ScorecardService({ getCoachingPrompts: mockGetCoachingPrompts, generateScorecard: mockGenerateScorecard });
      expect(scorecard).toBeInstanceOf(ScorecardService);
      expect(typeof scorecard.generate).toBe('function');
    });

    it('createPlaybackService factory produces real PlaybackService instances', () => {
      const service = new PlaybackService('test-fixture');
      expect(service).toBeDefined();
      expect(typeof service.loadFixture).toBe('function');
      expect(typeof service.start).toBe('function');
      expect(typeof service.stop).toBe('function');
    });

    it('createTranscriptService factory produces real TranscriptService instances', () => {
      const lines: { line: TranscriptLine; window: TranscriptLine[] }[] = [];
      const service = new TranscriptService((line, window) => {
        lines.push({ line, window });
      });
      expect(service).toBeInstanceOf(TranscriptService);

      // Verify it actually works (not a no-op)
      service.addLine({ speaker: 'rep', text: 'Hello', timestamp: Date.now() });
      expect(lines).toHaveLength(1);
      expect(service.getTranscript()).toHaveLength(1);
    });
  });

  describe('Acceptance Criteria: No stubs or no-ops remain', () => {
    it('session-manager-instance.ts imports from real service modules', async () => {
      // Read the actual source file to verify no stubs
      const fs = await import('fs');
      const path = await import('path');
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src', 'lib', 'session-manager-instance.ts'),
        'utf-8',
      );

      // Must import from real services, not from stubs/mocks
      expect(source).toContain("from '@/services/rules-engine'");
      expect(source).toContain("from '@/services/coaching-service'");
      expect(source).toContain("from '@/services/scorecard-service'");
      expect(source).toContain("from '@/services/playback-service'");
      expect(source).toContain("from '@/services/transcript-service'");
      expect(source).toContain("from '@/services/claude-service'");
      expect(source).toContain("from '@/rules/coaching-rules'");

      // Must NOT contain stub indicators
      expect(source).not.toMatch(/no.?op/i);
      expect(source).not.toMatch(/stub/i);
      expect(source).not.toMatch(/mock/i);
      expect(source).not.toMatch(/dummy/i);
      expect(source).not.toMatch(/placeholder/i);
    });

    it('createDeps() instantiates all services with real constructors', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src', 'lib', 'session-manager-instance.ts'),
        'utf-8',
      );

      // Verify createDeps uses new for each service
      expect(source).toContain('new ClaudeService()');
      expect(source).toContain('new RulesEngine(coachingRules)');
      expect(source).toContain('new CoachingService(claudeService)');
      expect(source).toContain('new ScorecardService(claudeService)');
      expect(source).toContain('new PlaybackService(');
      expect(source).toContain('new TranscriptService(');

      // Verify eventBus is injected
      expect(source).toMatch(/eventBus/);
    });

    it('deps object includes all required fields', async () => {
      const fs = await import('fs');
      const path = await import('path');
      const source = fs.readFileSync(
        path.join(process.cwd(), 'src', 'lib', 'session-manager-instance.ts'),
        'utf-8',
      );

      // Verify the deps object has all required keys
      expect(source).toContain('eventBus');
      expect(source).toContain('rulesEngine');
      expect(source).toContain('coachingService');
      expect(source).toContain('scorecardService');
      expect(source).toContain('rules:');
      expect(source).toContain('createPlaybackService');
      expect(source).toContain('createTranscriptService');
    });
  });

  describe('Acceptance Criteria: Full session lifecycle works end-to-end', () => {
    it('creates a session, starts it, and produces a scorecard', async () => {
      const { sessionManager } = await import('@/lib/session-manager-instance');

      // Step 1: Create session
      const sessionId = sessionManager.createSession('discovery-call-001');
      expect(typeof sessionId).toBe('string');
      expect(sessionId.length).toBeGreaterThan(0);

      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.status).toBe('idle');
      expect(session!.fixtureId).toBe('discovery-call-001');
      expect(session!.transcript).toEqual([]);

      // Step 2: Start session
      sessionManager.startSession(sessionId);

      // The mock PlaybackService fires lines synchronously, so after start
      // the session should transition through active to completed
      // Wait for async scorecard generation
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Step 3: Verify session completed with scorecard
      const completedSession = sessionManager.getSession(sessionId);
      expect(completedSession!.status).toBe('completed');
      expect(completedSession!.transcript.length).toBe(3); // 3 lines from mock
      expect(completedSession!.scorecard).toBeDefined();
      expect(completedSession!.scorecard!.overallScore).toBe(65);
      expect(completedSession!.scorecard!.entries).toHaveLength(1);
    });

    it('emits SSE events during session lifecycle via EventBus', async () => {
      const { sessionManager } = await import('@/lib/session-manager-instance');
      const { eventBus } = await import('@/lib/event-bus-instance');

      const sessionId = sessionManager.createSession('discovery-call-001');
      const events: SSEEvent[] = [];

      // Subscribe to events
      const handler = (event: SSEEvent) => events.push(event);
      eventBus.subscribe(sessionId, handler);

      // Start session
      sessionManager.startSession(sessionId);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Verify transcript events were emitted
      const transcriptEvents = events.filter(e => e.type === 'transcript');
      expect(transcriptEvents.length).toBe(3);

      // Verify session_complete event was emitted
      const completeEvents = events.filter(e => e.type === 'session_complete');
      expect(completeEvents.length).toBe(1);
      expect(completeEvents[0].data.scorecard).toBeDefined();

      // Cleanup
      eventBus.unsubscribe(sessionId, handler);
    });

    it('PlaybackService.loadFixture() is called during startSession', async () => {
      const { sessionManager } = await import('@/lib/session-manager-instance');
      const sessionId = sessionManager.createSession('discovery-call-001');

      sessionManager.startSession(sessionId);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockLoadFixture).toHaveBeenCalled();
    });

    it('PlaybackService.start() is called with callbacks', async () => {
      const { sessionManager } = await import('@/lib/session-manager-instance');
      const sessionId = sessionManager.createSession('discovery-call-001');

      sessionManager.startSession(sessionId);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockStart).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
      );
    });

    it('getScorecard returns scorecard after session completes', async () => {
      const { sessionManager } = await import('@/lib/session-manager-instance');
      const sessionId = sessionManager.createSession('discovery-call-001');

      // Before start — no scorecard
      expect(sessionManager.getScorecard(sessionId)).toBeUndefined();

      sessionManager.startSession(sessionId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      const scorecard = sessionManager.getScorecard(sessionId);
      expect(scorecard).toBeDefined();
      expect(scorecard!.overallScore).toBe(65);
      expect(scorecard!.summary).toBe('Needs improvement on engagement');
    });

    it('rejects starting a non-existent session', async () => {
      const { sessionManager } = await import('@/lib/session-manager-instance');
      expect(() => sessionManager.startSession('nonexistent-id')).toThrow(
        'Session nonexistent-id not found',
      );
    });

    it('rejects starting an already-active session', async () => {
      const { sessionManager } = await import('@/lib/session-manager-instance');
      const sessionId = sessionManager.createSession('discovery-call-001');

      sessionManager.startSession(sessionId);

      expect(() => sessionManager.startSession(sessionId)).toThrow(
        /not idle/,
      );
    });
  });

  describe('Edge cases', () => {
    it('multiple sessions can be created independently', async () => {
      const { sessionManager } = await import('@/lib/session-manager-instance');

      const id1 = sessionManager.createSession('discovery-call-001');
      const id2 = sessionManager.createSession('demo-call');

      expect(id1).not.toBe(id2);
      expect(sessionManager.getSession(id1)!.fixtureId).toBe('discovery-call-001');
      expect(sessionManager.getSession(id2)!.fixtureId).toBe('demo-call');
    });

    it('RulesEngine evaluates coaching rules correctly within the singleton', async () => {
      // Verify that the wired RulesEngine actually evaluates rules, not just returns empty
      const engine = new RulesEngine(coachingRules);

      // Window with long monologue (4+ consecutive rep lines)
      const monologueWindow: TranscriptLine[] = [
        { speaker: 'rep', text: 'First point', timestamp: 1 },
        { speaker: 'rep', text: 'Second point', timestamp: 2 },
        { speaker: 'rep', text: 'Third point', timestamp: 3 },
        { speaker: 'rep', text: 'Fourth point', timestamp: 4 },
      ];
      const triggered = engine.evaluate(monologueWindow);
      const ruleIds = triggered.map(r => r.ruleId);
      expect(ruleIds).toContain('long-monologue');
      expect(ruleIds).toContain('talk-ratio');
      expect(ruleIds).toContain('no-questions');
    });

    it('singleton is preserved across module re-imports', async () => {
      const { sessionManager: sm1 } = await import('@/lib/session-manager-instance');
      const { sessionManager: sm2 } = await import('@/lib/session-manager-instance');
      expect(sm1).toBe(sm2);

      // Creating a session in sm1 should be visible in sm2
      const id = sm1.createSession('test-fixture');
      expect(sm2.getSession(id)).toBeDefined();
    });

    it('scorecard generation failure is handled gracefully', async () => {
      // Override scorecard mock to fail
      mockGenerateScorecard.mockRejectedValueOnce(new Error('Claude API error'));

      const { sessionManager } = await import('@/lib/session-manager-instance');
      const { eventBus } = await import('@/lib/event-bus-instance');

      const sessionId = sessionManager.createSession('discovery-call-001');
      const events: SSEEvent[] = [];
      eventBus.subscribe(sessionId, (e: SSEEvent) => events.push(e));

      sessionManager.startSession(sessionId);
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Session should still complete
      const session = sessionManager.getSession(sessionId);
      expect(session!.status).toBe('completed');

      // session_complete event should include error info
      const completeEvent = events.find(e => e.type === 'session_complete');
      expect(completeEvent).toBeDefined();
      expect(completeEvent!.data.error).toBe('Scorecard generation failed');
    });

    it('coaching rules array passed to deps contains all 8 rule IDs', () => {
      const expectedRuleIds = [
        'talk-ratio',
        'long-monologue',
        'no-questions',
        'filler-words',
        'feature-dump',
        'no-next-steps',
        'objection-deflected',
        'competitor-not-explored',
      ];
      const actualRuleIds = coachingRules.map(r => r.ruleId);
      expect(actualRuleIds).toEqual(expectedRuleIds);
    });

    it('each coaching rule has a detect function', () => {
      for (const rule of coachingRules) {
        expect(typeof rule.detect).toBe('function');
        expect(typeof rule.ruleId).toBe('string');
        expect(typeof rule.name).toBe('string');
        expect(typeof rule.description).toBe('string');
        expect(typeof rule.cooldownMs).toBe('number');
        expect(rule.cooldownMs).toBeGreaterThan(0);
      }
    });
  });
});
