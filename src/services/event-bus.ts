import { EventEmitter } from 'events';
import { SSEEvent } from '@/types/sse';

export class EventBus {
  private emitter: EventEmitter;

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(0); // No limit on listeners
  }

  subscribe(sessionId: string, callback: (event: SSEEvent) => void): void {
    this.emitter.on(sessionId, callback);
  }

  unsubscribe(sessionId: string, callback: (event: SSEEvent) => void): void {
    this.emitter.off(sessionId, callback);
  }

  emit(sessionId: string, event: SSEEvent): void {
    this.emitter.emit(sessionId, event);
  }

  removeAllListeners(sessionId: string): void {
    this.emitter.removeAllListeners(sessionId);
  }
}
