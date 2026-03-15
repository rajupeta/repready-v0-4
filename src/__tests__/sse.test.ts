import { EventBus } from '@/services/event-bus';
import { createSSEStream } from '@/lib/sse';
import { SSEEvent } from '@/types/sse';

describe('createSSEStream', () => {
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

  it('encodes events in valid SSE format', async () => {
    const stream = createSSEStream('session-1', eventBus);
    const reader = stream.getReader();

    const event: SSEEvent = { type: 'transcript', data: { speaker: 'rep', text: 'Hello' } };
    eventBus.emit('session-1', event);

    const chunk = await readChunk(reader);
    expect(chunk).toBe(
      `event: transcript\ndata: ${JSON.stringify({ speaker: 'rep', text: 'Hello' })}\n\n`
    );

    reader.cancel();
  });

  it('sends heartbeat events every 15 seconds', async () => {
    const stream = createSSEStream('session-1', eventBus);
    const reader = stream.getReader();

    // Advance past heartbeat interval
    jest.advanceTimersByTime(15_000);

    const chunk = await readChunk(reader);
    expect(chunk).toBe('event: heartbeat\ndata: {}\n\n');

    reader.cancel();
  });

  it('closes the stream after session_complete event', async () => {
    const stream = createSSEStream('session-1', eventBus);
    const reader = stream.getReader();

    const completeEvent: SSEEvent = { type: 'session_complete', data: { summary: 'done' } };
    eventBus.emit('session-1', completeEvent);

    // Read the session_complete event
    const chunk = await readChunk(reader);
    expect(chunk).toBe(
      `event: session_complete\ndata: ${JSON.stringify({ summary: 'done' })}\n\n`
    );

    // Next read should indicate stream is done
    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it('cleans up subscription when stream is cancelled', async () => {
    const stream = createSSEStream('session-1', eventBus);
    const reader = stream.getReader();

    // Cancel the stream
    await reader.cancel();

    // Emit after cancel — should not throw
    const event: SSEEvent = { type: 'transcript', data: { text: 'after cancel' } };
    expect(() => eventBus.emit('session-1', event)).not.toThrow();
  });

  it('clears heartbeat interval after session_complete', async () => {
    const stream = createSSEStream('session-1', eventBus);
    const reader = stream.getReader();

    // Emit session_complete to close stream
    eventBus.emit('session-1', { type: 'session_complete', data: {} });

    // Read the session_complete event
    await readChunk(reader);
    // Read done
    await reader.read();

    // Advance timers — no heartbeat should be enqueued since stream is closed
    jest.advanceTimersByTime(30_000);

    // If interval wasn't cleared, we'd get an error trying to enqueue on a closed stream
    // The test passing without error confirms cleanup
  });

  it('does not receive events from other sessions', async () => {
    const stream = createSSEStream('session-1', eventBus);
    const reader = stream.getReader();

    // Emit to a different session
    eventBus.emit('session-2', { type: 'transcript', data: { text: 'wrong session' } });

    // Emit to correct session
    eventBus.emit('session-1', { type: 'transcript', data: { text: 'right session' } });

    const chunk = await readChunk(reader);
    expect(chunk).toContain('right session');
    expect(chunk).not.toContain('wrong session');

    reader.cancel();
  });
});
