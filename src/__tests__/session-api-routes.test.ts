import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';

// We test route handlers by importing them directly and calling with mock Request objects.
// Next.js App Router route handlers are plain async functions.

import { POST as createSession } from '@/app/api/sessions/route';
import { POST as startSession } from '@/app/api/sessions/[id]/start/route';
import { GET as getScorecard } from '@/app/api/sessions/[id]/scorecard/route';

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('POST /api/sessions', () => {
  it('returns 201 with sessionId for valid fixtureId', async () => {
    const response = await createSession(makeRequest({ fixtureId: 'discovery-call-001' }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json).toHaveProperty('sessionId');
    expect(typeof json.sessionId).toBe('string');
    expect(json.sessionId.length).toBeGreaterThan(0);
  });

  it('returns 400 when fixtureId is missing', async () => {
    const response = await createSession(makeRequest({}));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: 'fixtureId or callType is required' });
  });

  it('returns 400 when fixtureId is empty string', async () => {
    const response = await createSession(makeRequest({ fixtureId: '' }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: 'fixtureId or callType is required' });
  });

  it('returns 400 when fixtureId is whitespace only', async () => {
    const response = await createSession(makeRequest({ fixtureId: '   ' }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: 'fixtureId or callType is required' });
  });

  it('returns 400 when fixtureId is not a string', async () => {
    const response = await createSession(makeRequest({ fixtureId: 123 }));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: 'fixtureId or callType is required' });
  });
});

describe('POST /api/sessions/[id]/start', () => {
  let sessionId: string;

  beforeEach(() => {
    sessionId = sessionManager.createSession('discovery-call-001');
  });

  it('returns 200 for idle session', async () => {
    const response = await startSession(
      new NextRequest('http://localhost:3000'),
      makeParams(sessionId),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ status: 'started' });
  });

  it('returns 404 for non-existent session', async () => {
    const response = await startSession(
      new NextRequest('http://localhost:3000'),
      makeParams('non-existent-id'),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({ error: 'Session not found' });
  });

  it('returns 400 for already started session', async () => {
    // Start it once
    await startSession(
      new NextRequest('http://localhost:3000'),
      makeParams(sessionId),
    );

    // Try to start again
    const response = await startSession(
      new NextRequest('http://localhost:3000'),
      makeParams(sessionId),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: 'Session already started' });
  });
});

describe('GET /api/sessions/[id]/scorecard', () => {
  it('returns 404 for non-existent session', async () => {
    const response = await getScorecard(
      new NextRequest('http://localhost:3000'),
      makeParams('non-existent-id'),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({ error: 'Session not found' });
  });

  it('returns 400 for session that is not completed', async () => {
    const sessionId = sessionManager.createSession('discovery-call-001');

    const response = await getScorecard(
      new NextRequest('http://localhost:3000'),
      makeParams(sessionId),
    );
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json).toEqual({ error: 'Session not completed' });
  });

  it('returns scorecard JSON for completed session', async () => {
    // Create and start session — the stub deps complete immediately
    const sessionId = sessionManager.createSession('discovery-call-001');
    sessionManager.startSession(sessionId);

    // Wait for async scorecard generation to complete
    await new Promise((resolve) => setTimeout(resolve, 50));

    const session = sessionManager.getSession(sessionId);
    expect(session?.status).toBe('completed');

    const response = await getScorecard(
      new NextRequest('http://localhost:3000'),
      makeParams(sessionId),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty('entries');
    expect(json).toHaveProperty('overallScore');
    expect(json).toHaveProperty('summary');
  });
});
