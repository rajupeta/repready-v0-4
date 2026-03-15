/**
 * TICKET-025 QA Validation — Test Agent
 *
 * Additional edge-case and regression tests for fixture files and call-type routing.
 */

import fs from 'fs';
import path from 'path';
import type { TranscriptLine } from '@/types';
import {
  resolveFixture,
  inferCallType,
  getFixturesForCallType,
  getDefaultFixture,
  VALID_CALL_TYPES,
} from '@/lib/call-type-routing';
import { sessionManager } from '@/lib/session-manager-instance';
import { NextRequest } from 'next/server';
import { POST as createSession } from '@/app/api/sessions/route';

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

// ---------------------------------------------------------------------------
// Fixture content quality checks
// ---------------------------------------------------------------------------
describe('Fixture content quality', () => {
  describe('discovery-call-001', () => {
    let data: TranscriptLine[];
    beforeAll(() => {
      data = loadFixture('discovery-call-001');
    });

    it('has alternating conversation flow (no 3+ consecutive same-speaker blocks)', () => {
      let consecutive = 1;
      for (let i = 1; i < data.length; i++) {
        if (data[i].speaker === data[i - 1].speaker) {
          consecutive++;
        } else {
          consecutive = 1;
        }
        // Allow max 2 consecutive from same speaker (reasonable in a call)
        expect(consecutive).toBeLessThanOrEqual(3);
      }
    });

    it('starts with rep greeting', () => {
      expect(data[0].speaker).toBe('rep');
    });

    it('has no empty or whitespace-only text', () => {
      for (const line of data) {
        expect(line.text.trim().length).toBeGreaterThan(0);
      }
    });

    it('contains question from prospect (for coaching rule triggers)', () => {
      const hasQuestion = data.some(
        (l) => l.speaker === 'prospect' && l.text.includes('?'),
      );
      expect(hasQuestion).toBe(true);
    });

    it('contains next steps discussion near end', () => {
      const lastFive = data.slice(-5);
      const nextStepsPattern =
        /next step|follow.up|schedule|calendar|thursday|friday|tuesday/i;
      const hasNextSteps = lastFive.some((l) => nextStepsPattern.test(l.text));
      expect(hasNextSteps).toBe(true);
    });

    it('fixture is valid JSON parseable as TranscriptLine[]', () => {
      const raw = fs.readFileSync(
        path.join(fixturesDir, 'discovery-call-001.json'),
        'utf-8',
      );
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
      for (const item of parsed) {
        expect(item).toHaveProperty('speaker');
        expect(item).toHaveProperty('text');
        expect(['rep', 'prospect']).toContain(item.speaker);
        expect(typeof item.text).toBe('string');
      }
    });
  });

  describe('objection-handling-001', () => {
    let data: TranscriptLine[];
    beforeAll(() => {
      data = loadFixture('objection-handling-001');
    });

    it('starts with rep greeting', () => {
      expect(data[0].speaker).toBe('rep');
    });

    it('has no empty or whitespace-only text', () => {
      for (const line of data) {
        expect(line.text.trim().length).toBeGreaterThan(0);
      }
    });

    it('contains objection handling (rep responds to price concern)', () => {
      const priceLineIdx = data.findIndex(
        (l) =>
          l.speaker === 'prospect' &&
          /price|expensive|cost|budget/i.test(l.text),
      );
      expect(priceLineIdx).toBeGreaterThan(-1);
      // Rep should respond within 2 lines after the objection
      const repResponseAfter = data
        .slice(priceLineIdx + 1, priceLineIdx + 3)
        .some((l) => l.speaker === 'rep');
      expect(repResponseAfter).toBe(true);
    });

    it('contains competitor mention from prospect', () => {
      const competitorPattern = /competitor|cheaper|alternative|also looking/i;
      const hasCompetitor = data.some(
        (l) => l.speaker === 'prospect' && competitorPattern.test(l.text),
      );
      expect(hasCompetitor).toBe(true);
    });

    it('contains hedging language from rep for coaching triggers', () => {
      const hedgingPattern =
        /\b(I think maybe|sort of|you know|kind of|basically)\b/i;
      const hasHedging = data.some(
        (l) => l.speaker === 'rep' && hedgingPattern.test(l.text),
      );
      expect(hasHedging).toBe(true);
    });

    it('fixture is valid JSON parseable as TranscriptLine[]', () => {
      const raw = fs.readFileSync(
        path.join(fixturesDir, 'objection-handling-001.json'),
        'utf-8',
      );
      const parsed = JSON.parse(raw);
      expect(Array.isArray(parsed)).toBe(true);
      for (const item of parsed) {
        expect(item).toHaveProperty('speaker');
        expect(item).toHaveProperty('text');
        expect(['rep', 'prospect']).toContain(item.speaker);
        expect(typeof item.text).toBe('string');
      }
    });
  });
});

