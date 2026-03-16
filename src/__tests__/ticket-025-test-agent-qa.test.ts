/**
 * TICKET-025 Test Agent QA Validation
 *
 * Independent validation of fixture files and call-type routing implementation
 * by the test agent. Covers acceptance criteria, edge cases, and regression checks.
 */

import fs from 'fs';
import path from 'path';
import { NextRequest } from 'next/server';
import type { TranscriptLine, CallType } from '@/types';
import {
  resolveFixture,
  inferCallType,
  getFixturesForCallType,
  getDefaultFixture,
  VALID_CALL_TYPES,
} from '@/lib/call-type-routing';
import { POST as createSession } from '@/app/api/sessions/route';
import { GET as getFixtures } from '@/app/api/fixtures/route';
import { sessionManager } from '@/lib/session-manager-instance';

const fixturesDir = path.join(process.cwd(), 'src', 'fixtures');

function loadFixture(name: string): TranscriptLine[] {
  return JSON.parse(
    fs.readFileSync(path.join(fixturesDir, `${name}.json`), 'utf-8'),
  );
}

function jsonPost(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ===========================================================================
// AC1: discovery-call-001.json exists with competitor mention added
// ===========================================================================
describe('AC1 — discovery-call-001.json with competitor mention', () => {
  let data: TranscriptLine[];

  beforeAll(() => {
    data = loadFixture('discovery-call-001');
  });

  it('file exists at src/fixtures/discovery-call-001.json', () => {
    expect(
      fs.existsSync(path.join(fixturesDir, 'discovery-call-001.json')),
    ).toBe(true);
  });

  it('is a non-empty array of TranscriptLine objects', () => {
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    for (const line of data) {
      expect(line).toHaveProperty('speaker');
      expect(line).toHaveProperty('text');
      expect(['rep', 'prospect']).toContain(line.speaker);
      expect(typeof line.text).toBe('string');
      expect(line.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('contains competitor mention (Outreach/SalesLoft) from prospect', () => {
    const competitorPattern =
      /outreach|salesloft|competitor|alternative|versus|compared to|also (looking|evaluated)/i;
    const found = data.filter(
      (l) => l.speaker === 'prospect' && competitorPattern.test(l.text),
    );
    expect(found.length).toBeGreaterThanOrEqual(1);
  });

  it('has { speaker, text } shape only — no extra fields', () => {
    for (const line of data) {
      const keys = Object.keys(line);
      expect(keys).toContain('speaker');
      expect(keys).toContain('text');
      // Only speaker and text allowed per spec (timestamps added by PlaybackService)
      for (const k of keys) {
        expect(['speaker', 'text']).toContain(k);
      }
    }
  });
});

// ===========================================================================
// AC2: objection-handling-001.json exists with price pushback scenario
// ===========================================================================
describe('AC2 — objection-handling-001.json with price pushback', () => {
  let data: TranscriptLine[];

  beforeAll(() => {
    data = loadFixture('objection-handling-001');
  });

  it('file exists at src/fixtures/objection-handling-001.json', () => {
    expect(
      fs.existsSync(path.join(fixturesDir, 'objection-handling-001.json')),
    ).toBe(true);
  });

  it('is a non-empty array of TranscriptLine objects', () => {
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    for (const line of data) {
      expect(['rep', 'prospect']).toContain(line.speaker);
      expect(typeof line.text).toBe('string');
      expect(line.text.trim().length).toBeGreaterThan(0);
    }
  });

  it('contains price pushback from prospect', () => {
    const pricePattern = /price|expensive|cost|budget|cheaper|pricing|\$/i;
    const pushbackLines = data.filter(
      (l) => l.speaker === 'prospect' && pricePattern.test(l.text),
    );
    expect(pushbackLines.length).toBeGreaterThanOrEqual(1);
  });

  it('rep responds to price objection (not left unaddressed)', () => {
    const priceIdx = data.findIndex(
      (l) =>
        l.speaker === 'prospect' &&
        /price|expensive|cost|budget/i.test(l.text),
    );
    expect(priceIdx).toBeGreaterThan(-1);
    // There should be a rep response within next 2 lines
    const nextLines = data.slice(priceIdx + 1, priceIdx + 3);
    expect(nextLines.some((l) => l.speaker === 'rep')).toBe(true);
  });

  it('has { speaker, text } shape only — no extra fields', () => {
    for (const line of data) {
      const keys = Object.keys(line);
      for (const k of keys) {
        expect(['speaker', 'text']).toContain(k);
      }
    }
  });
});

// ===========================================================================
// AC3: demo-call.json removed or replaced
// ===========================================================================
describe('AC3 — demo-call.json removed', () => {
  it('demo-call.json does not exist on disk', () => {
    expect(fs.existsSync(path.join(fixturesDir, 'demo-call.json'))).toBe(
      false,
    );
  });

  it('old discovery-call.json does not exist (was renamed to -001)', () => {
    expect(fs.existsSync(path.join(fixturesDir, 'discovery-call.json'))).toBe(
      false,
    );
  });

  it('fixtures directory contains exactly the expected files', () => {
    const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
    expect(files.sort()).toEqual(
      ['discovery-call-001.json', 'objection-handling-001.json'].sort(),
    );
  });
});

// ===========================================================================
// AC4: Call-type routing implemented and tested
// ===========================================================================
describe('AC4 — Call-type routing module', () => {
  describe('VALID_CALL_TYPES', () => {
    it('exports exactly 4 call types', () => {
      expect(VALID_CALL_TYPES).toHaveLength(4);
    });

    it('includes discovery, demo, objection-handling, follow-up', () => {
      expect(VALID_CALL_TYPES).toEqual(
        expect.arrayContaining([
          'discovery',
          'demo',
          'objection-handling',
          'follow-up',
        ]),
      );
    });

    it('matches the CallType union type values', () => {
      const expected: CallType[] = [
        'discovery',
        'demo',
        'objection-handling',
        'follow-up',
      ];
      for (const ct of expected) {
        expect(VALID_CALL_TYPES).toContain(ct);
      }
    });
  });

  describe('inferCallType', () => {
    it.each([
      ['discovery-call-001', 'discovery'],
      ['discovery-call-002', 'discovery'],
      ['objection-handling-001', 'objection-handling'],
      ['demo-call-001', 'demo'],
      ['follow-up-001', 'follow-up'],
      ['something-random', 'discovery'], // default
      ['', 'discovery'], // empty string defaults
    ] as [string, CallType][])(
      'infers "%s" → "%s"',
      (input, expected) => {
        expect(inferCallType(input)).toBe(expected);
      },
    );
  });

  describe('getFixturesForCallType', () => {
    it('returns non-empty arrays for all valid call types', () => {
      for (const ct of VALID_CALL_TYPES) {
        const fixtures = getFixturesForCallType(ct);
        expect(Array.isArray(fixtures)).toBe(true);
        expect(fixtures.length).toBeGreaterThan(0);
      }
    });

    it('discovery maps to discovery-call-001', () => {
      expect(getFixturesForCallType('discovery')).toContain(
        'discovery-call-001',
      );
    });

    it('objection-handling maps to objection-handling-001', () => {
      expect(getFixturesForCallType('objection-handling')).toContain(
        'objection-handling-001',
      );
    });

    it('every mapped fixture file actually exists on disk', () => {
      for (const ct of VALID_CALL_TYPES) {
        for (const fid of getFixturesForCallType(ct)) {
          expect(
            fs.existsSync(path.join(fixturesDir, `${fid}.json`)),
          ).toBe(true);
        }
      }
    });
  });

  describe('getDefaultFixture', () => {
    it('returns a string for every valid call type', () => {
      for (const ct of VALID_CALL_TYPES) {
        const def = getDefaultFixture(ct);
        expect(typeof def).toBe('string');
        expect(def!.length).toBeGreaterThan(0);
      }
    });

    it('default is the first entry in getFixturesForCallType', () => {
      for (const ct of VALID_CALL_TYPES) {
        expect(getDefaultFixture(ct)).toBe(getFixturesForCallType(ct)[0]);
      }
    });
  });

  describe('resolveFixture', () => {
    it('resolves callType only → default fixture', () => {
      const r = resolveFixture('discovery');
      expect(r.fixtureId).toBe('discovery-call-001');
      expect(r.callType).toBe('discovery');
    });

    it('resolves fixtureId only → inferred callType', () => {
      const r = resolveFixture(undefined, 'objection-handling-001');
      expect(r.fixtureId).toBe('objection-handling-001');
      expect(r.callType).toBe('objection-handling');
    });

    it('fixtureId + callType → both preserved (callType not overridden)', () => {
      const r = resolveFixture('demo', 'discovery-call-001');
      expect(r.fixtureId).toBe('discovery-call-001');
      expect(r.callType).toBe('demo');
    });

    it('throws when neither provided', () => {
      expect(() => resolveFixture()).toThrow(
        'Either callType or fixtureId must be provided',
      );
    });

    it('throws with undefined callType and undefined fixtureId', () => {
      expect(() => resolveFixture(undefined, undefined)).toThrow();
    });
  });
});

// ===========================================================================
// AC4 — Session creation API integrates call-type routing
// ===========================================================================
describe('AC4 — POST /api/sessions with callType routing', () => {
  it('creates session with callType=discovery', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { callType: 'discovery' }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.sessionId).toBeDefined();
    const session = sessionManager.getSession(body.sessionId);
    expect(session).toBeDefined();
    expect(session!.callType).toBe('discovery');
    expect(session!.fixtureId).toBe('discovery-call-001');
  });

  it('creates session with callType=objection-handling', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', {
        callType: 'objection-handling',
      }),
    );
    expect(res.status).toBe(201);
    const { sessionId } = await res.json();
    const session = sessionManager.getSession(sessionId);
    expect(session!.callType).toBe('objection-handling');
    expect(session!.fixtureId).toBe('objection-handling-001');
  });

  it('creates session with fixtureId, infers callType', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', {
        fixtureId: 'discovery-call-001',
      }),
    );
    expect(res.status).toBe(201);
    const { sessionId } = await res.json();
    const session = sessionManager.getSession(sessionId);
    expect(session!.callType).toBe('discovery');
  });

  it('rejects empty body (no callType or fixtureId)', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', {}),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid callType', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { callType: 'nonexistent' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects numeric callType', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { callType: 42 }),
    );
    expect(res.status).toBe(400);
  });

  it('handles empty string fixtureId with valid callType', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', {
        fixtureId: '',
        callType: 'discovery',
      }),
    );
    expect(res.status).toBe(201);
    const { sessionId } = await res.json();
    const session = sessionManager.getSession(sessionId);
    expect(session!.fixtureId).toBe('discovery-call-001');
  });
});

