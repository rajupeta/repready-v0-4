/**
 * TICKET-009 Test Agent QA: Session API routes (create, start, scorecard)
 *
 * Validates all acceptance criteria:
 * AC1: POST /api/sessions with valid body returns 201 { sessionId }
 * AC2: POST /api/sessions/[id]/start returns 200 for idle, 404 missing, 400 already started
 * AC3: GET /api/sessions/[id]/scorecard returns scorecard for completed, 404 missing, 400 incomplete
 * AC4: All routes handle errors with appropriate status codes
 *
 * Also validates edge cases and code structure requirements from the ticket description.
 */

import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';

import { POST as createSession } from '@/app/api/sessions/route';
import { POST as startSession } from '@/app/api/sessions/[id]/start/route';
import { GET as getScorecard } from '@/app/api/sessions/[id]/scorecard/route';

// --- Helpers ---

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

// --- AC1: POST /api/sessions ---

describe('Test Agent QA — AC1: POST /api/sessions', () => {
  it('returns 201 with { sessionId } for valid fixtureId', async () => {
    const res = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 'discovery-call-001' }));
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json).toHaveProperty('sessionId');
    expect(typeof json.sessionId).toBe('string');
    expect(json.sessionId.length).toBeGreaterThan(0);
  });

  it('created session is retrievable via sessionManager', async () => {
    const res = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 'objection-handling' }));
    const { sessionId } = await res.json();

    const session = sessionManager.getSession(sessionId);
    expect(session).toBeDefined();
    expect(session!.status).toBe('idle');
    expect(session!.fixtureId).toBe('objection-handling');
  });

  it('generates unique session IDs for concurrent requests', async () => {
    const [res1, res2, res3] = await Promise.all([
      createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 'a' })),
      createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 'b' })),
      createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 'c' })),
    ]);

    const ids = await Promise.all([res1.json(), res2.json(), res3.json()]);
    const uniqueIds = new Set(ids.map((j) => j.sessionId));
    expect(uniqueIds.size).toBe(3);
  });

  it('returns 400 when fixtureId is missing from body', async () => {
    const res = await createSession(jsonPost('http://localhost/api/sessions', {}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('fixtureId or callType is required');
  });

  it('returns 400 for empty string fixtureId', async () => {
    const res = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for whitespace-only fixtureId', async () => {
    const res = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: '  \t  ' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-string fixtureId (number)', async () => {
    const res = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 99 }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for non-string fixtureId (boolean)', async () => {
    const res = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: true }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for null fixtureId', async () => {
    const res = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: null }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for array fixtureId', async () => {
    const res = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: ['a'] }));
    expect(res.status).toBe(400);
  });

  it('returns 500 for malformed JSON body', async () => {
    const req = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not valid json',
    });
    const res = await createSession(req);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });

  it('response Content-Type is application/json', async () => {
    const res = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 'test' }));
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

// --- AC2: POST /api/sessions/[id]/start ---

