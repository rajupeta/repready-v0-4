import fs from 'fs';
import path from 'path';
import type {
  TranscriptLine,
  CoachingRule,
  CoachingPrompt,
  Session,
  ScorecardEntry,
  Scorecard,
  SSEEvent,
} from '@/types';

describe('TICKET-002: Domain types, fixture data, and fixtures API', () => {
  describe('TypeScript interfaces', () => {
    it('TranscriptLine accepts valid speaker values', () => {
      const repLine: TranscriptLine = { speaker: 'rep', text: 'Hello' };
      const prospectLine: TranscriptLine = { speaker: 'prospect', text: 'Hi', timestamp: 1000 };
      expect(repLine.speaker).toBe('rep');
      expect(prospectLine.speaker).toBe('prospect');
      expect(prospectLine.timestamp).toBe(1000);
    });

    it('CoachingRule has correct shape', () => {
      const rule: CoachingRule = {
        ruleId: 'rule-1',
        name: 'Test Rule',
        description: 'A test rule',
        cooldownMs: 5000,
        callTypes: ['discovery'],
        severity: 'medium',
        detect: (window: TranscriptLine[]) => window.length > 0,
      };
      expect(rule.ruleId).toBe('rule-1');
      expect(rule.detect([{ speaker: 'rep', text: 'test' }])).toBe(true);
      expect(rule.detect([])).toBe(false);
    });

    it('CoachingPrompt has correct shape', () => {
      const prompt: CoachingPrompt = {
        ruleId: 'rule-1',
        ruleName: 'Test Rule',
        message: 'Consider asking more questions',
        timestamp: Date.now(),
      };
      expect(prompt.ruleId).toBe('rule-1');
      expect(typeof prompt.timestamp).toBe('number');
    });

    it('Session has correct shape with optional scorecard', () => {
      const session: Session = {
        id: 'session-1',
        status: 'active',
        fixtureId: 'discovery-call-001',
        callType: 'discovery',
        transcript: [{ speaker: 'rep', text: 'Hello' }],
        events: [],
      };
      expect(session.status).toBe('active');
      expect(session.scorecard).toBeUndefined();

      const completedSession: Session = {
        id: 'session-2',
        status: 'completed',
        fixtureId: 'objection-handling-001',
        callType: 'objection-handling',
        transcript: [],
        events: [],
        scorecard: {
          entries: [],
          overallScore: 85,
          summary: 'Good performance',
        },
      };
      expect(completedSession.scorecard?.overallScore).toBe(85);
    });

    it('ScorecardEntry accepts valid assessment values', () => {
      const entries: ScorecardEntry[] = [
        { ruleId: 'r1', ruleName: 'Rule 1', assessment: 'good', comment: 'Well done' },
        { ruleId: 'r2', ruleName: 'Rule 2', assessment: 'needs-work', comment: 'Improve here' },
        { ruleId: 'r3', ruleName: 'Rule 3', assessment: 'missed', comment: 'Not observed' },
      ];
      expect(entries.map((e) => e.assessment)).toEqual(['good', 'needs-work', 'missed']);
    });

    it('Scorecard has entries, overallScore, and summary', () => {
      const scorecard: Scorecard = {
        entries: [
          { ruleId: 'r1', ruleName: 'Rule 1', assessment: 'good', comment: 'Nice' },
        ],
        overallScore: 75,
        summary: 'Overall decent call',
      };
      expect(scorecard.entries).toHaveLength(1);
      expect(scorecard.overallScore).toBe(75);
    });

    it('SSEEvent accepts valid event types', () => {
      const events: SSEEvent[] = [
        { type: 'transcript', data: { speaker: 'rep', text: 'hi' } },
        { type: 'coaching_prompt', data: { ruleId: 'r1', message: 'ask more' } },
        { type: 'session_complete', data: { sessionId: 's1' } },
        { type: 'heartbeat', data: {} },
      ];
      expect(events.map((e) => e.type)).toEqual([
        'transcript',
        'coaching_prompt',
        'session_complete',
        'heartbeat',
      ]);
    });
  });

  describe('Fixture files', () => {
    const fixturesDir = path.join(process.cwd(), 'src', 'fixtures');

    it('discovery-call-001.json exists and has ~25 lines', () => {
      const data = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'discovery-call-001.json'), 'utf-8'));
      expect(data.length).toBeGreaterThanOrEqual(20);
      expect(data.length).toBeLessThanOrEqual(30);
    });

    it('objection-handling-001.json exists and has ~25 lines', () => {
      const data = JSON.parse(fs.readFileSync(path.join(fixturesDir, 'objection-handling-001.json'), 'utf-8'));
      expect(data.length).toBeGreaterThanOrEqual(20);
      expect(data.length).toBeLessThanOrEqual(30);
    });

    it('all fixture lines have valid speaker and text fields', () => {
      const files = ['discovery-call-001.json', 'objection-handling-001.json'];
      for (const file of files) {
        const data: TranscriptLine[] = JSON.parse(
          fs.readFileSync(path.join(fixturesDir, file), 'utf-8')
        );
        for (const line of data) {
          expect(['rep', 'prospect']).toContain(line.speaker);
          expect(typeof line.text).toBe('string');
          expect(line.text.length).toBeGreaterThan(0);
        }
      }
    });

    it('fixtures include coachable moments (long monologues)', () => {
      const files = ['discovery-call-001.json', 'objection-handling-001.json'];
      for (const file of files) {
        const data: TranscriptLine[] = JSON.parse(
          fs.readFileSync(path.join(fixturesDir, file), 'utf-8')
        );
        const hasLongLine = data.some((line) => line.text.length > 200);
        expect(hasLongLine).toBe(true);
      }
    });

    it('fixtures include filler words', () => {
      const files = ['discovery-call-001.json', 'objection-handling-001.json'];
      const fillerPattern = /\b(um|uh|like|you know|basically|so)\b/i;
      for (const file of files) {
        const data: TranscriptLine[] = JSON.parse(
          fs.readFileSync(path.join(fixturesDir, file), 'utf-8')
        );
        const hasFillerWords = data.some((line) => fillerPattern.test(line.text));
        expect(hasFillerWords).toBe(true);
      }
    });
  });

  describe('GET /api/fixtures route logic', () => {
    it('reads fixture filenames and strips .json extension', () => {
      const fixturesDir = path.join(process.cwd(), 'src', 'fixtures');
      const files = fs.readdirSync(fixturesDir);
      const names = files
        .filter((f) => f.endsWith('.json'))
        .map((f) => f.replace('.json', ''));

      expect(names).toContain('discovery-call-001');
      expect(names).toContain('objection-handling-001');
      expect(names.length).toBeGreaterThanOrEqual(2);
    });
  });
});
