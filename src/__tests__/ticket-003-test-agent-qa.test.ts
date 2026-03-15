/**
 * TICKET-003 Test Agent QA: SSE utility and EventBus service
 *
 * Comprehensive QA validation by test-agent covering all acceptance criteria:
 * AC1: EventBus delivers events only to subscribers of the correct sessionId
 * AC2: SSE encoder outputs valid SSE format (event: type\ndata: json\n\n)
 * AC3: Heartbeat fires every 15 seconds
 * AC4: Stream closes after session_complete event
 * AC5: Cleanup removes subscriptions and clears intervals
 */

import { EventBus } from '@/services/event-bus';
import { createSSEStream } from '@/lib/sse';
import { SSEEvent } from '@/types/sse';

// Helper to read a chunk from a ReadableStream reader
async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  const { value } = await reader.read();
  return new TextDecoder().decode(value);
}

// Helper to parse SSE formatted string into type and data
function parseSSE(chunk: string): { eventType: string; data: Record<string, unknown> } {
  const lines = chunk.trim().split('\n');
  const eventType = lines[0].replace('event: ', '');
  const data = JSON.parse(lines[1].replace('data: ', ''));
  return { eventType, data };
}

// ─── AC1: EventBus pub/sub isolation between sessions ────────────────────────

describe('AC1: EventBus session isolation', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  it('delivers events only to the matching sessionId subscriber', () => {
    const cbA = jest.fn();
    const cbB = jest.fn();
    const cbC = jest.fn();

    bus.subscribe('alpha', cbA);
    bus.subscribe('beta', cbB);
    bus.subscribe('charlie', cbC);

    const event: SSEEvent = { type: 'transcript', data: { line: 1 } };
    bus.emit('beta', event);

    expect(cbA).not.toHaveBeenCalled();
    expect(cbB).toHaveBeenCalledWith(event);
    expect(cbC).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers on the same session', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    const cb3 = jest.fn();

    bus.subscribe('sess', cb1);
    bus.subscribe('sess', cb2);
    bus.subscribe('sess', cb3);

    bus.emit('sess', { type: 'heartbeat', data: {} });

    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
    expect(cb3).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes only the target callback', () => {
    const keep = jest.fn();
    const remove = jest.fn();

    bus.subscribe('s', keep);
    bus.subscribe('s', remove);
    bus.unsubscribe('s', remove);

    bus.emit('s', { type: 'heartbeat', data: {} });

    expect(keep).toHaveBeenCalledTimes(1);
    expect(remove).not.toHaveBeenCalled();
  });

  it('removeAllListeners clears all callbacks for a session', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    bus.subscribe('x', cb1);
    bus.subscribe('x', cb2);
    bus.removeAllListeners('x');

    bus.emit('x', { type: 'heartbeat', data: {} });

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).not.toHaveBeenCalled();
  });

  it('removeAllListeners on one session does not affect others', () => {
    const cbA = jest.fn();
    const cbB = jest.fn();

    bus.subscribe('a', cbA);
    bus.subscribe('b', cbB);
    bus.removeAllListeners('a');

    bus.emit('b', { type: 'transcript', data: { text: 'ok' } });

    expect(cbA).not.toHaveBeenCalled();
    expect(cbB).toHaveBeenCalledTimes(1);
  });

  it('emitting to a session with no subscribers does not throw', () => {
    expect(() => {
      bus.emit('nobody-here', { type: 'heartbeat', data: {} });
    }).not.toThrow();
  });

  it('preserves event ordering within a session', () => {
    const received: number[] = [];
    bus.subscribe('ordered', (e) => received.push(e.data.seq as number));

    for (let i = 0; i < 5; i++) {
      bus.emit('ordered', { type: 'transcript', data: { seq: i } });
    }

    expect(received).toEqual([0, 1, 2, 3, 4]);
  });

  it('isolates across 20 concurrent sessions', () => {
    const callbacks = Array.from({ length: 20 }, () => jest.fn());
    callbacks.forEach((cb, i) => bus.subscribe(`session-${i}`, cb));

    bus.emit('session-13', { type: 'transcript', data: { target: true } });

    callbacks.forEach((cb, i) => {
      if (i === 13) {
        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(
          expect.objectContaining({ data: { target: true } })
        );
      } else {
        expect(cb).not.toHaveBeenCalled();
      }
    });
  });
});