describe('Test Agent QA — AC2: POST /api/sessions/[id]/start', () => {
  let sessionId: string;

  beforeEach(() => {
    sessionId = sessionManager.createSession('discovery-call-001');
  });

  it('returns 200 { status: "started" } for idle session', async () => {
    const res = await startSession(new NextRequest('http://localhost'), params(sessionId));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'started' });
  });

  it('session transitions away from idle after start', async () => {
    expect(sessionManager.getSession(sessionId)!.status).toBe('idle');

    await startSession(new NextRequest('http://localhost'), params(sessionId));
    await new Promise((r) => setTimeout(r, 50));

    const after = sessionManager.getSession(sessionId);
    expect(after!.status).not.toBe('idle');
  });

  it('returns 404 for non-existent session id', async () => {
    const res = await startSession(new NextRequest('http://localhost'), params('no-such-id'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Session not found');
  });

  it('returns 400 when session has already been started', async () => {
    await startSession(new NextRequest('http://localhost'), params(sessionId));

    const res = await startSession(new NextRequest('http://localhost'), params(sessionId));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Session already started');
  });

  it('returns 400 for completed session (not idle)', async () => {
    sessionManager.startSession(sessionId);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionManager.getSession(sessionId)!.status).toBe('completed');

    const res = await startSession(new NextRequest('http://localhost'), params(sessionId));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Session already started');
  });

  it('returns 404 for empty string session id', async () => {
    const res = await startSession(new NextRequest('http://localhost'), params(''));
    expect(res.status).toBe(404);
  });

  it('response Content-Type is application/json', async () => {
    const res = await startSession(new NextRequest('http://localhost'), params(sessionId));
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

// --- AC3: GET /api/sessions/[id]/scorecard ---

describe('Test Agent QA — AC3: GET /api/sessions/[id]/scorecard', () => {
  it('returns scorecard JSON for completed session', async () => {
    const sessionId = sessionManager.createSession('discovery-call-001');
    sessionManager.startSession(sessionId);
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionManager.getSession(sessionId)!.status).toBe('completed');

    const res = await getScorecard(new NextRequest('http://localhost'), params(sessionId));
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty('entries');
    expect(json).toHaveProperty('overallScore');
    expect(json).toHaveProperty('summary');
    expect(Array.isArray(json.entries)).toBe(true);
    expect(typeof json.overallScore).toBe('number');
    expect(typeof json.summary).toBe('string');
  });

  it('returns 404 for non-existent session', async () => {
    const res = await getScorecard(new NextRequest('http://localhost'), params('ghost-session'));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('Session not found');
  });

  it('returns 400 for idle (not completed) session', async () => {
    const sessionId = sessionManager.createSession('discovery-call-001');

    const res = await getScorecard(new NextRequest('http://localhost'), params(sessionId));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Session not completed');
  });

  it('returns 400 for empty string session id that does not exist', async () => {
    const res = await getScorecard(new NextRequest('http://localhost'), params(''));
    expect(res.status).toBe(404);
  });

  it('scorecard entries array and score are structurally valid', async () => {
    const sessionId = sessionManager.createSession('discovery-call-001');
    sessionManager.startSession(sessionId);
    await new Promise((r) => setTimeout(r, 50));

    const res = await getScorecard(new NextRequest('http://localhost'), params(sessionId));
    const json = await res.json();

    expect(json.overallScore).toBeGreaterThanOrEqual(0);
    expect(json.overallScore).toBeLessThanOrEqual(100);
  });

  it('response Content-Type is application/json', async () => {
    const sessionId = sessionManager.createSession('discovery-call-001');
    const res = await getScorecard(new NextRequest('http://localhost'), params(sessionId));
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

// --- AC4: Error handling ---

describe('Test Agent QA — AC4: Error handling', () => {
  it('POST /api/sessions catches unexpected errors and returns 500', async () => {
    const req = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{{{{',
    });
    const res = await createSession(req);
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe('Internal server error');
  });

  it('all error responses include an error field', async () => {
    // 400 from create
    const r1 = await createSession(jsonPost('http://localhost/api/sessions', {}));
    expect((await r1.json())).toHaveProperty('error');

    // 404 from start
    const r2 = await startSession(new NextRequest('http://localhost'), params('nope'));
    expect((await r2.json())).toHaveProperty('error');

    // 404 from scorecard
    const r3 = await getScorecard(new NextRequest('http://localhost'), params('nope'));
    expect((await r3.json())).toHaveProperty('error');
  });
});

// --- Code structure verification ---

describe('Test Agent QA — Code structure', () => {
  it('sessionManager singleton exposes required methods', () => {
    expect(typeof sessionManager.createSession).toBe('function');
    expect(typeof sessionManager.getSession).toBe('function');
    expect(typeof sessionManager.startSession).toBe('function');
    expect(typeof sessionManager.getScorecard).toBe('function');
  });

  it('route files exist at expected paths', async () => {
    const fs = await import('fs');
    const base = process.cwd() + '/src/app/api/sessions';

    expect(fs.existsSync(base + '/route.ts')).toBe(true);
    expect(fs.existsSync(base + '/[id]/start/route.ts')).toBe(true);
    expect(fs.existsSync(base + '/[id]/scorecard/route.ts')).toBe(true);
  });

  it('all route files import from @/lib/session-manager-instance', async () => {
    const fs = await import('fs');
    const base = process.cwd() + '/src/app/api/sessions';
    const files = [
      base + '/route.ts',
      base + '/[id]/start/route.ts',
      base + '/[id]/scorecard/route.ts',
    ];

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).toContain("from '@/lib/session-manager-instance'");
    }
  });

  it('POST /api/sessions returns 201 (not default 200) for creation', async () => {
    const res = await createSession(jsonPost('http://localhost/api/sessions', { fixtureId: 'x' }));
    expect(res.status).toBe(201);
  });
});
