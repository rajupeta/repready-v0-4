import { RulesEngine } from '@/services/rules-engine';
import { CoachingRule, TranscriptLine } from '@/types';

function makeLines(
  specs: Array<{ speaker: 'rep' | 'prospect'; text: string }>
): TranscriptLine[] {
  return specs.map((s) => ({ speaker: s.speaker, text: s.text }));
}

function makeRule(overrides: Partial<CoachingRule> = {}): CoachingRule {
  return {
    ruleId: 'test-rule',
    name: 'Test Rule',
    description: 'A test rule',
    cooldownMs: 10000,
    callTypes: ['discovery', 'demo', 'objection-handling', 'follow-up'],
    severity: 'medium',
    detect: () => true,
    ...overrides,
  };
}

describe('TICKET-046: Duplicate coaching prompts — per-session cooldown isolation', () => {
  it('isolates cooldowns between different sessions', () => {
    const rule = makeRule({ ruleId: 'shared-rule', cooldownMs: 60000 });
    const engine = new RulesEngine([rule]);
    const window = makeLines([{ speaker: 'rep', text: 'test' }]);

    // Session A triggers the rule
    const resultA1 = engine.evaluate(window, 'session-a');
    expect(resultA1).toHaveLength(1);

    // Session B should also trigger (independent cooldown)
    const resultB1 = engine.evaluate(window, 'session-b');
    expect(resultB1).toHaveLength(1);

    // Session A should NOT re-trigger (still in cooldown)
    const resultA2 = engine.evaluate(window, 'session-a');
    expect(resultA2).toHaveLength(0);

    // Session B should NOT re-trigger (still in cooldown)
    const resultB2 = engine.evaluate(window, 'session-b');
    expect(resultB2).toHaveLength(0);
  });

  it('resetting one session cooldown does not affect another', () => {
    const rule = makeRule({ ruleId: 'isolation-rule', cooldownMs: 60000 });
    const engine = new RulesEngine([rule]);
    const window = makeLines([{ speaker: 'rep', text: 'test' }]);

    // Both sessions trigger
    engine.evaluate(window, 'session-a');
    engine.evaluate(window, 'session-b');

    // Reset only session A
    engine.resetCooldowns('session-a');

    // Session A can trigger again
    const resultA = engine.evaluate(window, 'session-a');
    expect(resultA).toHaveLength(1);

    // Session B is still in cooldown
    const resultB = engine.evaluate(window, 'session-b');
    expect(resultB).toHaveLength(0);
  });

  it('resetCooldowns without sessionId clears all sessions', () => {
    const rule = makeRule({ ruleId: 'global-reset', cooldownMs: 60000 });
    const engine = new RulesEngine([rule]);
    const window = makeLines([{ speaker: 'rep', text: 'test' }]);

    engine.evaluate(window, 'session-a');
    engine.evaluate(window, 'session-b');

    // Both in cooldown
    expect(engine.evaluate(window, 'session-a')).toHaveLength(0);
    expect(engine.evaluate(window, 'session-b')).toHaveLength(0);

    // Global reset
    engine.resetCooldowns();

    // Both can trigger again
    expect(engine.evaluate(window, 'session-a')).toHaveLength(1);
    expect(engine.evaluate(window, 'session-b')).toHaveLength(1);
  });

  it('each rule fires at most once per cooldown window within a session', () => {
    const rule = makeRule({ ruleId: 'once-per-window', cooldownMs: 60000 });
    const engine = new RulesEngine([rule]);
    const window = makeLines([{ speaker: 'rep', text: 'test' }]);

    const sessionId = 'test-session';

    // First call triggers
    expect(engine.evaluate(window, sessionId)).toHaveLength(1);

    // Repeated calls within cooldown do NOT trigger
    expect(engine.evaluate(window, sessionId)).toHaveLength(0);
    expect(engine.evaluate(window, sessionId)).toHaveLength(0);
    expect(engine.evaluate(window, sessionId)).toHaveLength(0);
  });

  it('cooldown timer resets correctly after expiration', () => {
    const rule = makeRule({ ruleId: 'timer-reset', cooldownMs: 100 });
    const engine = new RulesEngine([rule]);
    const window = makeLines([{ speaker: 'rep', text: 'test' }]);

    const sessionId = 'timer-session';

    // First trigger
    expect(engine.evaluate(window, sessionId)).toHaveLength(1);

    // Wait for cooldown to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        // Should trigger again after cooldown
        expect(engine.evaluate(window, sessionId)).toHaveLength(1);

        // Should NOT trigger immediately after
        expect(engine.evaluate(window, sessionId)).toHaveLength(0);
        resolve();
      }, 150);
    });
  });

  it('backwards compatible — works without sessionId (default session)', () => {
    const rule = makeRule({ ruleId: 'compat', cooldownMs: 60000 });
    const engine = new RulesEngine([rule]);
    const window = makeLines([{ speaker: 'rep', text: 'test' }]);

    // Without sessionId
    expect(engine.evaluate(window)).toHaveLength(1);
    expect(engine.evaluate(window)).toHaveLength(0);

    engine.resetCooldowns();
    expect(engine.evaluate(window)).toHaveLength(1);
  });

  it('multiple rules track cooldowns independently per session', () => {
    const ruleA = makeRule({
      ruleId: 'rule-a',
      cooldownMs: 60000,
      detect: () => true,
    });
    const ruleB = makeRule({
      ruleId: 'rule-b',
      cooldownMs: 60000,
      detect: () => true,
    });
    const engine = new RulesEngine([ruleA, ruleB]);
    const window = makeLines([{ speaker: 'rep', text: 'test' }]);

    // Session 1 triggers both rules
    const result1 = engine.evaluate(window, 'session-1');
    expect(result1).toHaveLength(2);
    expect(result1.map((r) => r.ruleId)).toEqual(['rule-a', 'rule-b']);

    // Session 1 — both still in cooldown
    expect(engine.evaluate(window, 'session-1')).toHaveLength(0);

    // Session 2 can still trigger both independently
    const result2 = engine.evaluate(window, 'session-2');
    expect(result2).toHaveLength(2);
  });
});
