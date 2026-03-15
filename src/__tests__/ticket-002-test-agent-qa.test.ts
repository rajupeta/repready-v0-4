/**
 * TICKET-002 — Test Agent QA Validation
 *
 * Comprehensive tests validating domain types, fixture data quality,
 * and the GET /api/fixtures route against acceptance criteria.
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
// Helpers
// ---------------------------------------------------------------------------
const FIXTURES_DIR = path.join(process.cwd(), 'src', 'fixtures');

function loadFixture(name: string): Record<string, unknown>[] {
  return JSON.parse(
    fs.readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf-8')
  );
}

const FIXTURE_NAMES = ['discovery-call', 'demo-call'] as const;

// ---------------------------------------------------------------------------
// 1. Acceptance Criteria: All TypeScript interfaces export cleanly
// ---------------------------------------------------------------------------
describe('AC: All TypeScript interfaces export cleanly from src/types/index.ts', () => {
  it('src/types/index.ts file exists', () => {
    const typesPath = path.join(process.cwd(), 'src', 'types', 'index.ts');
    expect(fs.existsSync(typesPath)).toBe(true);
  });

  it('TranscriptLine interface has required fields', () => {
    const line: TranscriptLine = { speaker: 'rep', text: 'Hello' };
    expect(line).toHaveProperty('speaker');
    expect(line).toHaveProperty('text');
  });

  it('TranscriptLine speaker is union of rep | prospect', () => {
    const rep: TranscriptLine = { speaker: 'rep', text: 'a' };
    const prospect: TranscriptLine = { speaker: 'prospect', text: 'b' };
    expect(rep.speaker).toBe('rep');
    expect(prospect.speaker).toBe('prospect');
  });

  it('TranscriptLine timestamp is optional', () => {
    const without: TranscriptLine = { speaker: 'rep', text: 'no ts' };
    const withTs: TranscriptLine = { speaker: 'rep', text: 'has ts', timestamp: 42 };
    expect(without.timestamp).toBeUndefined();
    expect(withTs.timestamp).toBe(42);
  });

  it('CoachingRule has all required fields including detect function', () => {
    const rule: CoachingRule = {
      ruleId: 'test',
      name: 'Test',
      description: 'Desc',
      cooldownMs: 1000,
      callTypes: ['discovery'],
      severity: 'medium',
      detect: () => false,
    };
    expect(rule.ruleId).toBe('test');
    expect(typeof rule.detect).toBe('function');
  });

  it('CoachingRule.detect accepts TranscriptLine[] and returns boolean', () => {
    const rule: CoachingRule = {
      ruleId: 'echo',
      name: 'Echo',
      description: 'Always true',
      cooldownMs: 0,
      callTypes: ['discovery'],
      severity: 'medium',
      detect: (window: TranscriptLine[]) => window.length > 0,
    };
    expect(rule.detect([])).toBe(false);
    expect(rule.detect([{ speaker: 'rep', text: 'hi' }])).toBe(true);
  });

  it('CoachingPrompt has all required fields', () => {
    const prompt: CoachingPrompt = {
      ruleId: 'r1',
      ruleName: 'Rule',
      message: 'msg',
      timestamp: 100,
    };
    expect(prompt).toEqual(
      expect.objectContaining({
        ruleId: 'r1',
        ruleName: 'Rule',
        message: 'msg',
        timestamp: 100,
      })
    );
  });

  it('Session has all required fields with optional scorecard', () => {
    const session: Session = {
      id: 's1',
      status: 'idle',
      fixtureId: 'demo-call',
      transcript: [],
      events: [],
    };
    expect(session.scorecard).toBeUndefined();

    const withScorecard: Session = {
      ...session,
      status: 'completed',
      scorecard: { entries: [], overallScore: 50, summary: 'OK' },
    };
    expect(withScorecard.scorecard).toBeDefined();
  });

  it('Session.status union includes idle, active, completed', () => {
    const statuses: Session['status'][] = ['idle', 'active', 'completed'];
    statuses.forEach((s) => {
      const session: Session = {
        id: `s-${s}`,
        status: s,
        fixtureId: 'f',
        transcript: [],
        events: [],
      };
      expect(session.status).toBe(s);
    });
  });

  it('ScorecardEntry.assessment union includes good, needs-work, missed', () => {
    const values: ScorecardEntry['assessment'][] = ['good', 'needs-work', 'missed'];
    values.forEach((a) => {
      const entry: ScorecardEntry = {
        ruleId: 'r',
        ruleName: 'R',
        assessment: a,
        comment: '',
      };
      expect(entry.assessment).toBe(a);
    });
  });

  it('Scorecard has entries array, overallScore number, and summary string', () => {
    const sc: Scorecard = {
      entries: [{ ruleId: 'r1', ruleName: 'R1', assessment: 'good', comment: 'ok' }],
      overallScore: 90,
      summary: 'Great',
    };
    expect(Array.isArray(sc.entries)).toBe(true);
    expect(typeof sc.overallScore).toBe('number');
    expect(typeof sc.summary).toBe('string');
  });

  it('SSEEvent.type union includes all four event types', () => {
    const types: SSEEvent['type'][] = [
      'transcript',
      'coaching_prompt',
      'session_complete',
      'heartbeat',
    ];
    types.forEach((t) => {
      const evt: SSEEvent = { type: t, data: {} };
      expect(evt.type).toBe(t);
    });
  });

  it('SSEEvent.data is typed as Record<string, unknown>', () => {
    const events: SSEEvent[] = [
      { type: 'transcript', data: { text: 'string' } },
      { type: 'heartbeat', data: { count: 123 } },
      { type: 'session_complete', data: { key: 'value' } },
      { type: 'coaching_prompt', data: {} },
    ];
    expect(events).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// 2. Acceptance Criteria: Fixture JSON files with ~25 lines of realistic dialogue
// ---------------------------------------------------------------------------
describe('AC: Two fixture JSON files exist with ~25 lines each', () => {
  it.each(FIXTURE_NAMES)('%s.json exists', (name) => {
    const filePath = path.join(FIXTURES_DIR, `${name}.json`);
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it.each(FIXTURE_NAMES)('%s.json is valid JSON', (name) => {
    const raw = fs.readFileSync(path.join(FIXTURES_DIR, `${name}.json`), 'utf-8');
    expect(() => JSON.parse(raw)).not.toThrow();
  });

  it.each(FIXTURE_NAMES)('%s.json is an array', (name) => {
    const data = loadFixture(name);
    expect(Array.isArray(data)).toBe(true);
  });

  it.each(FIXTURE_NAMES)('%s.json has approximately 25 lines', (name) => {
    const data = loadFixture(name);
    expect(data.length).toBeGreaterThanOrEqual(24);
    expect(data.length).toBeLessThanOrEqual(28);
  });
});

// ---------------------------------------------------------------------------
// 3. Acceptance Criteria: Speaker values are 'rep' or 'prospect'
// ---------------------------------------------------------------------------
describe('AC: Speaker values are rep or prospect', () => {
  it.each(FIXTURE_NAMES)('%s — every line has speaker set to rep or prospect', (name) => {
    const data = loadFixture(name);
    for (const line of data) {
      expect(['rep', 'prospect']).toContain(line.speaker);
    }
  });

  it.each(FIXTURE_NAMES)('%s — every line has a non-empty text string', (name) => {
    const data = loadFixture(name);
    for (const line of data) {
      expect(typeof line.text).toBe('string');
      expect((line.text as string).length).toBeGreaterThan(0);
    }
  });

  it.each(FIXTURE_NAMES)('%s — lines only contain speaker and text keys', (name) => {
    const data = loadFixture(name);
    for (const line of data) {
      const keys = Object.keys(line);
      expect(keys.every((k) => k === 'speaker' || k === 'text')).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Acceptance Criteria: Fixtures include coachable moments
// ---------------------------------------------------------------------------
describe('AC: Fixtures include coachable moments', () => {
  describe('monologues / feature dumping (rep lines > 200 chars)', () => {
    it.each(FIXTURE_NAMES)('%s has at least one long rep monologue', (name) => {
      const data = loadFixture(name);
      const longLines = data.filter(
        (l) => l.speaker === 'rep' && (l.text as string).length > 200
      );
      expect(longLines.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('filler words (um, uh, like, you know, basically)', () => {
    const fillerPattern = /\b(um|uh|like|you know|basically)\b/i;

    it.each(FIXTURE_NAMES)('%s has rep lines with filler words', (name) => {
      const data = loadFixture(name);
      const fillerLines = data.filter(
        (l) => l.speaker === 'rep' && fillerPattern.test(l.text as string)
      );
      expect(fillerLines.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('mixed speaker turns (realistic conversation flow)', () => {
    it.each(FIXTURE_NAMES)('%s has both rep and prospect lines', (name) => {
      const data = loadFixture(name);
      const speakers = new Set(data.map((l) => l.speaker));
      expect(speakers.size).toBe(2);
      expect(speakers.has('rep')).toBe(true);
      expect(speakers.has('prospect')).toBe(true);
    });

    it.each(FIXTURE_NAMES)('%s has a reasonable rep/prospect ratio', (name) => {
      const data = loadFixture(name);
      const repCount = data.filter((l) => l.speaker === 'rep').length;
      const prospectCount = data.filter((l) => l.speaker === 'prospect').length;
      // Expect both parties to have substantial participation
      expect(repCount).toBeGreaterThanOrEqual(8);
      expect(prospectCount).toBeGreaterThanOrEqual(8);
    });
  });

  describe('no timestamps in fixture data (v0 spec)', () => {
    it.each(FIXTURE_NAMES)('%s lines do not have a timestamp field', (name) => {
      const data = loadFixture(name);
      for (const line of data) {
        expect(line).not.toHaveProperty('timestamp');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// 5. Acceptance Criteria: GET /api/fixtures returns 200 with fixture names
// ---------------------------------------------------------------------------
describe('AC: GET /api/fixtures returns 200 with fixture names', () => {
  it('returns HTTP 200', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });

  it('returns JSON content type', async () => {
    const res = await GET();
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns an array', async () => {
    const res = await GET();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it('includes discovery-call in the response', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toContain('discovery-call');
  });

  it('includes demo-call in the response', async () => {
    const res = await GET();
    const body = await res.json();
    expect(body).toContain('demo-call');
  });

  it('does not include .json extension in names', async () => {
    const res = await GET();
    const body: string[] = await res.json();
    for (const name of body) {
      expect(name).not.toMatch(/\.json$/);
    }
  });

  it('does not include non-JSON files (e.g. .gitkeep)', async () => {
    const res = await GET();
    const body: string[] = await res.json();
    expect(body).not.toContain('.gitkeep');
    expect(body).not.toContain('gitkeep');
  });

  it('each returned name corresponds to an existing fixture file', async () => {
    const res = await GET();
    const body: string[] = await res.json();
    for (const name of body) {
      const exists = fs.existsSync(path.join(FIXTURES_DIR, `${name}.json`));
      expect(exists).toBe(true);
    }
  });
});
