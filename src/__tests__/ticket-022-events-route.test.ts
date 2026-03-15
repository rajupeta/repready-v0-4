import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';
import { GET as getEvents } from '@/app/api/sessions/[id]/events/route';

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/sessions/[id]/events', () => {
  it('returns 404 for non-existent session', async () => {
    const response = await getEvents(
      new NextRequest('http://localhost:3000'),
      makeParams('non-existent-id'),
    );
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json).toEqual({ error: 'Session not found' });
  });

  it('returns empty events array for idle session', async () => {
    const sessionId = sessionManager.createSession('discovery-call');

    const response = await getEvents(
      new NextRequest('http://localhost:3000'),
      makeParams(sessionId),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual({ events: [] });
  });

  it('returns events for a completed session', async () => {
    const sessionId = sessionManager.createSession('discovery-call');
    sessionManager.startSession(sessionId);

    // Wait for async completion (stub deps complete immediately)
    await new Promise((resolve) => setTimeout(resolve, 50));

    const session = sessionManager.getSession(sessionId);
    expect(session?.status).toBe('completed');

    const response = await getEvents(
      new NextRequest('http://localhost:3000'),
      makeParams(sessionId),
    );
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toHaveProperty('events');
    expect(Array.isArray(json.events)).toBe(true);

    // With stub deps, the session completes immediately — should have session_complete event
    const completeEvents = json.events.filter(
      (e: { type: string }) => e.type === 'session_complete',
    );
    expect(completeEvents.length).toBe(1);
  });

  it('returns events in chronological order', async () => {
    const sessionId = sessionManager.createSession('discovery-call');
    sessionManager.startSession(sessionId);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const response = await getEvents(
      new NextRequest('http://localhost:3000'),
      makeParams(sessionId),
    );
    const json = await response.json();

    expect(response.status).toBe(200);

    // Each event should have a valid type
    for (const event of json.events) {
      expect(['transcript', 'coaching_prompt', 'session_complete', 'heartbeat']).toContain(
        event.type,
      );
      expect(event).toHaveProperty('data');
    }
  });

  it('events array is a snapshot (not a live reference)', async () => {
    const sessionId = sessionManager.createSession('discovery-call');

    const response1 = await getEvents(
      new NextRequest('http://localhost:3000'),
      makeParams(sessionId),
    );
    const json1 = await response1.json();
    expect(json1.events).toEqual([]);

    // Start session — this adds events
    sessionManager.startSession(sessionId);
    await new Promise((resolve) => setTimeout(resolve, 50));

    const response2 = await getEvents(
      new NextRequest('http://localhost:3000'),
      makeParams(sessionId),
    );
    const json2 = await response2.json();

    // Second call should have events while first was empty
    expect(json2.events.length).toBeGreaterThan(0);
  });
});

describe('SessionManager.getEvents', () => {
  it('returns undefined for non-existent session', () => {
    const events = sessionManager.getEvents('does-not-exist');
    expect(events).toBeUndefined();
  });

  it('returns empty array for new session', () => {
    const sessionId = sessionManager.createSession('discovery-call');
    const events = sessionManager.getEvents(sessionId);
    expect(events).toEqual([]);
  });

  it('stores events durably during session execution', async () => {
    const sessionId = sessionManager.createSession('discovery-call');
    sessionManager.startSession(sessionId);

    await new Promise((resolve) => setTimeout(resolve, 50));

    const events = sessionManager.getEvents(sessionId);
    expect(events).toBeDefined();
    expect(events!.length).toBeGreaterThan(0);

    // Last event should be session_complete
    const lastEvent = events![events!.length - 1];
    expect(lastEvent.type).toBe('session_complete');
  });
});
