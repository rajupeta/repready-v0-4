import { RulesEngine } from "@/services/rules-engine";
import { CoachingRule, TranscriptLine } from "@/types";

function makeLines(
  specs: Array<{ speaker: "rep" | "prospect"; text: string }>
): TranscriptLine[] {
  return specs.map((s) => ({ speaker: s.speaker, text: s.text }));
}

function makeRule(overrides: Partial<CoachingRule> = {}): CoachingRule {
  return {
    ruleId: "test-rule",
    name: "Test Rule",
    description: "A test rule",
    cooldownMs: 10000,
    callTypes: ["discovery", "demo", "objection-handling", "follow-up"],
    severity: "medium",
    detect: () => true,
    ...overrides,
  };
}

describe("RulesEngine", () => {
  it("returns triggered rules that pass detection", () => {
    const alwaysTriggers = makeRule({ ruleId: "always", detect: () => true });
    const neverTriggers = makeRule({ ruleId: "never", detect: () => false });
    const engine = new RulesEngine([alwaysTriggers, neverTriggers]);

    const result = engine.evaluate([]);
    expect(result).toHaveLength(1);
    expect(result[0].ruleId).toBe("always");
  });

  it("respects cooldown — does not re-trigger within cooldownMs", () => {
    const rule = makeRule({ ruleId: "cd-test", cooldownMs: 60000 });
    const engine = new RulesEngine([rule]);

    const window = makeLines([{ speaker: "rep", text: "test" }]);

    const first = engine.evaluate(window);
    expect(first).toHaveLength(1);

    const second = engine.evaluate(window);
    expect(second).toHaveLength(0);
  });

  it("allows re-trigger after cooldown expires", () => {
    const rule = makeRule({ ruleId: "cd-expire", cooldownMs: 100 });
    const engine = new RulesEngine([rule]);
    const window = makeLines([{ speaker: "rep", text: "test" }]);

    const first = engine.evaluate(window);
    expect(first).toHaveLength(1);

    // Simulate time passing by manipulating the internal state
    // We'll use a short cooldown and real time
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        const second = engine.evaluate(window);
        expect(second).toHaveLength(1);
        resolve();
      }, 150);
    });
  });

  it("tracks cooldowns per ruleId independently", () => {
    const ruleA = makeRule({ ruleId: "rule-a", cooldownMs: 60000, detect: () => true });
    const ruleB = makeRule({ ruleId: "rule-b", cooldownMs: 60000, detect: () => true });
    const engine = new RulesEngine([ruleA, ruleB]);

    const window = makeLines([{ speaker: "rep", text: "test" }]);

    const first = engine.evaluate(window);
    expect(first).toHaveLength(2);

    // Both are now in cooldown
    const second = engine.evaluate(window);
    expect(second).toHaveLength(0);
  });

  it("resetCooldowns clears all tracking", () => {
    const rule = makeRule({ ruleId: "reset-test", cooldownMs: 60000 });
    const engine = new RulesEngine([rule]);
    const window = makeLines([{ speaker: "rep", text: "test" }]);

    engine.evaluate(window);
    expect(engine.evaluate(window)).toHaveLength(0);

    engine.resetCooldowns();
    expect(engine.evaluate(window)).toHaveLength(1);
  });

  it("returns empty array when no rules trigger", () => {
    const rule = makeRule({ ruleId: "no-trigger", detect: () => false });
    const engine = new RulesEngine([rule]);

    const result = engine.evaluate([]);
    expect(result).toHaveLength(0);
  });

  it("passes the window to each rule's detect function", () => {
    const detectSpy = jest.fn().mockReturnValue(false);
    const rule = makeRule({ ruleId: "spy", detect: detectSpy });
    const engine = new RulesEngine([rule]);
    const window = makeLines([
      { speaker: "rep", text: "hello" },
      { speaker: "prospect", text: "hi" },
    ]);

    engine.evaluate(window);
    expect(detectSpy).toHaveBeenCalledWith(window);
  });

  it("works with the real coaching rules", async () => {
    const { coachingRules } = await import("@/rules/coaching-rules");
    const engine = new RulesEngine(coachingRules);

    // Window that triggers talk-ratio (8/10 = 80% rep)
    const window = makeLines([
      { speaker: "rep", text: "First" },
      { speaker: "rep", text: "Second" },
      { speaker: "rep", text: "Third" },
      { speaker: "rep", text: "Fourth" },
      { speaker: "rep", text: "Fifth" },
      { speaker: "rep", text: "Sixth" },
      { speaker: "prospect", text: "OK" },
      { speaker: "rep", text: "Seventh" },
      { speaker: "rep", text: "Eighth" },
      { speaker: "prospect", text: "I see" },
    ]);

    const triggered = engine.evaluate(window);
    const ruleIds = triggered.map((r) => r.ruleId);
    expect(ruleIds).toContain("talk-ratio");
  });
});
