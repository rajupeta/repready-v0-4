import { EventBus } from '@/services/event-bus';
import { SSEEvent } from '@/types/sse';

const HEARTBEAT_INTERVAL_MS = 15_000;

export function createSSEStream(
  sessionId: string,
  eventBus: EventBus,
  missedEvents?: SSEEvent[],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let cleanupFn: (() => void) | null = null;

  return new ReadableStream<Uint8Array>({
    start(controller) {
      // Replay any events emitted before client connected
      if (missedEvents && missedEvents.length > 0) {
        for (const event of missedEvents) {
          const formatted = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
          try {
            controller.enqueue(encoder.encode(formatted));
          } catch {
            return;
          }
        }
      }

      const onEvent = (event: SSEEvent) => {
        const formatted = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(formatted));
        } catch {
          // Stream already closed — clean up silently
          cleanup();
        }

        if (event.type === 'session_complete') {
          cleanup();
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      };

      const heartbeatInterval = setInterval(() => {
        const heartbeat: SSEEvent = { type: 'heartbeat', data: {} };
        const formatted = `event: ${heartbeat.type}\ndata: ${JSON.stringify(heartbeat.data)}\n\n`;
        try {
          controller.enqueue(encoder.encode(formatted));
        } catch {
          cleanup();
        }
      }, HEARTBEAT_INTERVAL_MS);

      function cleanup() {
        clearInterval(heartbeatInterval);
        eventBus.unsubscribe(sessionId, onEvent);
      }

      cleanupFn = cleanup;
      eventBus.subscribe(sessionId, onEvent);
    },

    cancel() {
      if (cleanupFn) {
        cleanupFn();
      }
    },
  });
}
