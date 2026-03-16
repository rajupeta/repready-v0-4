/**
 * TICKET-052: Rules engine should evaluate per-line, not batch entire transcript
 *
 * Validates:
 * - RulesEngine.evaluate() takes newLine + window (not full transcript)
 * - Each line addition triggers exactly one evaluation pass
 * - Coaching prompts generated per-line, not per-batch
 * - Cooldown dedup still works correctly with per-line evaluation
 */

import { RulesEngine } from '@/services/rules-engine';
import { TranscriptService } from '@/services/transcript-service';
import { CoachingRule, TranscriptLine } from '@/types';

function makeLine(speaker: 'rep' | 'prospect', text: string): TranscriptLine {
  return { speaker, text };
}

function makeRule(overrides: Partial<CoachingRule> = {}): CoachingRule {
  return {
    ruleId: 'test-rule',
    name: 'Test Rule',
    description: 'A test rule',
    cooldownMs: 60000,
    callTypes: ['discovery', 'demo', 'objection-handling', 'follow-up'],
    severity: 'medium',
    detect: () => true,
    ...overrides,
  };
}

describe('TICKET-052: Per-line evaluation', () => {
  describe('RulesEngine.evaluate() signature accepts newLine + window', () => {
    it('accepts newLine as first parameter and window as second', () => {
      const rule = makeRule({ ruleId: 'sig-test' });
      const engine = new RulesEngine([rule]);

      const newLine = makeLine('rep', 'Hello');
      const window = [newLine];

      const result = engine.evaluate(newLine, window);
      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe('sig-test');
    });

    it('accepts optional sessionId as third parameter', () => {
      const rule = makeRule({ ruleId: 'session-sig' });
      const engine = new RulesEngine([rule]);

      const newLine = makeLine('rep', 'Hello');
      const window = [newLine];

      const result = engine.evaluate(newLine, window, 'session-1');
      expect(result).toHaveLength(1);
    });

    it('passes window (not newLine alone) to detect functions', () => {
      const detectSpy = jest.fn().mockReturnValue(true);
      const rule = makeRule({ ruleId: 'detect-arg', detect: detectSpy });
      const engine = new RulesEngine([rule]);

      const line1 = makeLine('rep', 'First');
      const line2 = makeLine('prospect', 'Second');
      const newLine = makeLine('rep', 'Third');
      const window = [line1, line2, newLine];

      engine.evaluate(newLine, window);

      // detect receives the full window, not just newLine
      expect(detectSpy).toHaveBeenCalledWith(window);
      expect(detectSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Each line addition triggers one evaluation pass', () => {
    it('TranscriptService.addLine triggers callback once per line', () => {
      const callback = jest.fn();
      const service = new TranscriptService(callback);

      service.addLine(makeLine('rep', 'Line 1'));
      service.addLine(makeLine('prospect', 'Line 2'));
      service.addLine(makeLine('rep', 'Line 3'));

      expect(callback).toHaveBeenCalledTimes(3);
    });

    it('each callback receives the new line and current window', () => {
      const callback = jest.fn();
      const service = new TranscriptService(callback);

      const line1 = makeLine('rep', 'Hello');
      const line2 = makeLine('prospect', 'Hi');

      service.addLine(line1);
      expect(callback).toHaveBeenLastCalledWith(line1, [line1]);

      service.addLine(line2);
      expect(callback).toHaveBeenLastCalledWith(line2, [line1, line2]);
    });

    it('evaluate is called per-line when wired through TranscriptService', () => {
      const rule = makeRule({ ruleId: 'per-line', cooldownMs: 60000 });
      const engine = new RulesEngine([rule]);
      const evaluations: { newLine: TranscriptLine; window: TranscriptLine[] }[] = [];

      const service = new TranscriptService((line, window) => {
        evaluations.push({ newLine: line, window: [...window] });
        engine.evaluate(line, window);
      });

      service.addLine(makeLine('rep', 'First'));
      service.addLine(makeLine('prospect', 'Second'));
      service.addLine(makeLine('rep', 'Third'));

      // Three separate evaluations, one per line
      expect(evaluations).toHaveLength(3);

      // Each evaluation received the correct newLine
      expect(evaluations[0].newLine.text).toBe('First');
      expect(evaluations[1].newLine.text).toBe('Second');
      expect(evaluations[2].newLine.text).toBe('Third');

      // Windows grow incrementally
      expect(evaluations[0].window).toHaveLength(1);
      expect(evaluations[1].window).toHaveLength(2);
      expect(evaluations[2].window).toHaveLength(3);
    });
  });

  describe('Coaching prompts generated per-line, not per-batch', () => {
    it('rules trigger on the first matching line, not after all lines', () => {
      const rule = makeRule({
        ruleId: 'first-match',
        cooldownMs: 60000,
        detect: (window) => {
          // Triggers when there's a rep line
          return window.some((l) => l.speaker === 'rep');
        },
      });
      const engine = new RulesEngine([rule]);

      // First line (rep) should trigger the rule
      const line1 = makeLine('rep', 'Hello');
      const result1 = engine.evaluate(line1, [line1]);
      expect(result1).toHaveLength(1);

      // Second line (prospect) — rule already in cooldown
      const line2 = makeLine('prospect', 'Hi');
      const result2 = engine.evaluate(line2, [line1, line2]);
      expect(result2).toHaveLength(0);
    });

    it('different rules can trigger on different lines', () => {
      const ruleA = makeRule({
        ruleId: 'rule-a',
        cooldownMs: 60000,
        detect: (window) => window.length >= 1,
      });
      const ruleB = makeRule({
        ruleId: 'rule-b',
        cooldownMs: 60000,
        detect: (window) => window.length >= 3,
      });
      const engine = new RulesEngine([ruleA, ruleB]);

      // Line 1: only ruleA triggers (window length = 1)
      const line1 = makeLine('rep', 'First');
      const result1 = engine.evaluate(line1, [line1]);
      expect(result1.map((r) => r.ruleId)).toEqual(['rule-a']);

      // Line 2: ruleA in cooldown, ruleB not yet (window < 3)
      const line2 = makeLine('prospect', 'Second');
      const result2 = engine.evaluate(line2, [line1, line2]);
      expect(result2).toHaveLength(0);

      // Line 3: ruleA still in cooldown, ruleB now triggers (window = 3)
      const line3 = makeLine('rep', 'Third');
      const result3 = engine.evaluate(line3, [line1, line2, line3]);
      expect(result3.map((r) => r.ruleId)).toEqual(['rule-b']);
    });
  });

  describe('Cooldown dedup still works correctly with per-line evaluation', () => {
    it('per-ruleId cooldown prevents duplicate triggers across lines', () => {
      const rule = makeRule({ ruleId: 'dedup-test', cooldownMs: 60000 });
      const engine = new RulesEngine([rule]);

      const lines: TranscriptLine[] = [];
      for (let i = 0; i < 5; i++) {
        const line = makeLine('rep', `Line ${i}`);
        lines.push(line);
        const result = engine.evaluate(line, [...lines]);

        if (i === 0) {
          // First evaluation triggers
          expect(result).toHaveLength(1);
        } else {
          // Subsequent evaluations are blocked by cooldown
          expect(result).toHaveLength(0);
        }
      }
    });

    it('per-session cooldown isolation works with per-line evaluation', () => {
      const rule = makeRule({ ruleId: 'session-dedup', cooldownMs: 60000 });
      const engine = new RulesEngine([rule]);

      const line = makeLine('rep', 'Hello');
      const window = [line];

      // Session A triggers
      expect(engine.evaluate(line, window, 'session-a')).toHaveLength(1);
      // Session A in cooldown
      expect(engine.evaluate(line, window, 'session-a')).toHaveLength(0);

      // Session B independently triggers
      expect(engine.evaluate(line, window, 'session-b')).toHaveLength(1);
      // Session B in cooldown
      expect(engine.evaluate(line, window, 'session-b')).toHaveLength(0);
    });

    it('cooldown expiration works correctly with per-line evaluation', () => {
      const rule = makeRule({ ruleId: 'expire-test', cooldownMs: 100 });
      const engine = new RulesEngine([rule]);

      const line = makeLine('rep', 'Hello');

      // First trigger
      expect(engine.evaluate(line, [line])).toHaveLength(1);
      // In cooldown
      expect(engine.evaluate(line, [line])).toHaveLength(0);

      return new Promise<void>((resolve) => {
        setTimeout(() => {
          // After cooldown expires, should trigger again
          expect(engine.evaluate(line, [line])).toHaveLength(1);
          resolve();
        }, 150);
      });
    });

    it('resetCooldowns works correctly with per-line evaluation', () => {
      const rule = makeRule({ ruleId: 'reset-test', cooldownMs: 60000 });
      const engine = new RulesEngine([rule]);

      const line = makeLine('rep', 'Hello');

      engine.evaluate(line, [line], 'session-1');
      expect(engine.evaluate(line, [line], 'session-1')).toHaveLength(0);

      engine.resetCooldowns('session-1');
      expect(engine.evaluate(line, [line], 'session-1')).toHaveLength(1);
    });
  });

  describe('Integration: full per-line pipeline', () => {
    it('simulates full addLine → evaluate → coaching flow per-line', () => {
      const talkRatioRule = makeRule({
        ruleId: 'talk-ratio',
        cooldownMs: 30000,
        detect: (window) => {
          if (window.length < 3) return false;
          const repCount = window.filter((l) => l.speaker === 'rep').length;
          return repCount / window.length > 0.65;
        },
      });

      const engine = new RulesEngine([talkRatioRule]);
      const triggeredPerLine: CoachingRule[][] = [];

      const service = new TranscriptService((line, window) => {
        const triggered = engine.evaluate(line, window);
        triggeredPerLine.push(triggered);
      });

      // Add lines one by one — simulating real-time playback
      service.addLine(makeLine('rep', 'Hi there'));        // 1 line, too short
      service.addLine(makeLine('rep', 'Our product'));      // 2 lines, too short
      service.addLine(makeLine('rep', 'Is amazing'));       // 3 lines, 100% rep → triggers!
      service.addLine(makeLine('rep', 'Really great'));     // 4 lines, in cooldown
      service.addLine(makeLine('prospect', 'OK'));          // 5 lines, in cooldown

      expect(triggeredPerLine).toHaveLength(5);
      expect(triggeredPerLine[0]).toHaveLength(0); // too short
      expect(triggeredPerLine[1]).toHaveLength(0); // too short
      expect(triggeredPerLine[2]).toHaveLength(1); // triggers!
      expect(triggeredPerLine[2][0].ruleId).toBe('talk-ratio');
      expect(triggeredPerLine[3]).toHaveLength(0); // cooldown
      expect(triggeredPerLine[4]).toHaveLength(0); // cooldown
    });
  });
});
