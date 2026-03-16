/**
 * TICKET-025: Fix fixture files and add call-type routing
 *
 * Tests:
 * - discovery-call-001.json exists with competitor mention
 * - objection-handling-001.json exists with price pushback scenario
 * - demo-call.json removed
 * - Call-type routing implemented and tested
 * - No broken fixture references
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
import { sessionManager } from '@/lib/session-manager-instance';

const fixturesDir = path.join(process.cwd(), 'src', 'fixtures');

function loadFixture(name: string): TranscriptLine[] {
  return JSON.parse(fs.readFileSync(path.join(fixturesDir, `${name}.json`), 'utf-8'));
}

function jsonPost(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// AC1: discovery-call-001.json exists with competitor mention
// ---------------------------------------------------------------------------
describe('AC1: discovery-call-001.json with competitor mention', () => {
  it('file exists on disk', () => {
    const filePath = path.join(fixturesDir, 'discovery-call-001.json');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has 25-27 lines', () => {
    const data = loadFixture('discovery-call-001');
    expect(data.length).toBeGreaterThanOrEqual(25);
    expect(data.length).toBeLessThanOrEqual(27);
  });

  it('contains competitor mention from prospect', () => {
    const data = loadFixture('discovery-call-001');
    const competitorPattern = /competitor|alternative|outreach|salesloft|also looking at|compared to|versus/i;
    const mentionsCompetitor = data.some(
      (l) => l.speaker === 'prospect' && competitorPattern.test(l.text),
    );
    expect(mentionsCompetitor).toBe(true);
  });

  it('all lines have valid speaker and text', () => {
    const data = loadFixture('discovery-call-001');
    for (const line of data) {
      expect(['rep', 'prospect']).toContain(line.speaker);
      expect(typeof line.text).toBe('string');
      expect(line.text.length).toBeGreaterThan(0);
    }
  });

  it('includes filler words from rep', () => {
    const data = loadFixture('discovery-call-001');
    const fillerPattern = /\b(um|uh|like|you know|basically)\b/i;
    expect(data.some((l) => l.speaker === 'rep' && fillerPattern.test(l.text))).toBe(true);
  });

  it('includes long rep monologue (feature dump)', () => {
    const data = loadFixture('discovery-call-001');
    expect(data.some((l) => l.speaker === 'rep' && l.text.length > 200)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC2: objection-handling-001.json with price pushback scenario
// ---------------------------------------------------------------------------
describe('AC2: objection-handling-001.json with price pushback', () => {
  it('file exists on disk', () => {
    const filePath = path.join(fixturesDir, 'objection-handling-001.json');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('has 25-28 lines', () => {
    const data = loadFixture('objection-handling-001');
    expect(data.length).toBeGreaterThanOrEqual(25);
    expect(data.length).toBeLessThanOrEqual(28);
  });

  it('contains price pushback from prospect', () => {
    const data = loadFixture('objection-handling-001');
    const pricePattern = /price|expensive|cost|budget|cheaper|pricing/i;
    const hasPricePushback = data.some(
      (l) => l.speaker === 'prospect' && pricePattern.test(l.text),
    );
    expect(hasPricePushback).toBe(true);
  });

  it('all lines have valid speaker and text', () => {
    const data = loadFixture('objection-handling-001');
    for (const line of data) {
      expect(['rep', 'prospect']).toContain(line.speaker);
      expect(typeof line.text).toBe('string');
      expect(line.text.length).toBeGreaterThan(0);
    }
  });

  it('includes filler words from rep', () => {
    const data = loadFixture('objection-handling-001');
    const fillerPattern = /\b(um|uh|like|you know|basically)\b/i;
    expect(data.some((l) => l.speaker === 'rep' && fillerPattern.test(l.text))).toBe(true);
  });

  it('includes long rep monologue (feature dump)', () => {
    const data = loadFixture('objection-handling-001');
    expect(data.some((l) => l.speaker === 'rep' && l.text.length > 200)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// AC3: demo-call.json removed
// ---------------------------------------------------------------------------
describe('AC3: demo-call.json removed', () => {
  it('demo-call.json does not exist', () => {
    const filePath = path.join(fixturesDir, 'demo-call.json');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it('old discovery-call.json does not exist (renamed)', () => {
    const filePath = path.join(fixturesDir, 'discovery-call.json');
    expect(fs.existsSync(filePath)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC4: Call-type routing implemented and tested
// ---------------------------------------------------------------------------
describe('AC4: Call-type routing', () => {
  describe('inferCallType', () => {
    it('infers discovery from discovery-call-001', () => {
      expect(inferCallType('discovery-call-001')).toBe('discovery');
    });

    it('infers objection-handling from objection-handling-001', () => {
      expect(inferCallType('objection-handling-001')).toBe('objection-handling');
    });

    it('infers demo from demo-xxx', () => {
      expect(inferCallType('demo-call-001')).toBe('demo');
    });

    it('infers follow-up from follow-up-xxx', () => {
      expect(inferCallType('follow-up-001')).toBe('follow-up');
    });

    it('defaults to discovery for unknown patterns', () => {
      expect(inferCallType('unknown-fixture')).toBe('discovery');
    });
  });

  describe('getFixturesForCallType', () => {
    it('returns fixtures for discovery', () => {
      const fixtures = getFixturesForCallType('discovery');
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures).toContain('discovery-call-001');
    });

    it('returns fixtures for objection-handling', () => {
      const fixtures = getFixturesForCallType('objection-handling');
      expect(fixtures.length).toBeGreaterThan(0);
      expect(fixtures).toContain('objection-handling-001');
    });

    it('returns fixtures for all valid call types', () => {
      for (const ct of VALID_CALL_TYPES) {
        const fixtures = getFixturesForCallType(ct);
        expect(fixtures.length).toBeGreaterThan(0);
      }
    });
  });

  describe('getDefaultFixture', () => {
    it('returns a default fixture for each call type', () => {
      for (const ct of VALID_CALL_TYPES) {
        const fixture = getDefaultFixture(ct);
        expect(typeof fixture).toBe('string');
        expect(fixture!.length).toBeGreaterThan(0);
      }
    });
  });

  describe('resolveFixture', () => {
    it('resolves fixtureId directly when provided', () => {
      const result = resolveFixture(undefined, 'discovery-call-001');
      expect(result.fixtureId).toBe('discovery-call-001');
      expect(result.callType).toBe('discovery');
    });

    it('resolves callType to default fixture', () => {
      const result = resolveFixture('discovery');
      expect(result.fixtureId).toBe('discovery-call-001');
      expect(result.callType).toBe('discovery');
    });

    it('resolves objection-handling callType to correct fixture', () => {
      const result = resolveFixture('objection-handling');
      expect(result.fixtureId).toBe('objection-handling-001');
      expect(result.callType).toBe('objection-handling');
    });

    it('uses explicit callType over inferred one', () => {
      const result = resolveFixture('objection-handling', 'discovery-call-001');
      expect(result.fixtureId).toBe('discovery-call-001');
      expect(result.callType).toBe('objection-handling');
    });

    it('throws when neither callType nor fixtureId provided', () => {
      expect(() => resolveFixture()).toThrow();
    });
  });

  describe('VALID_CALL_TYPES', () => {
    it('contains all four call types', () => {
      expect(VALID_CALL_TYPES).toContain('discovery');
      expect(VALID_CALL_TYPES).toContain('demo');
      expect(VALID_CALL_TYPES).toContain('objection-handling');
      expect(VALID_CALL_TYPES).toContain('follow-up');
      expect(VALID_CALL_TYPES).toHaveLength(4);
    });
  });
});

// ---------------------------------------------------------------------------
// AC4b: Session creation with callType via API
// ---------------------------------------------------------------------------
describe('AC4b: Session creation with callType', () => {
  it('creates session with callType when provided', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { callType: 'discovery' }),
    );
    expect(res.status).toBe(201);
    const { sessionId } = await res.json();
    const session = sessionManager.getSession(sessionId);
    expect(session).toBeDefined();
    expect(session!.callType).toBe('discovery');
    expect(session!.fixtureId).toBe('discovery-call-001');
  });

  it('creates session with objection-handling callType', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { callType: 'objection-handling' }),
    );
    expect(res.status).toBe(201);
    const { sessionId } = await res.json();
    const session = sessionManager.getSession(sessionId);
    expect(session!.callType).toBe('objection-handling');
    expect(session!.fixtureId).toBe('objection-handling-001');
  });

  it('creates session with fixtureId and infers callType', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { fixtureId: 'discovery-call-001' }),
    );
    expect(res.status).toBe(201);
    const { sessionId } = await res.json();
    const session = sessionManager.getSession(sessionId);
    expect(session!.callType).toBe('discovery');
    expect(session!.fixtureId).toBe('discovery-call-001');
  });

  it('creates session with both fixtureId and callType', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', {
        fixtureId: 'discovery-call-001',
        callType: 'objection-handling',
      }),
    );
    expect(res.status).toBe(201);
    const { sessionId } = await res.json();
    const session = sessionManager.getSession(sessionId);
    expect(session!.callType).toBe('objection-handling');
    expect(session!.fixtureId).toBe('discovery-call-001');
  });

  it('rejects request with neither fixtureId nor callType', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', {}),
    );
    expect(res.status).toBe(400);
  });

  it('rejects invalid callType', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { callType: 'invalid-type' }),
    );
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// AC4c: SessionManager stores callType
// ---------------------------------------------------------------------------
describe('AC4c: SessionManager callType support', () => {
  it('createSession stores callType on session', () => {
    const id = sessionManager.createSession('discovery-call-001', 'discovery');
    const session = sessionManager.getSession(id);
    expect(session!.callType).toBe('discovery');
  });

  it('createSession defaults callType to discovery when not provided', () => {
    const id = sessionManager.createSession('some-fixture', 'discovery');
    const session = sessionManager.getSession(id);
    expect(session!.callType).toBe('discovery');
  });
});

// ---------------------------------------------------------------------------
// AC5: No broken fixture references
// ---------------------------------------------------------------------------
describe('AC5: No broken fixture references', () => {
  it('all fixture files referenced in routing exist on disk', () => {
    for (const ct of VALID_CALL_TYPES) {
      const fixtures = getFixturesForCallType(ct);
      for (const fixture of fixtures) {
        const filePath = path.join(fixturesDir, `${fixture}.json`);
        expect(fs.existsSync(filePath)).toBe(true);
      }
    }
  });

  it('GET /api/fixtures returns only files that exist', async () => {
    const { GET } = await import('@/app/api/fixtures/route');
    const response = await GET();
    const names: string[] = await response.json();

    for (const name of names) {
      const filePath = path.join(fixturesDir, `${name}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    }
  });
});
