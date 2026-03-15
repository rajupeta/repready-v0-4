/**
 * TICKET-003 QA Validation: SSE utility and EventBus service
 *
 * Tests validate all acceptance criteria:
 * 1. EventBus delivers events only to subscribers of the correct sessionId
 * 2. SSE encoder outputs valid SSE format (event: type\ndata: json\n\n)
 * 3. Heartbeat fires every 15 seconds
 * 4. Stream closes after session_complete event
 * 5. Cleanup removes subscriptions and clears intervals
 * 6. Tests pass
 */

import { EventBus } from '@/services/event-bus';
import { createSSEStream } from '@/lib/sse';
import { SSEEvent } from '@/types/sse';

// ─── SSEEvent Type Validation ───────────────────────────────────────────────

describe('TICKET-003: SSEEvent type', () => {
  it('supports all four event types from the spec', () => {
    const types: SSEEvent['type'][] = [
      'transcript',
      'coaching_prompt',
      'session_complete',
      'heartbeat',
    ];
    types.forEach((type) => {
      const event: SSEEvent = { type, data: {} };
      expect(event.type).toBe(type);
      expect(event.data).toEqual({});
    });
  });

  it('accepts arbitrary data payloads', () => {
    const event: SSEEvent = {
      type: 'transcript',
      data: { speaker: 'rep', text: 'Hello', lineNumber: 1, nested: { key: 'val' } },
    };
    expect(event.data).toHaveProperty('speaker', 'rep');
    expect(event.data).toHaveProperty('nested');
  });
});

// ─── EventBus Session Isolation (AC #1) ─────────────────────────────────────

describe('TICKET-003: EventBus session isolation', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  it('isolates events across many concurrent sessions', () => {
    const callbacks = Array.from({ length: 10 }, () => jest.fn());

    callbacks.forEach((cb, i) => {
      eventBus.subscribe(`session-${i}`, cb);
    });

    // Emit to session-5 only
    eventBus.emit('session-5', { type: 'transcript', data: { text: 'targeted' } });

    callbacks.forEach((cb, i) => {
      if (i === 5) {
        expect(cb).toHaveBeenCalledTimes(1);
      } else {
        expect(cb).not.toHaveBeenCalled();
      }
    });
  });

  it('delivers events in order for a single session', () => {
    const received: string[] = [];
    eventBus.subscribe('session-1', (event) => {
      received.push(event.data.text as string);
    });

    eventBus.emit('session-1', { type: 'transcript', data: { text: 'first' } });
    eventBus.emit('session-1', { type: 'transcript', data: { text: 'second' } });
    eventBus.emit('session-1', { type: 'transcript', data: { text: 'third' } });

    expect(received).toEqual(['first', 'second', 'third']);
  });

  it('handles rapid subscribe/unsubscribe cycles', () => {
    const cb = jest.fn();

    eventBus.subscribe('s1', cb);
    eventBus.unsubscribe('s1', cb);
    eventBus.subscribe('s1', cb);

    eventBus.emit('s1', { type: 'heartbeat', data: {} });

    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does not leak listeners between removeAllListeners calls', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    eventBus.subscribe('s1', cb1);
    eventBus.removeAllListeners('s1');
    eventBus.subscribe('s1', cb2);

    eventBus.emit('s1', { type: 'heartbeat', data: {} });

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it('handles empty sessionId strings without error', () => {
    const cb = jest.fn();
    eventBus.subscribe('', cb);
    eventBus.emit('', { type: 'heartbeat', data: {} });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('treats sessionIds as case-sensitive', () => {
    const lower = jest.fn();
    const upper = jest.fn();

    eventBus.subscribe('session-a', lower);
    eventBus.subscribe('Session-A', upper);

    eventBus.emit('session-a', { type: 'heartbeat', data: {} });

    expect(lower).toHaveBeenCalledTimes(1);
    expect(upper).not.toHaveBeenCalled();
  });
});

// ─── SSE Format Encoding (AC #2) ────────────────────────────────────────────

describe('TICKET-003: SSE encoding format', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    const { value } = await reader.read();
    return new TextDecoder().decode(value);
  }

  it('formats transcript events correctly', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    eventBus.emit('s1', { type: 'transcript', data: { speaker: 'prospect', text: 'Tell me more' } });

    const chunk = await readChunk(reader);
    expect(chunk).toBe(
      `event: transcript\ndata: {"speaker":"prospect","text":"Tell me more"}\n\n`
    );

    reader.cancel();
  });

  it('formats coaching_prompt events correctly', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    eventBus.emit('s1', {
      type: 'coaching_prompt',
      data: { ruleId: 'filler-words', prompt: 'Avoid using filler words' },
    });

    const chunk = await readChunk(reader);
    expect(chunk).toMatch(/^event: coaching_prompt\ndata: /);
    expect(chunk).toMatch(/\n\n$/);

    const dataLine = chunk.split('\n')[1];
    const parsed = JSON.parse(dataLine.replace('data: ', ''));
    expect(parsed.ruleId).toBe('filler-words');

    reader.cancel();
  });

  it('formats session_complete events correctly', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    eventBus.emit('s1', { type: 'session_complete', data: { totalLines: 42 } });

    const chunk = await readChunk(reader);
    expect(chunk).toBe(
      `event: session_complete\ndata: {"totalLines":42}\n\n`
    );

    // Stream should be closed
    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it('formats heartbeat events correctly', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    jest.advanceTimersByTime(15_000);

    const chunk = await readChunk(reader);
    expect(chunk).toBe('event: heartbeat\ndata: {}\n\n');

    reader.cancel();
  });

  it('correctly encodes data with special characters', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    eventBus.emit('s1', {
      type: 'transcript',
      data: { text: 'He said "hello" & goodbye\nnewline' },
    });

    const chunk = await readChunk(reader);
    // The data should be valid JSON inside the SSE line
    const dataLine = chunk.split('\n')[1];
    const parsed = JSON.parse(dataLine.replace('data: ', ''));
    expect(parsed.text).toBe('He said "hello" & goodbye\nnewline');

    reader.cancel();
  });

  it('handles empty data object', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    eventBus.emit('s1', { type: 'heartbeat', data: {} });

    const chunk = await readChunk(reader);
    expect(chunk).toBe('event: heartbeat\ndata: {}\n\n');

    reader.cancel();
  });

  it('each SSE message ends with double newline separator', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    eventBus.emit('s1', { type: 'transcript', data: { text: 'a' } });
    const chunk1 = await readChunk(reader);
    expect(chunk1.endsWith('\n\n')).toBe(true);

    eventBus.emit('s1', { type: 'coaching_prompt', data: { prompt: 'b' } });
    const chunk2 = await readChunk(reader);
    expect(chunk2.endsWith('\n\n')).toBe(true);

    reader.cancel();
  });
});

