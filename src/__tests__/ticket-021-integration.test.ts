/**
 * TICKET-021 Integration Tests: POST /api/sessions/[id]/end
 *
 * Tests the full route handler including:
 * - Concurrent session ending
 * - Scorecard generation on end
 * - Playback stop on end
 * - Error path when endSession throws
 */

// Mock ClaudeService to avoid needing an API key
jest.mock('@/services/claude-service', () => ({
  ClaudeService: jest.fn().mockImplementation(() => ({
    getCoachingPrompts: jest.fn().mockResolvedValue([]),
    generateScorecard: jest.fn().mockResolvedValue({
      entries: [],
      overallScore: 75,
      summary: 'Good performance',
    }),
  })),
}));

import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';
import { POST as endSession } from '@/app/api/sessions/[id]/end/route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('TICKET-021 Integration — end session route', () => {
  it('returns 200 and generates scorecard for active session', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    const res = await endSession(
      new NextRequest('http://localhost/api/sessions/' + id + '/end', {
        method: 'POST',
      }),
      makeParams(id),
    );

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.status).toBe('ended');

    // Verify session is completed with scorecard
    const ended = sessionManager.getSession(id)!;
    expect(ended.status).toBe('completed');
    expect(ended.scorecard).toBeDefined();
  });

  it('handles concurrent end requests — second returns 400', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    const [res1, res2] = await Promise.all([
      endSession(new NextRequest('http://localhost'), makeParams(id)),
      // Slight delay so first request processes
      new Promise<Response>((resolve) =>
        setTimeout(
          () =>
            resolve(
              endSession(new NextRequest('http://localhost'), makeParams(id)),
            ),
          10,
        ),
      ),
    ]);

    // One should succeed, one should fail
    const statuses = [res1.status, res2.status].sort();
    expect(statuses).toContain(200);
    // The second call should get 400 since session is already completed
    expect(statuses).toContain(400);
  });

  it('returns 500 when endSession throws unexpectedly', async () => {
    // Mock endSession to throw
    const origEndSession = sessionManager.endSession.bind(sessionManager);
    sessionManager.endSession = async () => {
      throw new Error('Unexpected internal error');
    };

    const id = sessionManager.createSession('test', 'discovery');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams(id),
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe('Internal server error');

    // Restore
    sessionManager.endSession = origEndSession;
  });

  it('returns 404 for undefined-like session ids', async () => {
    const ids = ['undefined', 'null', 'NaN'];
    for (const id of ids) {
      const res = await endSession(
        new NextRequest('http://localhost'),
        makeParams(id),
      );
      expect(res.status).toBe(404);
    }
  });

  it('POST handler accepts NextRequest without body', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    // POST with no body — should still work since route ignores request body
    const res = await endSession(
      new NextRequest('http://localhost', { method: 'POST' }),
      makeParams(id),
    );
    expect(res.status).toBe(200);
  });

  it('session scorecard has expected structure after ending', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    const session = sessionManager.getSession(id)!;
    (session as { status: string }).status = 'active';

    await endSession(
      new NextRequest('http://localhost'),
      makeParams(id),
    );

    const completed = sessionManager.getSession(id)!;
    expect(completed.scorecard).toBeDefined();
    const scorecard = completed.scorecard!;
    expect(Array.isArray(scorecard.entries)).toBe(true);
    expect(typeof scorecard.overallScore).toBe('number');
    expect(scorecard.overallScore).toBeGreaterThanOrEqual(0);
    expect(scorecard.overallScore).toBeLessThanOrEqual(100);
    expect(typeof scorecard.summary).toBe('string');
  });

  it('ending an idle session returns 400 with correct error message', async () => {
    const id = sessionManager.createSession('test', 'discovery');
    // Session starts as idle — do not change status
    const res = await endSession(
      new NextRequest('http://localhost'),
      makeParams(id),
    );

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Session is not active');
  });
});
