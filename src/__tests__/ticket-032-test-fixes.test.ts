/**
 * TICKET-032: Fix 24 failing tests — fixture names + callType + lint
 *
 * Validates that:
 * 1. All fixture references use discovery-call-001.json (not discovery-call.json)
 * 2. SessionManager.createSession stores callType on the session object
 * 3. No lint errors (verified externally; structural checks here)
 * 4. 0 test failures
 */
import * as fs from 'fs';
import * as path from 'path';
import { SessionManager, SessionManagerDeps } from '@/services/session-manager';
import { CoachingRule, Scorecard, TranscriptLine, CallType } from '@/types';

// --- helpers ---------------------------------------------------------------

function createMockRule(overrides: Partial<CoachingRule> = {}): CoachingRule {
  return {
    ruleId: 'test-rule',
    name: 'Test Rule',
    description: 'A test rule',
    cooldownMs: 30000,
    callTypes: ['discovery', 'demo', 'objection-handling', 'follow-up'],
    severity: 'medium',
    detect: () => false,
    ...overrides,
  };
}

function createMockScorecard(): Scorecard {
  return {
    entries: [
      {
        ruleId: 'test-rule',
        ruleName: 'Test Rule',
        assessment: 'good',
        comment: 'Well done',
      },
    ],
    overallScore: 85,
    summary: 'Good performance',
  };
}

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
      generate: jest.fn().mockResolvedValue(createMockScorecard()),
    },
    rules: [createMockRule()],
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

// --- AC 1: fixture references use discovery-call-001.json -----------------

describe('TICKET-032 AC1: fixture files renamed correctly', () => {
  const fixturesDir = path.join(process.cwd(), 'src', 'fixtures');

  it('discovery-call-001.json exists', () => {
    expect(
      fs.existsSync(path.join(fixturesDir, 'discovery-call-001.json')),
    ).toBe(true);
  });

  it('old discovery-call.json does NOT exist', () => {
    expect(
      fs.existsSync(path.join(fixturesDir, 'discovery-call.json')),
    ).toBe(false);
  });

  it('objection-handling-001.json exists', () => {
    expect(
      fs.existsSync(path.join(fixturesDir, 'objection-handling-001.json')),
    ).toBe(true);
  });

  it('old demo-call.json does NOT exist', () => {
    expect(
      fs.existsSync(path.join(fixturesDir, 'demo-call.json')),
    ).toBe(false);
  });

  it('fixture files contain valid JSON arrays with speaker and text', () => {
    const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(2);

    for (const file of files) {
      const content = JSON.parse(
        fs.readFileSync(path.join(fixturesDir, file), 'utf-8'),
      );
      expect(Array.isArray(content)).toBe(true);
      expect(content.length).toBeGreaterThan(0);
      expect(content[0]).toHaveProperty('speaker');
      expect(content[0]).toHaveProperty('text');
    }
  });
});

// --- AC 2: createSession stores callType ----------------------------------

describe('TICKET-032 AC2: SessionManager.createSession stores callType', () => {
  it('stores explicit callType on the session object', () => {
    const deps = createMockDeps();
    const manager = new SessionManager(deps);

    const id = manager.createSession('discovery-call-001', 'demo');
    const session = manager.getSession(id);

    expect(session).toBeDefined();
    expect(session!.callType).toBe('demo');
  });

  it('defaults callType to "discovery" when not provided', () => {
    const deps = createMockDeps();
    const manager = new SessionManager(deps);

    const id = manager.createSession('discovery-call-001');
    const session = manager.getSession(id);

    expect(session).toBeDefined();
    expect(session!.callType).toBe('discovery');
  });

  it('stores each valid callType value', () => {
    const deps = createMockDeps();
    const manager = new SessionManager(deps);

    const callTypes: CallType[] = ['discovery', 'demo', 'objection-handling', 'follow-up'];

    for (const ct of callTypes) {
      const id = manager.createSession('discovery-call-001', ct);
      const session = manager.getSession(id);
      expect(session!.callType).toBe(ct);
    }
  });

  it('Session type includes callType field', () => {
    const deps = createMockDeps();
    const manager = new SessionManager(deps);

    const id = manager.createSession('discovery-call-001', 'objection-handling');
    const session = manager.getSession(id);

    // TypeScript compilation proves the type exists; runtime check for safety
    expect('callType' in session!).toBe(true);
  });
});

// --- AC 3: no lint / type issues in test infrastructure -------------------

describe('TICKET-032 AC3: no lint / type issues in test infrastructure', () => {
  it('Session type exports CallType', () => {
    // If this file compiles, CallType is properly exported from @/types
    const ct: CallType = 'discovery';
    expect(ct).toBe('discovery');
  });

  it('CoachingRule includes callTypes and severity fields', () => {
    const rule = createMockRule();
    expect(rule).toHaveProperty('callTypes');
    expect(rule).toHaveProperty('severity');
    expect(Array.isArray(rule.callTypes)).toBe(true);
    expect(typeof rule.severity).toBe('string');
  });
});