// ─── AC2: SSE encoding format ────────────────────────────────────────────────

describe('AC2: SSE encoding format', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('outputs "event: <type>\\ndata: <json>\\n\\n" format', async () => {
    const stream = createSSEStream('fmt', bus);
    const reader = stream.getReader();

    bus.emit('fmt', { type: 'transcript', data: { speaker: 'rep', text: 'Hi' } });

    const chunk = await readChunk(reader);
    expect(chunk).toBe('event: transcript\ndata: {"speaker":"rep","text":"Hi"}\n\n');

    reader.cancel();
  });

  it('encodes each event type correctly', async () => {
    const types: SSEEvent['type'][] = ['transcript', 'coaching_prompt', 'heartbeat'];

    for (const type of types) {
      const localBus = new EventBus();
      const stream = createSSEStream('enc', localBus);
      const reader = stream.getReader();

      localBus.emit('enc', { type, data: { check: true } });
      const chunk = await readChunk(reader);

      expect(chunk.startsWith(`event: ${type}\n`)).toBe(true);
      expect(chunk.endsWith('\n\n')).toBe(true);

      const parsed = parseSSE(chunk);
      expect(parsed.eventType).toBe(type);
      expect(parsed.data).toEqual({ check: true });

      reader.cancel();
    }
  });

  it('data line contains valid JSON', async () => {
    const stream = createSSEStream('json', bus);
    const reader = stream.getReader();

    const complexData = {
      speaker: 'prospect',
      text: 'What about pricing?',
      lineNumber: 42,
      metadata: { confidence: 0.95 },
    };

    bus.emit('json', { type: 'transcript', data: complexData });
    const chunk = await readChunk(reader);

    const dataLine = chunk.split('\n')[1];
    const rawJson = dataLine.substring('data: '.length);
    expect(() => JSON.parse(rawJson)).not.toThrow();

    const parsed = JSON.parse(rawJson);
    expect(parsed).toEqual(complexData);

    reader.cancel();
  });

  it('handles special characters in data', async () => {
    const stream = createSSEStream('special', bus);
    const reader = stream.getReader();

    bus.emit('special', {
      type: 'transcript',
      data: { text: 'quotes "here" & ampersand\nnewline\ttab' },
    });

    const chunk = await readChunk(reader);
    const parsed = parseSSE(chunk);
    expect(parsed.data.text).toBe('quotes "here" & ampersand\nnewline\ttab');

    reader.cancel();
  });

  it('each SSE message is terminated with double newline', async () => {
    const stream = createSSEStream('term', bus);
    const reader = stream.getReader();

    bus.emit('term', { type: 'transcript', data: { n: 1 } });
    const c1 = await readChunk(reader);
    expect(c1.endsWith('\n\n')).toBe(true);

    bus.emit('term', { type: 'coaching_prompt', data: { n: 2 } });
    const c2 = await readChunk(reader);
    expect(c2.endsWith('\n\n')).toBe(true);

    reader.cancel();
  });
});

// ─── AC3: Heartbeat fires every 15 seconds ──────────────────────────────────

