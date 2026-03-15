import { EventBus } from '@/services/event-bus';
import { SSEEvent } from '@/types/sse';

describe('EventBus', () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  it('delivers events to subscribers of the correct sessionId', () => {
    const callback = jest.fn();
    const event: SSEEvent = { type: 'transcript', data: { text: 'hello' } };

    eventBus.subscribe('session-1', callback);
    eventBus.emit('session-1', event);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(event);
  });

  it('does NOT deliver events to subscribers of a different sessionId', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const event: SSEEvent = { type: 'transcript', data: { text: 'hello' } };

    eventBus.subscribe('session-1', callback1);
    eventBus.subscribe('session-2', callback2);
    eventBus.emit('session-1', event);

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).not.toHaveBeenCalled();
  });

  it('supports multiple subscribers for the same sessionId', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const event: SSEEvent = { type: 'coaching_prompt', data: { rule: 'filler-words' } };

    eventBus.subscribe('session-1', callback1);
    eventBus.subscribe('session-1', callback2);
    eventBus.emit('session-1', event);

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('unsubscribe removes only the specified callback', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const event: SSEEvent = { type: 'transcript', data: { text: 'test' } };

    eventBus.subscribe('session-1', callback1);
    eventBus.subscribe('session-1', callback2);
    eventBus.unsubscribe('session-1', callback1);
    eventBus.emit('session-1', event);

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('removeAllListeners removes all callbacks for a sessionId', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const event: SSEEvent = { type: 'transcript', data: { text: 'test' } };

    eventBus.subscribe('session-1', callback1);
    eventBus.subscribe('session-1', callback2);
    eventBus.removeAllListeners('session-1');
    eventBus.emit('session-1', event);

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).not.toHaveBeenCalled();
  });

  it('removeAllListeners for one session does not affect other sessions', () => {
    const callback1 = jest.fn();
    const callback2 = jest.fn();
    const event: SSEEvent = { type: 'transcript', data: { text: 'test' } };

    eventBus.subscribe('session-1', callback1);
    eventBus.subscribe('session-2', callback2);
    eventBus.removeAllListeners('session-1');
    eventBus.emit('session-2', event);

    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('handles emitting to a sessionId with no subscribers', () => {
    const event: SSEEvent = { type: 'heartbeat', data: {} };
    // Should not throw
    expect(() => eventBus.emit('no-listeners', event)).not.toThrow();
  });
});
