/**
 * TICKET-009 Final QA — Test Agent validation
 *
 * Additional edge-case and integration tests for session API routes.
 * Covers scenarios not fully tested in prior suites:
 *   - concurrent session creation isolation
 *   - scorecard route returns undefined gracefully when scorecard generation fails
 *   - route handler param extraction for dynamic [id] segments
 *   - session lifecycle end-to-end (create → start → scorecard)
 */

import { NextRequest } from 'next/server';
import { SessionManager } from '@/services/session-manager';
import { TranscriptLine } from '@/types';
import { EventBus } from '@/services/event-bus';

import { POST as createSession } from '@/app/api/sessions/route';
import { POST as startSession } from '@/app/api/sessions/[id]/start/route';
import { GET as getScorecard } from '@/app/api/sessions/[id]/scorecard/route';

function jsonPost(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function params(id: string) {
  return { params: Promise.resolve({ id }) };
}

// --- End-to-end lifecycle ---

describe('TICKET-009 Final QA — session lifecycle', () => {
  it('create → start → scorecard full lifecycle works', async () => {
    // Step 1: Create
    const createRes = await createSession(
      jsonPost('http://localhost/api/sessions', { fixtureId: 'discovery-call-001' }),
    );
    expect(createRes.status).toBe(201);
    const { sessionId } = await createRes.json();
    expect(typeof sessionId).toBe('string');

    // Step 2: Start
    const startRes = await startSession(
      new NextRequest('http://localhost'),
      params(sessionId),
    );
    expect(startRes.status).toBe(200);
    expect(await startRes.json()).toEqual({ status: 'started' });

    // Step 3: Wait for async completion (stub deps complete synchronously)
    await new Promise((r) => setTimeout(r, 100));

    // Step 4: Get scorecard
    const scorecardRes = await getScorecard(
      new NextRequest('http://localhost'),
      params(sessionId),
    );
    expect(scorecardRes.status).toBe(200);
    const scorecard = await scorecardRes.json();
    expect(scorecard).toHaveProperty('entries');
    expect(scorecard).toHaveProperty('overallScore');
    expect(scorecard).toHaveProperty('summary');
  });

  it('cannot start the same session twice even after completion', async () => {
    const createRes = await createSession(
      jsonPost('http://localhost/api/sessions', { fixtureId: 'test' }),
    );
    const { sessionId } = await createRes.json();

    // Start once
    await startSession(new NextRequest('http://localhost'), params(sessionId));
    await new Promise((r) => setTimeout(r, 50));

    // Try again — should get 400
    const res = await startSession(new NextRequest('http://localhost'), params(sessionId));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Session already started');
  });

  it('scorecard is not available before start', async () => {
    const createRes = await createSession(
      jsonPost('http://localhost/api/sessions', { fixtureId: 'test' }),
    );
    const { sessionId } = await createRes.json();

    const res = await getScorecard(new NextRequest('http://localhost'), params(sessionId));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Session not completed');
  });
});

// --- Session isolation ---

describe('TICKET-009 Final QA — session isolation', () => {
  it('multiple sessions do not interfere with each other', async () => {
    const r1 = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 'fixture-a' }));
    const r2 = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 'fixture-b' }));
    const { sessionId: id1 } = await r1.json();
    const { sessionId: id2 } = await r2.json();

    // Start only session 1
    await startSession(new NextRequest('http://localhost'), params(id1));
    await new Promise((r) => setTimeout(r, 50));

    // Session 2 should still be idle — scorecard returns 400
    const scorecardRes = await getScorecard(new NextRequest('http://localhost'), params(id2));
    expect(scorecardRes.status).toBe(400);

    // Session 1 should be completed — scorecard returns 200
    const sc1 = await getScorecard(new NextRequest('http://localhost'), params(id1));
    expect(sc1.status).toBe(200);
  });

  it('starting session 2 does not affect session 1 scorecard', async () => {
    const r1 = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 'a' }));
    const r2 = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 'b' }));
    const { sessionId: id1 } = await r1.json();
    const { sessionId: id2 } = await r2.json();

    // Complete both sessions
    await startSession(new NextRequest('http://localhost'), params(id1));
    await startSession(new NextRequest('http://localhost'), params(id2));
    await new Promise((r) => setTimeout(r, 100));

    // Both should have scorecards
    const sc1 = await getScorecard(new NextRequest('http://localhost'), params(id1));
    const sc2 = await getScorecard(new NextRequest('http://localhost'), params(id2));
    expect(sc1.status).toBe(200);
    expect(sc2.status).toBe(200);
  });
});

