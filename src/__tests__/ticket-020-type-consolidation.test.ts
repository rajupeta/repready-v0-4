/**
 * TICKET-020: Consolidate duplicate SSEEvent and TranscriptLine types
 *
 * Validates that there is a single canonical definition for each type
 * and that all imports resolve to the same shape.
 */
import type { SSEEvent } from '@/types';
import type { SSEEvent as SSEEventFromSSE } from '@/types/sse';
import type { TranscriptLine } from '@/types';
import type { TranscriptLine as TranscriptLineFromTranscript } from '@/types/transcript';

// Type-level assertions: both import paths resolve to the same type
const _sseCheck: SSEEvent = {} as SSEEventFromSSE;
const _sseCheck2: SSEEventFromSSE = {} as SSEEvent;
const _tlCheck: TranscriptLine = {} as TranscriptLineFromTranscript;
const _tlCheck2: TranscriptLineFromTranscript = {} as TranscriptLine;

// Suppress unused variable warnings
void _sseCheck;
void _sseCheck2;
void _tlCheck;
void _tlCheck2;

describe('TICKET-020: Type consolidation', () => {
  describe('SSEEvent has a single canonical definition', () => {
    it('uses "type" field (not "event") for the event kind', () => {
      const evt: SSEEvent = { type: 'transcript', data: { speaker: 'rep', text: 'hi' } };
      expect(evt.type).toBe('transcript');
      expect('event' in evt).toBe(false);
    });

    it('type field accepts all four event kinds', () => {
      const kinds: SSEEvent['type'][] = [
        'transcript',
        'coaching_prompt',
        'session_complete',
        'heartbeat',
      ];
      kinds.forEach((kind) => {
        const evt: SSEEvent = { type: kind, data: {} };
        expect(evt.type).toBe(kind);
      });
    });

    it('data field is Record<string, unknown>', () => {
      const evt: SSEEvent = { type: 'transcript', data: { key: 'value', nested: { a: 1 } } };
      expect(typeof evt.data).toBe('object');
    });

    it('import from @/types and @/types/sse resolve to the same type', () => {
      // If these compile, the types are identical
      const fromIndex: SSEEvent = { type: 'heartbeat', data: {} };
      const fromSSE: SSEEventFromSSE = fromIndex;
      const backToIndex: SSEEvent = fromSSE;
      expect(backToIndex).toBe(fromIndex);
    });
  });

  describe('TranscriptLine has a single canonical definition', () => {
    it('speaker is a union of "rep" | "prospect"', () => {
      const repLine: TranscriptLine = { speaker: 'rep', text: 'Hello' };
      const prospectLine: TranscriptLine = { speaker: 'prospect', text: 'Hi there' };
      expect(repLine.speaker).toBe('rep');
      expect(prospectLine.speaker).toBe('prospect');
    });

    it('timestamp is optional', () => {
      const withoutTimestamp: TranscriptLine = { speaker: 'rep', text: 'Hello' };
      const withTimestamp: TranscriptLine = { speaker: 'rep', text: 'Hello', timestamp: 1000 };
      expect(withoutTimestamp.timestamp).toBeUndefined();
      expect(withTimestamp.timestamp).toBe(1000);
    });

    it('import from @/types and @/types/transcript resolve to the same type', () => {
      // If these compile, the types are identical
      const fromIndex: TranscriptLine = { speaker: 'rep', text: 'test' };
      const fromTranscript: TranscriptLineFromTranscript = fromIndex;
      const backToIndex: TranscriptLine = fromTranscript;
      expect(backToIndex).toBe(fromIndex);
    });
  });
});
