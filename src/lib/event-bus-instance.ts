import { EventBus } from '@/services/event-bus';

const globalForEventBus = globalThis as unknown as { eventBus?: EventBus };

export const eventBus = globalForEventBus.eventBus ?? new EventBus();

// Preserve singleton across hot reloads in development
if (process.env.NODE_ENV !== 'production') {
  globalForEventBus.eventBus = eventBus;
}