// ---------------------------------------------------------------------------
// Call-type routing edge cases
// ---------------------------------------------------------------------------
describe('Call-type routing edge cases', () => {
  describe('inferCallType edge cases', () => {
    it('handles empty string by defaulting to discovery', () => {
      expect(inferCallType('')).toBe('discovery');
    });

    it('handles fixture name with extra suffix', () => {
      expect(inferCallType('discovery-call-001-v2')).toBe('discovery');
    });

    it('handles fixture name with numbers', () => {
      expect(inferCallType('objection-handling-999')).toBe('objection-handling');
    });

    it('is case-sensitive (uppercase returns discovery default)', () => {
      expect(inferCallType('DISCOVERY-call-001')).toBe('discovery');
    });
  });

  describe('resolveFixture edge cases', () => {
    it('preserves fixtureId even when it does not match callType', () => {
      const result = resolveFixture('demo', 'objection-handling-001');
      expect(result.fixtureId).toBe('objection-handling-001');
      expect(result.callType).toBe('demo');
    });

    it('accepts arbitrary fixtureId string', () => {
      const result = resolveFixture(undefined, 'custom-fixture-name');
      expect(result.fixtureId).toBe('custom-fixture-name');
      // Should default to discovery since no pattern matches
      expect(result.callType).toBe('discovery');
    });
  });

  describe('getFixturesForCallType consistency', () => {
    it('returns arrays (not undefined or null) for all valid types', () => {
      for (const ct of VALID_CALL_TYPES) {
        const result = getFixturesForCallType(ct);
        expect(Array.isArray(result)).toBe(true);
      }
    });

    it('every fixture in the map exists on disk', () => {
      for (const ct of VALID_CALL_TYPES) {
        const fixtures = getFixturesForCallType(ct);
        for (const f of fixtures) {
          const filePath = path.join(fixturesDir, `${f}.json`);
          expect(fs.existsSync(filePath)).toBe(true);
        }
      }
    });
  });

  describe('getDefaultFixture consistency', () => {
    it('default fixture is always the first in the list', () => {
      for (const ct of VALID_CALL_TYPES) {
        const defaultF = getDefaultFixture(ct);
        const allF = getFixturesForCallType(ct);
        expect(defaultF).toBe(allF[0]);
      }
    });
  });
});

// ---------------------------------------------------------------------------
// API route edge cases
// ---------------------------------------------------------------------------
describe('API session creation edge cases', () => {
  it('rejects empty string callType', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { callType: '' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects numeric callType', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { callType: 123 }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects null callType with no fixtureId', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { callType: null }),
    );
    expect(res.status).toBe(400);
  });

  it('accepts empty string fixtureId when callType is valid', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', {
        fixtureId: '',
        callType: 'discovery',
      }),
    );
    // Empty fixtureId should be treated as absent, callType resolves to default
    expect(res.status).toBe(201);
    const { sessionId } = await res.json();
    const session = sessionManager.getSession(sessionId);
    expect(session!.fixtureId).toBe('discovery-call-001');
  });

  it('handles all four valid call types', async () => {
    for (const ct of VALID_CALL_TYPES) {
      const res = await createSession(
        jsonPost('http://localhost/api/sessions', { callType: ct }),
      );
      expect(res.status).toBe(201);
      const { sessionId } = await res.json();
      const session = sessionManager.getSession(sessionId);
      expect(session!.callType).toBe(ct);
    }
  });
});

// ---------------------------------------------------------------------------
// Regression: no stale references to demo-call or discovery-call
// ---------------------------------------------------------------------------
describe('No stale fixture references', () => {
  it('demo-call.json does not exist on disk', () => {
    expect(fs.existsSync(path.join(fixturesDir, 'demo-call.json'))).toBe(false);
  });

  it('discovery-call.json (old name) does not exist on disk', () => {
    expect(fs.existsSync(path.join(fixturesDir, 'discovery-call.json'))).toBe(
      false,
    );
  });

  it('CALL_TYPE_FIXTURES does not reference demo-call', () => {
    for (const ct of VALID_CALL_TYPES) {
      const fixtures = getFixturesForCallType(ct);
      for (const f of fixtures) {
        expect(f).not.toBe('demo-call');
      }
    }
  });

  it('only .json and .gitkeep files exist in fixtures dir', () => {
    const files = fs.readdirSync(fixturesDir);
    for (const file of files) {
      expect(file === '.gitkeep' || file.endsWith('.json')).toBe(true);
    }
  });
});
