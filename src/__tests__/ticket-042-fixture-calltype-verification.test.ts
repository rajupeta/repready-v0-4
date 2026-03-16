/**
 * TICKET-042: Fix 24 failing tests — fixture names + callType
 *
 * Verifies:
 * 1. All tests pass (0 failures) — validated by this suite running green
 * 2. SessionManager.createSession() stores callType
 * 3. No old fixture name references in source code
 */
import * as fs from 'fs';
import * as path from 'path';
import { SessionManager, SessionManagerDeps } from '@/services/session-manager';
import { CoachingRule, Scorecard, TranscriptLine, CallType } from '@/types';

// --- helpers ---------------------------------------------------------------

function createMockDeps(
  overrides: Partial<SessionManagerDeps> = {},
): SessionManagerDeps {
  return {
    eventBus: {
      emit: jest.fn(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
      removeAllListeners: jest.fn(),
    } as unknown as SessionManagerDeps['eventBus'],
    rulesEngine: {
      evaluate: jest.fn().mockReturnValue([]),
      resetCooldowns: jest.fn(),
    },
    coachingService: {
      processTriggeredRules: jest.fn().mockResolvedValue([]),
    },
    scorecardService: {
      generate: jest.fn().mockResolvedValue({
        entries: [],
        overallScore: 0,
        summary: '',
      } as Scorecard),
    },
    rules: [],
    createPlaybackService: jest.fn(() => ({
      loadFixture: jest.fn(),
      loadLines: jest.fn(),
      start: jest.fn(),
      stop: jest.fn(),
    })),
    createTranscriptService: jest.fn((onLineAdded) => {
      const transcript: TranscriptLine[] = [];
      return {
        addLine: (line: TranscriptLine) => {
          transcript.push(line);
          onLineAdded(line, transcript.slice(-10));
        },
        getTranscript: () => [...transcript],
      };
    }),
    ...overrides,
  };
}

// --- AC 2: SessionManager.createSession() stores callType -----------------

describe('TICKET-042: SessionManager.createSession() stores callType', () => {
  it('stores the provided callType on the created session', () => {
    const manager = new SessionManager(createMockDeps());
    const id = manager.createSession('discovery-call-001', 'objection-handling');
    const session = manager.getSession(id);

    expect(session).toBeDefined();
    expect(session!.callType).toBe('objection-handling');
  });

  it('defaults callType to "discovery" when omitted', () => {
    const manager = new SessionManager(createMockDeps());
    const id = manager.createSession('discovery-call-001');
    const session = manager.getSession(id);

    expect(session!.callType).toBe('discovery');
  });

  it('accepts all valid CallType values', () => {
    const manager = new SessionManager(createMockDeps());
    const types: CallType[] = ['discovery', 'demo', 'objection-handling', 'follow-up'];

    for (const callType of types) {
      const id = manager.createSession('discovery-call-001', callType);
      expect(manager.getSession(id)!.callType).toBe(callType);
    }
  });
});

// --- AC 3: No old fixture name references ----------------------------------

describe('TICKET-042: No old fixture name references', () => {
  const fixturesDir = path.join(process.cwd(), 'src', 'fixtures');

  it('discovery-call-001.json exists (renamed from discovery-call.json)', () => {
    expect(fs.existsSync(path.join(fixturesDir, 'discovery-call-001.json'))).toBe(true);
  });

  it('objection-handling-001.json exists (replaced demo-call.json)', () => {
    expect(fs.existsSync(path.join(fixturesDir, 'objection-handling-001.json'))).toBe(true);
  });

  it('old discovery-call.json does not exist', () => {
    expect(fs.existsSync(path.join(fixturesDir, 'discovery-call.json'))).toBe(false);
  });

  it('old demo-call.json does not exist', () => {
    expect(fs.existsSync(path.join(fixturesDir, 'demo-call.json'))).toBe(false);
  });

  it('no source files (non-test) reference discovery-call.json', () => {
    const srcDir = path.join(process.cwd(), 'src');
    const sourceFiles = findSourceFiles(srcDir);

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain("'discovery-call.json'");
      expect(content).not.toContain('"discovery-call.json"');
    }
  });

  it('no source files (non-test) reference demo-call.json', () => {
    const srcDir = path.join(process.cwd(), 'src');
    const sourceFiles = findSourceFiles(srcDir);

    for (const file of sourceFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content).not.toContain("'demo-call.json'");
      expect(content).not.toContain('"demo-call.json"');
    }
  });
});

/** Recursively find .ts/.tsx files excluding __tests__ directories */
function findSourceFiles(dir: string): string[] {
  const results: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__' && entry.name !== 'node_modules') {
        results.push(...findSourceFiles(fullPath));
      }
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      results.push(fullPath);
    }
  }
  return results;
}
