/**
 * TICKET-021 QA Validation: POST /api/sessions/[id]/end
 *
 * Acceptance Criteria:
 * 1. POST /api/sessions/[id]/end route exists and responds correctly
 * 2. Ends the session via SessionManager
 * 3. Returns appropriate success/error responses
 * 4. Covered by tests
 *
 * This file adds edge-case and integration coverage beyond the base tests.
 */

import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';
import { POST as endSession } from '@/app/api/sessions/[id]/end/route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('TICKET-021 QA — Route response shape', () => {
  it('success response contains only { status: "ended" } with no extra fields', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams(id),
    );
    const json = await res.json();

    expect(Object.keys(json)).toEqual(['status']);
    expect(json.status).toBe('ended');
  });

  it('404 response contains only { error: "Session not found" }', async () => {
    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams('nonexistent-id-12345'),
    );
    const json = await res.json();

    expect(Object.keys(json)).toEqual(['error']);
    expect(json.error).toBe('Session not found');
  });

  it('400 response contains only { error: "Session is not active" }', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    // Session starts as 'idle', not 'active'
    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams(id),
    );
    const json = await res.json();

    expect(Object.keys(json)).toEqual(['error']);
    expect(json.error).toBe('Session is not active');
  });

  it('all responses have application/json content-type', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    const successRes = await endSession(
      new NextRequest('http://localhost'),
      makeParams(id),
    );
    expect(successRes.headers.get('content-type')).toContain(
      'application/json',
    );

    const notFoundRes = await endSession(
      new NextRequest('http://localhost'),
      makeParams('no-such-id'),
    );
    expect(notFoundRes.headers.get('content-type')).toContain(
      'application/json',
    );
  });
});

describe('TICKET-021 QA — Edge cases', () => {
  it('ending same session twice returns 400 on second call', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    const first = await endSession(
      new NextRequest('http://localhost'),
      makeParams(id),
    );
    expect(first.status).toBe(200);

    const second = await endSession(
      new NextRequest('http://localhost'),
      makeParams(id),
    );
    expect(second.status).toBe(400);
    const json = await second.json();
    expect(json.error).toBe('Session is not active');
  });

  it('handles empty string session id gracefully', async () => {
    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams(''),
    );
    expect(res.status).toBe(404);
  });

  it('handles special characters in session id', async () => {
    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams('../../etc/passwd'),
    );
    expect(res.status).toBe(404);
  });

  it('handles very long session id', async () => {
    const longId = 'a'.repeat(1000);
    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams(longId),
    );
    expect(res.status).toBe(404);
  });
});

describe('TICKET-021 QA — Session state after ending', () => {
  it('session status transitions from active to completed', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    expect(session.status).toBe('active');

    await endSession(
      new NextRequest('http://localhost'),
      makeParams(id),
    );

    expect(session.status).toBe('completed');
  });

  it('session scorecard is populated after ending', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    await endSession(
      new NextRequest('http://localhost'),
      makeParams(id),
    );

    expect(session.scorecard).toBeDefined();
    expect(session.scorecard).toHaveProperty('entries');
    expect(session.scorecard).toHaveProperty('overallScore');
    expect(session.scorecard).toHaveProperty('summary');
  });

  it('session remains retrievable via getSession after ending', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    await endSession(
      new NextRequest('http://localhost'),
      makeParams(id),
    );

    const retrieved = sessionManager.getSession(id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.status).toBe('completed');
  });
});

describe('TICKET-021 QA — Multiple sessions isolation', () => {
  it('ending one session does not affect another active session', async () => {
    const id1 = sessionManager.createSession('test', 'discovery');
    const id2 = sessionManager.createSession('test', 'discovery');
    const session1 = sessionManager.getSession(id1)!;
    const session2 = sessionManager.getSession(id2)!;
    (session1 as { status: string }).status = 'active';
    (session2 as { status: string }).status = 'active';

    await endSession(
      new NextRequest('http://localhost'),
      makeParams(id1),
    );

    expect(session1.status).toBe('completed');
    expect(session2.status).toBe('active');
  });
});

describe('TICKET-021 QA — HTTP method validation', () => {
  it('route handler is exported as POST', async () => {
    // Verify the POST function is properly exported and callable
    expect(typeof endSession).toBe('function');
  });
});