// ─── Heartbeat Interval (AC #3) ─────────────────────────────────────────────

describe('TICKET-003: Heartbeat timing', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    const { value } = await reader.read();
    return new TextDecoder().decode(value);
  }

  it('does not fire heartbeat before 15 seconds', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    // Advance 14.9 seconds — no heartbeat yet
    jest.advanceTimersByTime(14_999);

    // Emit a real event to check the stream is alive
    eventBus.emit('s1', { type: 'transcript', data: { text: 'test' } });
    const chunk = await readChunk(reader);
    expect(chunk).toContain('transcript');
    expect(chunk).not.toContain('heartbeat');

    reader.cancel();
  });

  it('fires heartbeat at exactly 15 seconds', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    jest.advanceTimersByTime(15_000);

    const chunk = await readChunk(reader);
    expect(chunk).toBe('event: heartbeat\ndata: {}\n\n');

    reader.cancel();
  });

  it('fires multiple heartbeats at correct intervals', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    // First heartbeat at 15s
    jest.advanceTimersByTime(15_000);
    const chunk1 = await readChunk(reader);
    expect(chunk1).toContain('heartbeat');

    // Second heartbeat at 30s
    jest.advanceTimersByTime(15_000);
    const chunk2 = await readChunk(reader);
    expect(chunk2).toContain('heartbeat');

    // Third heartbeat at 45s
    jest.advanceTimersByTime(15_000);
    const chunk3 = await readChunk(reader);
    expect(chunk3).toContain('heartbeat');

    reader.cancel();
  });
});

// ─── Stream Close on session_complete (AC #4) ───────────────────────────────

describe('TICKET-003: Stream close on session_complete', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    const { value } = await reader.read();
    return new TextDecoder().decode(value);
  }

  it('sends the session_complete event data before closing', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    eventBus.emit('s1', {
      type: 'session_complete',
      data: { score: 85, totalLines: 50 },
    });

    const chunk = await readChunk(reader);
    const dataLine = chunk.split('\n')[1];
    const parsed = JSON.parse(dataLine.replace('data: ', ''));
    expect(parsed.score).toBe(85);
    expect(parsed.totalLines).toBe(50);

    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it('delivers events before session_complete, then closes', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    // Send a few transcript events then session_complete
    eventBus.emit('s1', { type: 'transcript', data: { text: 'line1' } });
    const chunk1 = await readChunk(reader);
    expect(chunk1).toContain('transcript');

    eventBus.emit('s1', { type: 'transcript', data: { text: 'line2' } });
    const chunk2 = await readChunk(reader);
    expect(chunk2).toContain('transcript');

    eventBus.emit('s1', { type: 'session_complete', data: {} });
    const chunkFinal = await readChunk(reader);
    expect(chunkFinal).toContain('session_complete');

    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it('session_complete on one session does not close another', async () => {
    const stream1 = createSSEStream('s1', eventBus);
    const stream2 = createSSEStream('s2', eventBus);
    const reader1 = stream1.getReader();
    const reader2 = stream2.getReader();

    // Close session 1
    eventBus.emit('s1', { type: 'session_complete', data: {} });
    await readChunk(reader1);
    const { done: done1 } = await reader1.read();
    expect(done1).toBe(true);

    // Session 2 should still work
    eventBus.emit('s2', { type: 'transcript', data: { text: 'still alive' } });
    const chunk2 = await readChunk(reader2);
    expect(chunk2).toContain('still alive');

    reader2.cancel();
  });
});