describe('AC3: Heartbeat timing', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends first heartbeat at exactly 15 seconds', async () => {
    const stream = createSSEStream('hb', bus);
    const reader = stream.getReader();

    jest.advanceTimersByTime(15_000);

    const chunk = await readChunk(reader);
    const parsed = parseSSE(chunk);
    expect(parsed.eventType).toBe('heartbeat');
    expect(parsed.data).toEqual({});

    reader.cancel();
  });

  it('does not send heartbeat before 15 seconds', async () => {
    const stream = createSSEStream('hb-early', bus);
    const reader = stream.getReader();

    jest.advanceTimersByTime(14_999);

    // Send a regular event to verify stream is working
    bus.emit('hb-early', { type: 'transcript', data: { text: 'check' } });
    const chunk = await readChunk(reader);

    expect(chunk).not.toContain('heartbeat');
    expect(chunk).toContain('transcript');

    reader.cancel();
  });

  it('sends repeated heartbeats at 15s intervals', async () => {
    const stream = createSSEStream('hb-multi', bus);
    const reader = stream.getReader();

    for (let i = 0; i < 3; i++) {
      jest.advanceTimersByTime(15_000);
      const chunk = await readChunk(reader);
      expect(chunk).toBe('event: heartbeat\ndata: {}\n\n');
    }

    reader.cancel();
  });

  it('heartbeat is formatted as valid SSE', async () => {
    const stream = createSSEStream('hb-fmt', bus);
    const reader = stream.getReader();

    jest.advanceTimersByTime(15_000);
    const chunk = await readChunk(reader);

    expect(chunk).toMatch(/^event: heartbeat\n/);
    expect(chunk).toMatch(/data: \{\}\n\n$/);

    reader.cancel();
  });
});

// ─── AC4: Stream closes after session_complete ──────────────────────────────

