/**
 * TICKET-020 QA: Import consistency & runtime verification
 *
 * Ensures all service files use canonical import paths and that
 * the consolidated types work correctly at runtime across the codebase.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

import type { SSEEvent } from '@/types';
import type { SSEEvent as SSEEventFromSSE } from '@/types/sse';
import type { TranscriptLine } from '@/types';
import type { TranscriptLine as TLFromTranscript } from '@/types/transcript';

const SRC_DIR = path.resolve(__dirname, '..');

function readSourceFiles(dir: string): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.next', '__tests__'].includes(entry.name)) continue;
      results.push(...readSourceFiles(fullPath));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      results.push({ path: fullPath, content: fs.readFileSync(fullPath, 'utf-8') });
    }
  }
  return results;
}

describe('TICKET-020 QA: Import consistency across codebase', () => {
  const sourceFiles = readSourceFiles(SRC_DIR);

  describe('No duplicate interface declarations remain', () => {
    it('SSEEvent interface is declared exactly once in the entire src/', () => {
      let count = 0;
      for (const file of sourceFiles) {
        const matches = file.content.match(/export\s+interface\s+SSEEvent\b/g);
        if (matches) count += matches.length;
      }
      expect(count).toBe(1);
    });

    it('TranscriptLine interface is declared exactly once in the entire src/', () => {
      let count = 0;
      for (const file of sourceFiles) {
        const matches = file.content.match(/export\s+interface\s+TranscriptLine\b/g);
        if (matches) count += matches.length;
      }
      expect(count).toBe(1);
    });
  });

  describe('Re-exports are set up correctly', () => {
    it('types/index.ts re-exports SSEEvent from ./sse', () => {
      const indexFile = sourceFiles.find((f) => f.path.endsWith('types/index.ts'));
      expect(indexFile).toBeDefined();
      expect(indexFile!.content).toMatch(/export\s+type\s*\{.*SSEEvent.*\}\s*from\s+['"]\.\/sse['"]/);
    });

    it('types/transcript.ts re-exports TranscriptLine from ./index', () => {
      const transcriptFile = sourceFiles.find((f) => f.path.endsWith('types/transcript.ts'));
      expect(transcriptFile).toBeDefined();
      expect(transcriptFile!.content).toMatch(
        /export\s+type\s*\{.*TranscriptLine.*\}\s*from\s+['"]\.\/index['"]/
      );
    });

    it('types/index.ts does NOT have its own SSEEvent interface', () => {
      const indexFile = sourceFiles.find((f) => f.path.endsWith('types/index.ts'));
      expect(indexFile).toBeDefined();
      expect(indexFile!.content).not.toMatch(/export\s+interface\s+SSEEvent\b/);
    });

    it('types/transcript.ts does NOT have its own TranscriptLine interface', () => {
      const transcriptFile = sourceFiles.find((f) => f.path.endsWith('types/transcript.ts'));
      expect(transcriptFile).toBeDefined();
      expect(transcriptFile!.content).not.toMatch(/export\s+interface\s+TranscriptLine\b/);
    });
  });

  describe('Runtime type compatibility', () => {
    it('SSEEvent from both paths creates identical objects', () => {
      const fromIndex: SSEEvent = { type: 'transcript', data: { speaker: 'rep', text: 'hi' } };
      const fromSSE: SSEEventFromSSE = { type: 'transcript', data: { speaker: 'rep', text: 'hi' } };
      expect(fromIndex).toEqual(fromSSE);
    });

    it('TranscriptLine from both paths creates identical objects', () => {
      const fromIndex: TranscriptLine = { speaker: 'rep', text: 'hello', timestamp: 100 };
      const fromTranscript: TLFromTranscript = { speaker: 'rep', text: 'hello', timestamp: 100 };
      expect(fromIndex).toEqual(fromTranscript);
    });

    it('SSEEvent objects are assignable across import paths', () => {
      const a: SSEEvent = { type: 'heartbeat', data: {} };
      const b: SSEEventFromSSE = a;
      expect(b).toBe(a);
    });

    it('TranscriptLine objects are assignable across import paths', () => {
      const a: TranscriptLine = { speaker: 'prospect', text: 'tell me more' };
      const b: TLFromTranscript = a;
      expect(b).toBe(a);
    });
  });

  describe('All service imports use canonical paths', () => {
    it('no service file imports SSEEvent from a non-canonical path', () => {
      const serviceFiles = sourceFiles.filter((f) => f.path.includes('/services/'));
      for (const file of serviceFiles) {
        const lines = file.content.split('\n');
        for (const line of lines) {
          if (line.includes('SSEEvent') && /^\s*import/.test(line)) {
            // Should import from @/types or @/types/sse, not some local re-declaration
            expect(line).toMatch(/from\s+['"]@\/types(\/sse)?['"]/);
          }
        }
      }
    });

    it('no service file imports TranscriptLine from @/types/transcript', () => {
      const serviceFiles = sourceFiles.filter((f) => f.path.includes('/services/'));
      for (const file of serviceFiles) {
        const lines = file.content.split('\n');
        for (const line of lines) {
          if (line.includes('TranscriptLine') && /^\s*import/.test(line)) {
            expect(line).not.toMatch(/from\s+['"]@\/types\/transcript['"]/);
          }
        }
      }
    });
  });

  describe('FixtureLine remains independent', () => {
    it('FixtureLine is still declared in types/transcript.ts', () => {
      const transcriptFile = sourceFiles.find((f) => f.path.endsWith('types/transcript.ts'));
      expect(transcriptFile).toBeDefined();
      expect(transcriptFile!.content).toMatch(/export\s+interface\s+FixtureLine\b/);
    });

    it('FixtureLine has speaker and text fields', () => {
      const transcriptFile = sourceFiles.find((f) => f.path.endsWith('types/transcript.ts'));
      expect(transcriptFile).toBeDefined();
      expect(transcriptFile!.content).toContain('speaker');
      expect(transcriptFile!.content).toContain('text');
    });
  });

  describe('TypeScript compilation', () => {
    it('tsc --noEmit succeeds (no type errors)', () => {
      const result = execSync('npx tsc --noEmit 2>&1', {
        cwd: path.resolve(__dirname, '../..'),
        encoding: 'utf-8',
        timeout: 30000,
      });
      // tsc --noEmit produces no output on success
      expect(result.trim()).toBe('');
    });
  });
});