// ─── Cleanup (AC #5) ────────────────────────────────────────────────────────

describe('TICKET-003: Cleanup behavior', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('cancel removes event subscription from EventBus', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    await reader.cancel();

    // After cancel, the EventBus callback should be removed
    // Emitting should not cause any errors
    expect(() => {
      eventBus.emit('s1', { type: 'transcript', data: { text: 'ignored' } });
    }).not.toThrow();
  });

  it('session_complete clears the heartbeat interval', async () => {
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    eventBus.emit('s1', { type: 'session_complete', data: {} });
    await reader.read(); // read session_complete
    await reader.read(); // read done signal

    expect(clearIntervalSpy).toHaveBeenCalled();

    clearIntervalSpy.mockRestore();
  });

  it('no heartbeats fire after cancel', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    await reader.cancel();

    // Advance well past heartbeat interval
    jest.advanceTimersByTime(60_000);

    // No error should occur — interval was cleared
  });

  it('no heartbeats fire after session_complete', async () => {
    const stream = createSSEStream('s1', eventBus);
    const reader = stream.getReader();

    eventBus.emit('s1', { type: 'session_complete', data: {} });
    await reader.read(); // session_complete chunk
    await reader.read(); // done

    // Advance well past heartbeat interval
    jest.advanceTimersByTime(60_000);

    // If interval was not cleared, this would throw trying to enqueue on closed stream
  });
});

// ─── EventBus Singleton (AC bonus) ─────────────────────────────────────────

describe('TICKET-003: EventBus singleton', () => {
  it('exports a singleton instance from event-bus-instance.ts', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { eventBus: instance1 } = require('@/lib/event-bus-instance');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { eventBus: instance2 } = require('@/lib/event-bus-instance');

    expect(instance1).toBe(instance2);
  });

  it('singleton is an instance of EventBus', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { eventBus: instance } = require('@/lib/event-bus-instance');
    expect(instance).toBeDefined();
    expect(typeof instance.subscribe).toBe('function');
    expect(typeof instance.unsubscribe).toBe('function');
    expect(typeof instance.emit).toBe('function');
    expect(typeof instance.removeAllListeners).toBe('function');
  });
});

// ─── Integration: EventBus + SSE Stream end-to-end ──────────────────────────

describe('TICKET-003: Integration - full event flow', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
    const { value } = await reader.read();
    return new TextDecoder().decode(value);
  }

  it('simulates a full session: transcripts, coaching, heartbeat, complete', async () => {
    const stream = createSSEStream('full-session', eventBus);
    const reader = stream.getReader();

    // 1. Transcript line
    eventBus.emit('full-session', {
      type: 'transcript',
      data: { speaker: 'rep', text: 'Hi, thanks for taking the call' },
    });
    const t1 = await readChunk(reader);
    expect(t1).toContain('event: transcript');

    // 2. Coaching prompt
    eventBus.emit('full-session', {
      type: 'coaching_prompt',
      data: { ruleId: 'open-ended-questions', prompt: 'Try asking an open-ended question' },
    });
    const c1 = await readChunk(reader);
    expect(c1).toContain('event: coaching_prompt');

    // 3. More transcript
    eventBus.emit('full-session', {
      type: 'transcript',
      data: { speaker: 'prospect', text: 'Sure, what do you have?' },
    });
    const t2 = await readChunk(reader);
    expect(t2).toContain('event: transcript');

    // 4. Heartbeat
    jest.advanceTimersByTime(15_000);
    const hb = await readChunk(reader);
    expect(hb).toContain('event: heartbeat');

    // 5. Session complete
    eventBus.emit('full-session', {
      type: 'session_complete',
      data: { totalLines: 3, score: 72 },
    });
    const sc = await readChunk(reader);
    expect(sc).toContain('event: session_complete');

    // 6. Stream is done
    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it('ReadableStream is compatible with Response constructor', () => {
    const stream = createSSEStream('compat-test', eventBus);

    // The stream should be a proper ReadableStream<Uint8Array>
    expect(stream).toBeInstanceOf(ReadableStream);

    // Verify it could be used in a Next.js route handler context
    // (ReadableStream should be accepted by Response)
    const response = new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
    expect(response.body).toBeDefined();
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');

    // Clean up
    eventBus.emit('compat-test', { type: 'session_complete', data: {} });
  });
});