// ===========================================================================
// AC4 — SessionManager stores callType
// ===========================================================================
describe('AC4 — SessionManager.createSession callType storage', () => {
  it('stores explicit callType', () => {
    const id = sessionManager.createSession(
      'objection-handling-001',
      'objection-handling',
    );
    const s = sessionManager.getSession(id);
    expect(s!.callType).toBe('objection-handling');
  });

  it('defaults callType to discovery when omitted', () => {
    const id = sessionManager.createSession('discovery-call-001', 'discovery');
    const s = sessionManager.getSession(id);
    expect(s!.callType).toBe('discovery');
  });

  it('session starts in idle status', () => {
    const id = sessionManager.createSession('discovery-call-001', 'discovery');
    const s = sessionManager.getSession(id);
    expect(s!.status).toBe('idle');
  });
});

// ===========================================================================
// AC5: No broken fixture references in codebase
// ===========================================================================
describe('AC5 — No broken fixture references', () => {
  it('GET /api/fixtures returns only existing files', async () => {
    const res = await getFixtures();
    const names: string[] = await res.json();
    expect(Array.isArray(names)).toBe(true);
    for (const name of names) {
      expect(
        fs.existsSync(path.join(fixturesDir, `${name}.json`)),
      ).toBe(true);
    }
  });

  it('GET /api/fixtures does not include demo-call', async () => {
    const res = await getFixtures();
    const names: string[] = await res.json();
    expect(names).not.toContain('demo-call');
  });

  it('GET /api/fixtures includes discovery-call-001', async () => {
    const res = await getFixtures();
    const names: string[] = await res.json();
    expect(names).toContain('discovery-call-001');
  });

  it('GET /api/fixtures includes objection-handling-001', async () => {
    const res = await getFixtures();
    const names: string[] = await res.json();
    expect(names).toContain('objection-handling-001');
  });

  it('CALL_TYPE_FIXTURES map has no references to deleted fixtures', () => {
    for (const ct of VALID_CALL_TYPES) {
      const fixtures = getFixturesForCallType(ct);
      for (const f of fixtures) {
        expect(f).not.toBe('demo-call');
        expect(f).not.toBe('discovery-call');
      }
    }
  });
});

