/**
 * TICKET-021: POST /api/sessions/[id]/end
 *
 * Tests acceptance criteria:
 * 1. POST /api/sessions/[id]/end route exists and responds correctly
 * 2. Ends the session via SessionManager
 * 3. Returns appropriate success/error responses
 * 4. Covered by tests (this file)
 */

import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';
import { POST as endSession } from '@/app/api/sessions/[id]/end/route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('TICKET-021 — POST /api/sessions/[id]/end', () => {
  let sessionId: string;

  beforeEach(() => {
    sessionId = sessionManager.createSession('discovery-call');
  });

  it('returns 200 { status: "ended" } for an active session', async () => {
    // Stub deps complete playback immediately, so we force active status
    const session = sessionManager.getSession(sessionId)!;
    (session as { status: string }).status = 'active';

    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams(sessionId),
    );
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json).toEqual({ status: 'ended' });
  });

  it('transitions session to completed status after ending', async () => {
    const freshId = sessionManager.createSession('test-fixture');
    const freshSession = sessionManager.getSession(freshId)!;
    (freshSession as { status: string }).status = 'active';

    await endSession(
      new NextRequest('http://localhost'),
      makeParams(freshId),
    );

    const after = sessionManager.getSession(freshId);
    expect(after!.status).toBe('completed');
  });

  it('returns 404 for non-existent session', async () => {
    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams('does-not-exist'),
    );
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json).toEqual({ error: 'Session not found' });
  });

  it('returns 400 for idle session (not active)', async () => {
    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams(sessionId),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({ error: 'Session is not active' });
  });

  it('returns 400 for already completed session', async () => {
    sessionManager.startSession(sessionId);
    // Wait for stub to complete
    await new Promise((r) => setTimeout(r, 50));

    expect(sessionManager.getSession(sessionId)!.status).toBe('completed');

    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams(sessionId),
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json).toEqual({ error: 'Session is not active' });
  });

  it('returns correct Content-Type header', async () => {
    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams('nope'),
    );
    expect(res.headers.get('content-type')).toContain('application/json');
  });
});

describe('TICKET-021 — SessionManager.endSession unit tests', () => {
  it('endSession throws for non-existent session', async () => {
    await expect(sessionManager.endSession('fake-id')).rejects.toThrow(
      'Session fake-id not found',
    );
  });

  it('endSession throws for idle session', async () => {
    const id = sessionManager.createSession('test');
    await expect(sessionManager.endSession(id)).rejects.toThrow(
      'is not active',
    );
  });

  it('endSession sets status to completed', async () => {
    const id = sessionManager.createSession('test');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    await sessionManager.endSession(id);

    expect(session.status).toBe('completed');
  });

  it('endSession generates a scorecard', async () => {
    const id = sessionManager.createSession('test');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    await sessionManager.endSession(id);

    expect(session.scorecard).toBeDefined();
    expect(session.scorecard).toHaveProperty('entries');
    expect(session.scorecard).toHaveProperty('overallScore');
    expect(session.scorecard).toHaveProperty('summary');
  });
});
