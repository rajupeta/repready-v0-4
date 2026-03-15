/**
 * TICKET-002 QA Validation — Test Agent
 * Additional test coverage for domain types, fixture data, and fixtures API route.
 */
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
import { GET } from '@/app/api/fixtures/route';

// ---------------------------------------------------------------------------
// 1. Types — structural & edge-case validation
// ---------------------------------------------------------------------------
describe('Domain types — edge cases', () => {
  it('TranscriptLine with empty text is structurally valid', () => {
    // The type allows empty strings — runtime validation is a separate concern
    const line: TranscriptLine = { speaker: 'rep', text: '' };
    expect(line.text).toBe('');
  });

  it('TranscriptLine timestamp is optional and can be 0', () => {
    const a: TranscriptLine = { speaker: 'rep', text: 'hi' };
    const b: TranscriptLine = { speaker: 'prospect', text: 'hello', timestamp: 0 };
    expect(a.timestamp).toBeUndefined();
    expect(b.timestamp).toBe(0);
  });

  it('CoachingRule detect function receives a window array', () => {
    const window: TranscriptLine[] = [
      { speaker: 'rep', text: 'one' },
      { speaker: 'prospect', text: 'two' },
      { speaker: 'rep', text: 'three' },
    ];
    const rule: CoachingRule = {
      ruleId: 'monologue',
      name: 'Monologue detector',
      description: 'Fires when rep speaks 3+ times in a row',
      cooldownMs: 10000,
      callTypes: ['discovery'],
      severity: 'medium',
      detect: (w) => {
        let consecutive = 0;
        for (const line of w) {
          consecutive = line.speaker === 'rep' ? consecutive + 1 : 0;
        }
        return consecutive >= 3;
      },
    };
    // window has rep, prospect, rep — not 3 consecutive reps
    expect(rule.detect(window)).toBe(false);
    // append two more rep lines
    window.push({ speaker: 'rep', text: 'four' }, { speaker: 'rep', text: 'five' });
    expect(rule.detect(window)).toBe(true);
  });

  it('CoachingPrompt timestamp can be any positive number', () => {
    const prompt: CoachingPrompt = {
      ruleId: 'r1',
      ruleName: 'Filler',
      message: 'Reduce filler words',
      timestamp: 1710000000000,
    };
    expect(prompt.timestamp).toBeGreaterThan(0);
  });

  it('Session status covers all three valid states', () => {
    const states: Session['status'][] = ['idle', 'active', 'completed'];
    states.forEach((status) => {
      const s: Session = {
        id: `s-${status}`,
        status,
        fixtureId: 'demo-call',
        transcript: [],
      };
      expect(s.status).toBe(status);
    });
  });

  it('Scorecard overallScore accepts boundary values 0 and 100', () => {
    const low: Scorecard = { entries: [], overallScore: 0, summary: 'Poor' };
    const high: Scorecard = { entries: [], overallScore: 100, summary: 'Perfect' };
    expect(low.overallScore).toBe(0);
    expect(high.overallScore).toBe(100);
  });

  it('ScorecardEntry assessment covers all three valid values', () => {
    const assessments: ScorecardEntry['assessment'][] = ['good', 'needs-work', 'missed'];
    assessments.forEach((assessment) => {
      const entry: ScorecardEntry = {
        ruleId: 'r1',
        ruleName: 'Test',
        assessment,
        comment: `Assessment is ${assessment}`,
      };
      expect(entry.assessment).toBe(assessment);
    });
  });

  it('SSEEvent data field accepts diverse payload types', () => {
    const events: SSEEvent[] = [
      { type: 'transcript', data: { speaker: 'rep', text: 'hi' } },
      { type: 'coaching_prompt', data: { ruleId: 'r1' } },
      { type: 'session_complete', data: {} },
      { type: 'heartbeat', data: {} },
    ];
    expect(events).toHaveLength(4);
    expect(events[2].data).toEqual({});
    expect(events[3].data).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// 2. Fixture data — deeper content validation
// ---------------------------------------------------------------------------
describe('Fixture data — content quality', () => {
  const fixturesDir = path.join(process.cwd(), 'src', 'fixtures');

  const loadFixture = (name: string): TranscriptLine[] =>
    JSON.parse(fs.readFileSync(path.join(fixturesDir, `${name}.json`), 'utf-8'));

  it('discovery-call has exactly the expected line count (25-27)', () => {
    const data = loadFixture('discovery-call');
    expect(data.length).toBeGreaterThanOrEqual(25);
    expect(data.length).toBeLessThanOrEqual(27);
  });

  it('demo-call has exactly the expected line count (25-28)', () => {
    const data = loadFixture('demo-call');
    expect(data.length).toBeGreaterThanOrEqual(25);
    expect(data.length).toBeLessThanOrEqual(28);
  });

  it('fixtures contain both rep and prospect speakers', () => {
    for (const name of ['discovery-call', 'demo-call']) {
      const data = loadFixture(name);
      const speakers = new Set(data.map((l) => l.speaker));
      expect(speakers.has('rep')).toBe(true);
      expect(speakers.has('prospect')).toBe(true);
    }
  });

  it('no fixture line has an unexpected property beyond speaker/text', () => {
    for (const name of ['discovery-call', 'demo-call']) {
      const data = loadFixture(name);
      for (const line of data) {
        const keys = Object.keys(line);
        for (const key of keys) {
          expect(['speaker', 'text']).toContain(key);
        }
      }
    }
  });

  it('fixture lines do not contain timestamps (v0 spec: timestamps added by PlaybackService)', () => {
    for (const name of ['discovery-call', 'demo-call']) {
      const data = loadFixture(name);
      for (const line of data) {
        expect(line).not.toHaveProperty('timestamp');
      }
    }
  });

  it('discovery-call includes feature dumping (long rep monologue)', () => {
    const data = loadFixture('discovery-call');
    const longRepLines = data.filter((l) => l.speaker === 'rep' && l.text.length > 200);
    expect(longRepLines.length).toBeGreaterThanOrEqual(1);
  });

  it('demo-call includes feature dumping (long rep monologue)', () => {
    const data = loadFixture('demo-call');
    const longRepLines = data.filter((l) => l.speaker === 'rep' && l.text.length > 200);
    expect(longRepLines.length).toBeGreaterThanOrEqual(1);
  });

  it('discovery-call includes filler words from rep', () => {
    const data = loadFixture('discovery-call');
    const fillerPattern = /\b(um|uh|like|you know|basically)\b/i;
    const repWithFiller = data.filter(
      (l) => l.speaker === 'rep' && fillerPattern.test(l.text)
    );
    expect(repWithFiller.length).toBeGreaterThanOrEqual(1);
  });

  it('demo-call includes filler words from rep', () => {
    const data = loadFixture('demo-call');
    const fillerPattern = /\b(um|uh|like|you know|basically)\b/i;
    const repWithFiller = data.filter(
      (l) => l.speaker === 'rep' && fillerPattern.test(l.text)
    );
    expect(repWithFiller.length).toBeGreaterThanOrEqual(1);
  });

  it('fixtures are valid JSON arrays (not objects or primitives)', () => {
    for (const name of ['discovery-call', 'demo-call']) {
      const raw = fs.readFileSync(path.join(fixturesDir, `${name}.json`), 'utf-8');
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
    }
  });

  it('no fixture line has empty speaker or text', () => {
    for (const name of ['discovery-call', 'demo-call']) {
      const data = loadFixture(name);
      for (const line of data) {
        expect(line.speaker).toBeTruthy();
        expect(line.text.length).toBeGreaterThan(0);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 3. GET /api/fixtures route — integration test
// ---------------------------------------------------------------------------
describe('GET /api/fixtures route', () => {
  it('returns a Response with status 200', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
  });

  it('returns JSON content-type', async () => {
    const response = await GET();
    const contentType = response.headers.get('content-type');
    expect(contentType).toContain('application/json');
  });

  it('returns array containing discovery-call and demo-call', async () => {
    const response = await GET();
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toContain('discovery-call');
    expect(body).toContain('demo-call');
  });

  it('returns fixture names without .json extension', async () => {
    const response = await GET();
    const body: string[] = await response.json();
    for (const name of body) {
      expect(name).not.toContain('.json');
    }
  });

  it('does not include non-json files in the result', async () => {
    const response = await GET();
    const body: string[] = await response.json();
    // All returned names should correspond to actual .json files
    const fixturesDir = path.join(process.cwd(), 'src', 'fixtures');
    for (const name of body) {
      const filePath = path.join(fixturesDir, `${name}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });
});
