/**
 * TICKET-020 QA Validation: Consolidate duplicate SSEEvent and TranscriptLine types
 *
 * Acceptance Criteria:
 * 1. Single SSEEvent definition used across the codebase
 * 2. Single TranscriptLine definition used across the codebase
 * 3. No duplicate type declarations
 * 4. All imports updated, TypeScript compiles with no errors
 */
import * as fs from 'fs';
import * as path from 'path';

// Import types from both possible paths to verify re-exports work
import type { SSEEvent } from '@/types';
import type { SSEEvent as SSEEventFromSSE } from '@/types/sse';
import type { TranscriptLine } from '@/types';
import type { TranscriptLine as TLFromTranscript } from '@/types/transcript';

const SRC_DIR = path.resolve(__dirname, '..');

/**
 * Recursively collect all .ts/.tsx files under a directory, excluding node_modules and .next
 */
function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      results.push(...collectTsFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('TICKET-020 QA: Type consolidation acceptance criteria', () => {
  describe('AC1: Single SSEEvent definition used across the codebase', () => {
    it('SSEEvent is only defined (interface/type declaration) in types/sse.ts', () => {
      const tsFiles = collectTsFiles(SRC_DIR);
      const declarationFiles: string[] = [];

      for (const file of tsFiles) {
        // Skip test files — we only care about source declarations
        if (file.includes('__tests__')) continue;
        const content = fs.readFileSync(file, 'utf-8');
        // Match actual interface/type declarations, not re-exports or imports
        if (/export\s+interface\s+SSEEvent\b/.test(content)) {
          declarationFiles.push(path.relative(SRC_DIR, file));
        }
      }

      expect(declarationFiles).toEqual(['types/sse.ts']);
    });

    it('types/index.ts re-exports SSEEvent from types/sse (no duplicate definition)', () => {
      const indexContent = fs.readFileSync(
        path.join(SRC_DIR, 'types', 'index.ts'),
        'utf-8'
      );
      // Should have a re-export, not an interface declaration
      expect(indexContent).toMatch(/export\s+type\s*\{\s*SSEEvent\s*\}\s*from\s+['"]\.\/sse['"]/);
      expect(indexContent).not.toMatch(/export\s+interface\s+SSEEvent\b/);
    });

    it('SSEEvent has the correct shape: type field (not event) and Record data', () => {
      const evt: SSEEvent = {
        type: 'transcript',
        data: { speaker: 'rep', text: 'hello' },
      };
      expect(evt.type).toBe('transcript');
      expect(evt.data).toEqual({ speaker: 'rep', text: 'hello' });

      // Verify 'event' property does NOT exist on the type at runtime
      expect(Object.keys(evt)).not.toContain('event');
    });
  });

  describe('AC2: Single TranscriptLine definition used across the codebase', () => {
    it('TranscriptLine is only defined (interface declaration) in types/index.ts', () => {
      const tsFiles = collectTsFiles(SRC_DIR);
      const declarationFiles: string[] = [];

      for (const file of tsFiles) {
        if (file.includes('__tests__')) continue;
        const content = fs.readFileSync(file, 'utf-8');
        if (/export\s+interface\s+TranscriptLine\b/.test(content)) {
          declarationFiles.push(path.relative(SRC_DIR, file));
        }
      }

      expect(declarationFiles).toEqual(['types/index.ts']);
    });

    it('types/transcript.ts re-exports TranscriptLine from types/index (no duplicate definition)', () => {
      const transcriptContent = fs.readFileSync(
        path.join(SRC_DIR, 'types', 'transcript.ts'),
        'utf-8'
      );
      expect(transcriptContent).toMatch(
        /export\s+type\s*\{\s*TranscriptLine\s*\}\s*from\s+['"]\.\/index['"]/
      );
      expect(transcriptContent).not.toMatch(/export\s+interface\s+TranscriptLine\b/);
    });

    it('TranscriptLine has correct shape with typed speaker and optional timestamp', () => {
      const line: TranscriptLine = { speaker: 'rep', text: 'Hello' };
      expect(line.speaker).toBe('rep');
      expect(line.text).toBe('Hello');
      expect(line.timestamp).toBeUndefined();

      const lineWithTs: TranscriptLine = {
        speaker: 'prospect',
        text: 'Hi',
        timestamp: 5000,
      };
      expect(lineWithTs.timestamp).toBe(5000);
    });
  });

  describe('AC3: No duplicate type declarations', () => {
    it('no file outside types/ declares SSEEvent or TranscriptLine interfaces', () => {
      const tsFiles = collectTsFiles(SRC_DIR);
      const violators: string[] = [];

      for (const file of tsFiles) {
        if (file.includes('__tests__')) continue;
        if (file.includes(path.join('types', ''))) continue; // skip types/ dir
        const content = fs.readFileSync(file, 'utf-8');
        if (
          /export\s+interface\s+SSEEvent\b/.test(content) ||
          /export\s+interface\s+TranscriptLine\b/.test(content)
        ) {
          violators.push(path.relative(SRC_DIR, file));
        }
      }

      expect(violators).toEqual([]);
    });

    it('total interface declarations of SSEEvent across entire src is exactly 1', () => {
      const tsFiles = collectTsFiles(SRC_DIR);
      let count = 0;
      for (const file of tsFiles) {
        if (file.includes('__tests__')) continue;
        const content = fs.readFileSync(file, 'utf-8');
        const matches = content.match(/export\s+interface\s+SSEEvent\b/g);
        if (matches) count += matches.length;
      }
      expect(count).toBe(1);
    });

    it('total interface declarations of TranscriptLine across entire src is exactly 1', () => {
      const tsFiles = collectTsFiles(SRC_DIR);
      let count = 0;
      for (const file of tsFiles) {
        if (file.includes('__tests__')) continue;
        const content = fs.readFileSync(file, 'utf-8');
        const matches = content.match(/export\s+interface\s+TranscriptLine\b/g);
        if (matches) count += matches.length;
      }
      expect(count).toBe(1);
    });
  });

  describe('AC4: All imports updated — types resolve identically from both paths', () => {
    it('SSEEvent from @/types and @/types/sse are interchangeable', () => {
      const a: SSEEvent = { type: 'coaching_prompt', data: { msg: 'test' } };
      const b: SSEEventFromSSE = a;
      const c: SSEEvent = b;
      expect(c).toBe(a);
    });

    it('TranscriptLine from @/types and @/types/transcript are interchangeable', () => {
      const a: TranscriptLine = { speaker: 'rep', text: 'hello' };
      const b: TLFromTranscript = a;
      const c: TranscriptLine = b;
      expect(c).toBe(a);
    });

    it('SSEEvent supports all four event types', () => {
      const events: SSEEvent[] = [
        { type: 'transcript', data: { speaker: 'rep', text: 'Hi' } },
        { type: 'coaching_prompt', data: { ruleId: 'r1', message: 'Try X' } },
        { type: 'session_complete', data: { sessionId: 's1' } },
        { type: 'heartbeat', data: {} },
      ];
      expect(events).toHaveLength(4);
      expect(events.map((e) => e.type)).toEqual([
        'transcript',
        'coaching_prompt',
        'session_complete',
        'heartbeat',
      ]);
    });

    it('service files import TranscriptLine from @/types (not directly from @/types/transcript)', () => {
      const servicesDir = path.join(SRC_DIR, 'services');
      if (!fs.existsSync(servicesDir)) return;
      const serviceFiles = fs
        .readdirSync(servicesDir)
        .filter((f) => f.endsWith('.ts'));

      for (const file of serviceFiles) {
        const content = fs.readFileSync(path.join(servicesDir, file), 'utf-8');
        // Check that TranscriptLine is NOT imported from @/types/transcript directly
        // (other types like FixtureLine may be imported from there — that's fine)
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.includes('TranscriptLine') && line.match(/^\s*import/)) {
            expect(line).not.toMatch(
              /TranscriptLine.*from\s+['"]@\/types\/transcript['"]/
            );
          }
        }
      }
    });
  });

  describe('Edge cases', () => {
    it('SSEEvent data field accepts arbitrary nested objects', () => {
      const evt: SSEEvent = {
        type: 'transcript',
        data: {
          deeply: { nested: { value: [1, 2, 3] } },
          another: 'field',
        },
      };
      expect((evt.data as Record<string, unknown>).another).toBe('field');
    });

    it('TranscriptLine with timestamp 0 is valid (falsy but legitimate)', () => {
      const line: TranscriptLine = { speaker: 'rep', text: 'Start', timestamp: 0 };
      expect(line.timestamp).toBe(0);
      expect(line.timestamp).toBeDefined();
    });

    it('FixtureLine type is preserved separately in types/transcript.ts', () => {
      // FixtureLine should still exist in transcript.ts independently
      const content = fs.readFileSync(
        path.join(SRC_DIR, 'types', 'transcript.ts'),
        'utf-8'
      );
      expect(content).toMatch(/export\s+interface\s+FixtureLine\b/);
    });
  });
});