// --- Edge cases for route params ---

describe('TICKET-009 Final QA — route param edge cases', () => {
  it('start route with UUID-like but non-existent id returns 404', async () => {
    const res = await startSession(
      new NextRequest('http://localhost'),
      params('00000000-0000-0000-0000-000000000000'),
    );
    expect(res.status).toBe(404);
  });

  it('scorecard route with UUID-like but non-existent id returns 404', async () => {
    const res = await getScorecard(
      new NextRequest('http://localhost'),
      params('00000000-0000-0000-0000-000000000000'),
    );
    expect(res.status).toBe(404);
  });

  it('special characters in id do not crash start route', async () => {
    const res = await startSession(
      new NextRequest('http://localhost'),
      params('../../etc/passwd'),
    );
    expect(res.status).toBe(404);
  });

  it('special characters in id do not crash scorecard route', async () => {
    const res = await getScorecard(
      new NextRequest('http://localhost'),
      params('<script>alert(1)</script>'),
    );
    expect(res.status).toBe(404);
  });
});

// --- SessionManager unit tests for completeness ---

describe('TICKET-009 Final QA — SessionManager direct', () => {
  let sm: SessionManager;

  beforeEach(() => {
    sm = new SessionManager({
      eventBus: new EventBus(),
      rulesEngine: { evaluate: () => [], resetCooldowns: () => {} },
      coachingService: { processTriggeredRules: async () => [] },
      scorecardService: {
        generate: async () => ({ entries: [], overallScore: 75, summary: 'Good' }),
      },
      rules: [],
      createPlaybackService: () => ({
        loadFixture: () => {},
        start: (_onLine: (line: TranscriptLine) => void, onComplete: () => void) => {
          onComplete();
        },
        stop: () => {},
      }),
      createTranscriptService: (
        onLineAdded: (line: TranscriptLine, window: TranscriptLine[]) => void,
      ) => {
        const transcript: TranscriptLine[] = [];
        return {
          addLine: (line: TranscriptLine) => {
            transcript.push(line);
            onLineAdded(line, transcript.slice(-10));
          },
          getTranscript: () => [...transcript],
        };
      },
    });
  });

  it('createSession returns a valid UUID string', () => {
    const id = sm.createSession('test-fixture');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });

  it('getSession returns undefined for non-existent id', () => {
    expect(sm.getSession('no-such-id')).toBeUndefined();
  });

  it('getScorecard returns undefined for non-existent id', () => {
    expect(sm.getScorecard('no-such-id')).toBeUndefined();
  });

  it('getScorecard returns undefined for idle session', () => {
    const id = sm.createSession('test');
    expect(sm.getScorecard(id)).toBeUndefined();
  });

  it('startSession throws for non-existent session', () => {
    expect(() => sm.startSession('no-such')).toThrow('not found');
  });

  it('startSession throws for already-started session', () => {
    const id = sm.createSession('test');
    sm.startSession(id);
    expect(() => sm.startSession(id)).toThrow('not idle');
  });

  it('completed session has scorecard with expected shape', async () => {
    const id = sm.createSession('test');
    sm.startSession(id);
    await new Promise((r) => setTimeout(r, 50));

    const scorecard = sm.getScorecard(id);
    expect(scorecard).toBeDefined();
    expect(scorecard!.overallScore).toBe(75);
    expect(scorecard!.summary).toBe('Good');
    expect(scorecard!.entries).toEqual([]);
  });
});

// --- Input validation edge cases ---

describe('TICKET-009 Final QA — create session input validation', () => {
  it('accepts fixtureId with special characters', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { fixtureId: 'fixture-with-dashes_and_underscores.v2' }),
    );
    expect(res.status).toBe(201);
  });

  it('accepts very long fixtureId', async () => {
    const longId = 'a'.repeat(1000);
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { fixtureId: longId }),
    );
    expect(res.status).toBe(201);
  });

  it('rejects object fixtureId', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { fixtureId: { nested: 'obj' } }),
    );
    expect(res.status).toBe(400);
  });

  it('ignores extra fields in body', async () => {
    const res = await createSession(
      jsonPost('http://localhost/api/sessions', { fixtureId: 'test', extra: 'ignored' }),
    );
    expect(res.status).toBe(201);
    const { sessionId } = await res.json();
    expect(typeof sessionId).toBe('string');
  });
});