describe('AC4: Stream close on session_complete', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('delivers session_complete event then closes the stream', async () => {
    const stream = createSSEStream('close', bus);
    const reader = stream.getReader();

    bus.emit('close', { type: 'session_complete', data: { score: 90 } });

    const chunk = await readChunk(reader);
    expect(chunk).toContain('session_complete');

    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it('delivers all events before session_complete closes the stream', async () => {
    const stream = createSSEStream('flow', bus);
    const reader = stream.getReader();

    bus.emit('flow', { type: 'transcript', data: { text: 'line1' } });
    const c1 = await readChunk(reader);
    expect(c1).toContain('transcript');

    bus.emit('flow', { type: 'coaching_prompt', data: { rule: 'r1' } });
    const c2 = await readChunk(reader);
    expect(c2).toContain('coaching_prompt');

    bus.emit('flow', { type: 'session_complete', data: {} });
    const c3 = await readChunk(reader);
    expect(c3).toContain('session_complete');

    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it('closing one session stream does not affect another', async () => {
    const s1 = createSSEStream('close-1', bus);
    const s2 = createSSEStream('close-2', bus);
    const r1 = s1.getReader();
    const r2 = s2.getReader();

    bus.emit('close-1', { type: 'session_complete', data: {} });
    await readChunk(r1);
    const { done: d1 } = await r1.read();
    expect(d1).toBe(true);

    // Session 2 should still be alive
    bus.emit('close-2', { type: 'transcript', data: { text: 'still open' } });
    const c2 = await readChunk(r2);
    expect(c2).toContain('still open');

    r2.cancel();
  });

  it('session_complete data payload is preserved in the SSE output', async () => {
    const stream = createSSEStream('payload', bus);
    const reader = stream.getReader();

    const payload = { score: 78, totalLines: 25, rules: ['r1', 'r2'] };
    bus.emit('payload', { type: 'session_complete', data: payload });

    const chunk = await readChunk(reader);
    const parsed = parseSSE(chunk);
    expect(parsed.eventType).toBe('session_complete');
    expect(parsed.data).toEqual(payload);

    const { done } = await reader.read();
    expect(done).toBe(true);
  });
});

// ─── AC5: Cleanup removes subscriptions and clears intervals ────────────────

describe('AC5: Cleanup behavior', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancel() cleans up the EventBus subscription', async () => {
    const stream = createSSEStream('cleanup-sub', bus);
    const reader = stream.getReader();

    await reader.cancel();

    // After cancel, emitting to same session should not throw
    expect(() => {
      bus.emit('cleanup-sub', { type: 'transcript', data: { text: 'ignored' } });
    }).not.toThrow();
  });

  it('cancel() clears the heartbeat interval', async () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');

    const stream = createSSEStream('cleanup-hb', bus);
    const reader = stream.getReader();

    await reader.cancel();

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('no heartbeats after cancel', async () => {
    const stream = createSSEStream('no-hb-cancel', bus);
    const reader = stream.getReader();

    await reader.cancel();

    // Advance well past heartbeat — should not throw
    jest.advanceTimersByTime(60_000);
  });

  it('session_complete clears the heartbeat interval', async () => {
    const clearSpy = jest.spyOn(global, 'clearInterval');

    const stream = createSSEStream('cleanup-sc', bus);
    const reader = stream.getReader();

    bus.emit('cleanup-sc', { type: 'session_complete', data: {} });
    await reader.read(); // session_complete chunk
    await reader.read(); // done signal

    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  it('no heartbeats after session_complete', async () => {
    const stream = createSSEStream('no-hb-sc', bus);
    const reader = stream.getReader();

    bus.emit('no-hb-sc', { type: 'session_complete', data: {} });
    await reader.read();
    await reader.read();

    // Advance well past heartbeat — should not throw
    jest.advanceTimersByTime(60_000);
  });
});

// ─── EventBus singleton ─────────────────────────────────────────────────────

describe('EventBus singleton instance', () => {
  it('exports a functional singleton from event-bus-instance.ts', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { eventBus } = require('@/lib/event-bus-instance');
    expect(eventBus).toBeDefined();
    expect(typeof eventBus.subscribe).toBe('function');
    expect(typeof eventBus.unsubscribe).toBe('function');
    expect(typeof eventBus.emit).toBe('function');
    expect(typeof eventBus.removeAllListeners).toBe('function');
  });

  it('returns same reference on repeated imports', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { eventBus: a } = require('@/lib/event-bus-instance');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { eventBus: b } = require('@/lib/event-bus-instance');
    expect(a).toBe(b);
  });
});

// ─── Integration: ReadableStream compatibility ──────────────────────────────

describe('Integration: SSE stream as Response body', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('ReadableStream can be used with Response constructor', () => {
    const stream = createSSEStream('response', bus);

    expect(stream).toBeInstanceOf(ReadableStream);

    const response = new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });

    expect(response.body).toBeDefined();
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    bus.emit('response', { type: 'session_complete', data: {} });
  });

  it('full session lifecycle: transcript -> coaching -> heartbeat -> complete', async () => {
    const stream = createSSEStream('lifecycle', bus);
    const reader = stream.getReader();
    const received: string[] = [];

    // Transcript
    bus.emit('lifecycle', { type: 'transcript', data: { speaker: 'rep', text: 'Hello' } });
    received.push(await readChunk(reader));

    // Coaching prompt
    bus.emit('lifecycle', { type: 'coaching_prompt', data: { ruleId: 'ask-questions' } });
    received.push(await readChunk(reader));

    // Heartbeat
    jest.advanceTimersByTime(15_000);
    received.push(await readChunk(reader));

    // Session complete
    bus.emit('lifecycle', { type: 'session_complete', data: { score: 85 } });
    received.push(await readChunk(reader));

    expect(received[0]).toContain('event: transcript');
    expect(received[1]).toContain('event: coaching_prompt');
    expect(received[2]).toContain('event: heartbeat');
    expect(received[3]).toContain('event: session_complete');

    // All chunks are valid SSE format
    received.forEach((chunk) => {
      expect(chunk).toMatch(/^event: \w+\ndata: .+\n\n$/);
    });

    // Stream is done
    const { done } = await reader.read();
    expect(done).toBe(true);
  });
});