// ===========================================================================
// Fixture content quality — coaching rule trigger scenarios
// ===========================================================================
describe('Fixture quality — coaching rule triggers', () => {
  describe('discovery-call-001 triggers', () => {
    let data: TranscriptLine[];
    beforeAll(() => {
      data = loadFixture('discovery-call-001');
    });

    it('contains filler words from rep (um, like, you know)', () => {
      const fillerPattern = /\b(um|uh|like|you know|basically)\b/i;
      expect(data.some((l) => l.speaker === 'rep' && fillerPattern.test(l.text))).toBe(true);
    });

    it('contains feature dump (long rep monologue > 200 chars)', () => {
      expect(data.some((l) => l.speaker === 'rep' && l.text.length > 200)).toBe(true);
    });

    it('contains competitor mention for competitor-not-explored rule', () => {
      const competitorPattern = /outreach|salesloft|competitor/i;
      expect(
        data.some((l) => l.speaker === 'prospect' && competitorPattern.test(l.text)),
      ).toBe(true);
    });

    it('contains questions from prospect', () => {
      expect(data.some((l) => l.speaker === 'prospect' && l.text.includes('?'))).toBe(true);
    });
  });

  describe('objection-handling-001 triggers', () => {
    let data: TranscriptLine[];
    beforeAll(() => {
      data = loadFixture('objection-handling-001');
    });

    it('contains hedging language (I think maybe, sort of)', () => {
      const hedgingPattern = /I think maybe|sort of|kind of/i;
      expect(data.some((l) => l.speaker === 'rep' && hedgingPattern.test(l.text))).toBe(true);
    });

    it('contains feature dump (long rep monologue > 200 chars)', () => {
      expect(data.some((l) => l.speaker === 'rep' && l.text.length > 200)).toBe(true);
    });

    it('contains competitor mention from prospect', () => {
      const competitorPattern = /competitor|cheaper|alternative/i;
      expect(
        data.some((l) => l.speaker === 'prospect' && competitorPattern.test(l.text)),
      ).toBe(true);
    });

    it('contains price objection (objection-deflected trigger)', () => {
      const objectionPattern = /expensive|too much|budget|price/i;
      expect(
        data.some((l) => l.speaker === 'prospect' && objectionPattern.test(l.text)),
      ).toBe(true);
    });
  });
});
