import { coachingRules } from "@/rules/coaching-rules";
import { RulesEngine } from "@/services/rules-engine";
import { CoachingRule, TranscriptLine } from "@/types";

function makeLines(
  specs: Array<{ speaker: "rep" | "prospect"; text: string }>
): TranscriptLine[] {
  return specs.map((s) => ({ speaker: s.speaker, text: s.text }));
}

function getRule(ruleId: string): CoachingRule {
  const rule = coachingRules.find((r) => r.ruleId === ruleId);
  if (!rule) throw new Error(`Rule not found: ${ruleId}`);
  return rule;
}

describe("TICKET-005 QA Validation — Acceptance Criteria", () => {
  // AC: 6 coaching rules exported from coaching-rules.ts
  describe("coaching-rules.ts exports", () => {
    it("exports exactly 8 rules", () => {
      expect(coachingRules).toHaveLength(8);
    });

    it("exports rules as an array", () => {
      expect(Array.isArray(coachingRules)).toBe(true);
    });

    const expectedRules = [
      { ruleId: "talk-ratio", cooldownMs: 30000 },
      { ruleId: "long-monologue", cooldownMs: 45000 },
      { ruleId: "no-questions", cooldownMs: 60000 },
      { ruleId: "filler-words", cooldownMs: 20000 },
      { ruleId: "feature-dump", cooldownMs: 45000 },
      { ruleId: "no-next-steps", cooldownMs: 90000 },
      { ruleId: "objection-deflected", cooldownMs: 60000 },
      { ruleId: "competitor-not-explored", cooldownMs: 60000 },
    ];

    it.each(expectedRules)(
      "rule '$ruleId' exists with cooldownMs=$cooldownMs",
      ({ ruleId, cooldownMs }) => {
        const rule = getRule(ruleId);
        expect(rule.cooldownMs).toBe(cooldownMs);
      }
    );

    // AC: correct ruleId, name, description, cooldownMs, and detect functions
    it("each rule has all required fields with correct types", () => {
      for (const rule of coachingRules) {
        expect(typeof rule.ruleId).toBe("string");
        expect(rule.ruleId.length).toBeGreaterThan(0);
        expect(typeof rule.name).toBe("string");
        expect(rule.name.length).toBeGreaterThan(0);
        expect(typeof rule.description).toBe("string");
        expect(rule.description.length).toBeGreaterThan(0);
        expect(typeof rule.cooldownMs).toBe("number");
        expect(rule.cooldownMs).toBeGreaterThan(0);
        expect(typeof rule.detect).toBe("function");
      }
    });

    it("all ruleIds are unique", () => {
      const ids = coachingRules.map((r) => r.ruleId);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  // AC: detect functions work correctly
  describe("rule detection logic", () => {
    describe("talk-ratio: rep >65% of lines in window", () => {
      const rule = getRule("talk-ratio");

      it("triggers at 70% rep (7/10)", () => {
        const window = makeLines([
          { speaker: "rep", text: "1" },
          { speaker: "rep", text: "2" },
          { speaker: "rep", text: "3" },
          { speaker: "rep", text: "4" },
          { speaker: "rep", text: "5" },
          { speaker: "rep", text: "6" },
          { speaker: "rep", text: "7" },
          { speaker: "prospect", text: "a" },
          { speaker: "prospect", text: "b" },
          { speaker: "prospect", text: "c" },
        ]);
        expect(rule.detect(window)).toBe(true);
      });

      it("does not trigger at exactly 65% (13/20)", () => {
        const window = makeLines([
          ...Array(13).fill({ speaker: "rep" as const, text: "rep" }),
          ...Array(7).fill({ speaker: "prospect" as const, text: "prospect" }),
        ]);
        expect(rule.detect(window)).toBe(false);
      });

      it("does not trigger at 50% (balanced)", () => {
        const window = makeLines([
          { speaker: "rep", text: "1" },
          { speaker: "prospect", text: "2" },
          { speaker: "rep", text: "3" },
          { speaker: "prospect", text: "4" },
        ]);
        expect(rule.detect(window)).toBe(false);
      });
    });

    describe("long-monologue: 4+ consecutive rep lines", () => {
      const rule = getRule("long-monologue");

      it("triggers with exactly 4 consecutive rep lines", () => {
        const window = makeLines([
          { speaker: "rep", text: "a" },
          { speaker: "rep", text: "b" },
          { speaker: "rep", text: "c" },
          { speaker: "rep", text: "d" },
        ]);
        expect(rule.detect(window)).toBe(true);
      });

      it("triggers with 5 consecutive rep lines", () => {
        const window = makeLines([
          { speaker: "rep", text: "a" },
          { speaker: "rep", text: "b" },
          { speaker: "rep", text: "c" },
          { speaker: "rep", text: "d" },
          { speaker: "rep", text: "e" },
        ]);
        expect(rule.detect(window)).toBe(true);
      });

      it("does not trigger with 3 consecutive", () => {
        const window = makeLines([
          { speaker: "rep", text: "a" },
          { speaker: "rep", text: "b" },
          { speaker: "rep", text: "c" },
          { speaker: "prospect", text: "x" },
        ]);
        expect(rule.detect(window)).toBe(false);
      });

      it("resets count after prospect line", () => {
        const window = makeLines([
          { speaker: "rep", text: "a" },
          { speaker: "rep", text: "b" },
          { speaker: "rep", text: "c" },
          { speaker: "prospect", text: "break" },
          { speaker: "rep", text: "d" },
          { speaker: "rep", text: "e" },
        ]);
        expect(rule.detect(window)).toBe(false);
      });
    });

    describe("no-questions: zero question marks in rep lines", () => {
      const rule = getRule("no-questions");

      it("triggers when rep lines have no questions", () => {
        const window = makeLines([
          { speaker: "rep", text: "Our product is great." },
          { speaker: "rep", text: "It saves time." },
        ]);
        expect(rule.detect(window)).toBe(true);
      });

      it("does not trigger when any rep line has a question", () => {
        const window = makeLines([
          { speaker: "rep", text: "What do you think?" },
          { speaker: "rep", text: "Our product is great." },
        ]);
        expect(rule.detect(window)).toBe(false);
      });

      it("ignores prospect question marks", () => {
        const window = makeLines([
          { speaker: "rep", text: "Our product is great." },
          { speaker: "prospect", text: "Really?" },
        ]);
        expect(rule.detect(window)).toBe(true);
      });

      it("does not trigger when only prospect lines exist", () => {
        const window = makeLines([
          { speaker: "prospect", text: "Hello" },
        ]);
        expect(rule.detect(window)).toBe(false);
      });
    });

    describe("filler-words: 3+ fillers in latest rep line", () => {
      const rule = getRule("filler-words");

      it("triggers with 3 distinct fillers", () => {
        const window = makeLines([
          { speaker: "rep", text: "Um, like, basically our product is great" },
        ]);
        expect(rule.detect(window)).toBe(true);
      });

      it("does not trigger with 2 fillers", () => {
        const window = makeLines([
          { speaker: "rep", text: "Um, basically our product is great" },
        ]);
        expect(rule.detect(window)).toBe(false);
      });

      it("is case-insensitive", () => {
        const window = makeLines([
          { speaker: "rep", text: "UM LIKE BASICALLY" },
        ]);
        expect(rule.detect(window)).toBe(true);
      });

      it("counts multi-word filler 'you know'", () => {
        const window = makeLines([
          { speaker: "rep", text: "You know, um, like, it's great" },
        ]);
        expect(rule.detect(window)).toBe(true);
      });

      it("counts multi-word filler 'so yeah'", () => {
        const window = makeLines([
          { speaker: "rep", text: "Um, like, so yeah that's the plan" },
        ]);
        expect(rule.detect(window)).toBe(true);
      });

      it("only checks the latest rep line", () => {
        const window = makeLines([
          { speaker: "rep", text: "Um like basically you know right actually" },
          { speaker: "prospect", text: "Hmm" },
          { speaker: "rep", text: "The product is excellent." },
        ]);
        // Latest rep line is clean
        expect(rule.detect(window)).toBe(false);
      });
    });

    describe("feature-dump: 3+ consecutive rep lines with feature keywords, no questions", () => {
      const rule = getRule("feature-dump");

      it("triggers with 3 consecutive feature-keyword rep lines", () => {
        const window = makeLines([
          { speaker: "rep", text: "Our platform handles everything." },
          { speaker: "rep", text: "The dashboard shows metrics." },
          { speaker: "rep", text: "We have analytics built in." },
        ]);
        expect(rule.detect(window)).toBe(true);
      });

      it("does not trigger when a line has a question mark", () => {
        const window = makeLines([
          { speaker: "rep", text: "Our platform handles everything." },
          { speaker: "rep", text: "Have you seen the dashboard?" },
          { speaker: "rep", text: "We have analytics built in." },
        ]);
        expect(rule.detect(window)).toBe(false);
      });

      it("does not trigger when prospect interrupts", () => {
        const window = makeLines([
          { speaker: "rep", text: "Our platform is great." },
          { speaker: "rep", text: "The dashboard is powerful." },
          { speaker: "prospect", text: "Tell me more" },
          { speaker: "rep", text: "The analytics are amazing." },
        ]);
        expect(rule.detect(window)).toBe(false);
      });

      it("does not trigger when lines lack feature keywords", () => {
        const window = makeLines([
          { speaker: "rep", text: "Hello there." },
          { speaker: "rep", text: "How are you." },
          { speaker: "rep", text: "Nice to meet you." },
        ]);
        expect(rule.detect(window)).toBe(false);
      });
    });

    describe("no-next-steps: prospect interest without rep next step in last 5 lines", () => {
      const rule = getRule("no-next-steps");

      it("triggers when prospect interested, rep has no next step", () => {
        const window = makeLines([
          { speaker: "prospect", text: "That sounds great!" },
          { speaker: "rep", text: "Yeah, many customers love it." },
          { speaker: "rep", text: "It's very popular." },
        ]);
        expect(rule.detect(window)).toBe(true);
      });

      it("does not trigger when rep proposes schedule", () => {
        const window = makeLines([
          { speaker: "prospect", text: "Sounds good, I'm interested." },
          { speaker: "rep", text: "Let me schedule a demo for you." },
        ]);
        expect(rule.detect(window)).toBe(false);
      });

      it("does not trigger when rep proposes call", () => {
        const window = makeLines([
          { speaker: "prospect", text: "Yes, definitely!" },
          { speaker: "rep", text: "Let's set up a call next week." },
        ]);
        expect(rule.detect(window)).toBe(false);
      });

      it("does not trigger when rep proposes send", () => {
        const window = makeLines([
          { speaker: "prospect", text: "Absolutely, love it." },
          { speaker: "rep", text: "I'll send you the details." },
        ]);
        expect(rule.detect(window)).toBe(false);
      });

      it("does not trigger when rep proposes follow up", () => {
        const window = makeLines([
          { speaker: "prospect", text: "Sure, interested." },
          { speaker: "rep", text: "I'll follow up with a proposal." },
        ]);
        expect(rule.detect(window)).toBe(false);
      });

      it("does not trigger when no prospect interest", () => {
        const window = makeLines([
          { speaker: "prospect", text: "I don't think so." },
          { speaker: "rep", text: "Let me know if you change your mind." },
        ]);
        expect(rule.detect(window)).toBe(false);
      });

      it("only examines last 5 lines of the window", () => {
        const window = makeLines([
          // Old interest signal — beyond last 5
          { speaker: "prospect", text: "Yes, I'm interested!" },
          { speaker: "rep", text: "Great." },
          // Last 5 lines — no interest
          { speaker: "rep", text: "Moving on." },
          { speaker: "prospect", text: "OK." },
          { speaker: "rep", text: "Pricing details." },
          { speaker: "prospect", text: "Hmm." },
          { speaker: "rep", text: "Very competitive." },
        ]);
        expect(rule.detect(window)).toBe(false);
      });
    });
  });

  // AC: RulesEngine.evaluate() returns only rules that trigger AND are not in cooldown
  describe("RulesEngine.evaluate()", () => {
    it("returns only triggered rules", () => {
      const always: CoachingRule = {
        ruleId: "always",
        name: "Always",
        description: "Always triggers",
        cooldownMs: 60000,
        callTypes: ["discovery"],
        severity: "medium",
        detect: () => true,
      };
      const never: CoachingRule = {
        ruleId: "never",
        name: "Never",
        description: "Never triggers",
        cooldownMs: 60000,
        callTypes: ["discovery"],
        severity: "medium",
        detect: () => false,
      };
      const engine = new RulesEngine([always, never]);
      const result = engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe("always");
    });

    it("filters out rules in cooldown", () => {
      const rule: CoachingRule = {
        ruleId: "cd-rule",
        name: "Cooldown Rule",
        description: "Tests cooldown",
        cooldownMs: 60000,
        callTypes: ["discovery"],
        severity: "medium",
        detect: () => true,
      };
      const engine = new RulesEngine([rule]);
      const window = makeLines([{ speaker: "rep", text: "test" }]);

      expect(engine.evaluate(window[window.length - 1], window)).toHaveLength(1);
      expect(engine.evaluate(window[window.length - 1], window)).toHaveLength(0);
    });

    it("updates lastTriggered for triggered rules", () => {
      const rule: CoachingRule = {
        ruleId: "track",
        name: "Track",
        description: "Tracks trigger time",
        cooldownMs: 60000,
        callTypes: ["discovery"],
        severity: "medium",
        detect: () => true,
      };
      const engine = new RulesEngine([rule]);

      engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
      // Second call should be blocked by cooldown
      const second = engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
      expect(second).toHaveLength(0);
    });
  });

  // AC: Cooldown tracking works per-ruleId
  describe("cooldown per-ruleId tracking", () => {
    it("tracks cooldowns independently per rule", () => {
      const ruleA: CoachingRule = {
        ruleId: "a",
        name: "A",
        description: "Rule A",
        cooldownMs: 60000,
        callTypes: ["discovery"],
        severity: "medium",
        detect: () => true,
      };
      const ruleB: CoachingRule = {
        ruleId: "b",
        name: "B",
        description: "Rule B",
        cooldownMs: 60000,
        callTypes: ["discovery"],
        severity: "medium",
        detect: () => true,
      };
      const engine = new RulesEngine([ruleA, ruleB]);

      const first = engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
      expect(first.map((r) => r.ruleId).sort()).toEqual(["a", "b"]);

      // Both in cooldown
      const second = engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
      expect(second).toHaveLength(0);
    });

    it("one rule's cooldown does not affect another", () => {
      let callCount = 0;
      const ruleA: CoachingRule = {
        ruleId: "a",
        name: "A",
        description: "Rule A",
        cooldownMs: 60000,
        callTypes: ["discovery"],
        severity: "medium",
        detect: () => {
          callCount++;
          return callCount <= 1; // Only triggers first time
        },
      };
      const ruleB: CoachingRule = {
        ruleId: "b",
        name: "B",
        description: "Rule B",
        cooldownMs: 60000,
        callTypes: ["discovery"],
        severity: "medium",
        detect: () => true,
      };
      const engine = new RulesEngine([ruleA, ruleB]);

      const first = engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
      expect(first.map((r) => r.ruleId).sort()).toEqual(["a", "b"]);

      // ruleA won't detect, ruleB in cooldown
      const second = engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
      expect(second).toHaveLength(0);
    });
  });

  // AC: resetCooldowns() clears all tracking
  describe("resetCooldowns()", () => {
    it("allows all rules to trigger again after reset", () => {
      const rule: CoachingRule = {
        ruleId: "reset-test",
        name: "Reset Test",
        description: "Tests reset",
        cooldownMs: 60000,
        callTypes: ["discovery"],
        severity: "medium",
        detect: () => true,
      };
      const engine = new RulesEngine([rule]);

      engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
      expect(engine.evaluate({ speaker: 'rep' as const, text: '' }, [])).toHaveLength(0);

      engine.resetCooldowns();
      expect(engine.evaluate({ speaker: 'rep' as const, text: '' }, [])).toHaveLength(1);
    });

    it("resets cooldowns for multiple rules at once", () => {
      const rules: CoachingRule[] = [
        { ruleId: "x", name: "X", description: "X", cooldownMs: 60000, callTypes: ["discovery"], severity: "medium", detect: () => true },
        { ruleId: "y", name: "Y", description: "Y", cooldownMs: 60000, callTypes: ["discovery"], severity: "medium", detect: () => true },
        { ruleId: "z", name: "Z", description: "Z", cooldownMs: 60000, callTypes: ["discovery"], severity: "medium", detect: () => true },
      ];
      const engine = new RulesEngine(rules);

      engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
      expect(engine.evaluate({ speaker: 'rep' as const, text: '' }, [])).toHaveLength(0);

      engine.resetCooldowns();
      const result = engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
      expect(result).toHaveLength(3);
    });

    it("does not throw on fresh engine", () => {
      const engine = new RulesEngine([]);
      expect(() => engine.resetCooldowns()).not.toThrow();
    });
  });

  // Integration: RulesEngine with real coaching rules
  describe("integration: RulesEngine + real coaching rules", () => {
    it("evaluates real rules and returns correct triggered set", () => {
      const engine = new RulesEngine(coachingRules);

      // Window: 8/10 rep (80%), 4+ consecutive, no questions → talk-ratio, long-monologue, no-questions
      const window = makeLines([
        { speaker: "rep", text: "First." },
        { speaker: "rep", text: "Second." },
        { speaker: "rep", text: "Third." },
        { speaker: "rep", text: "Fourth." },
        { speaker: "rep", text: "Fifth." },
        { speaker: "rep", text: "Sixth." },
        { speaker: "rep", text: "Seventh." },
        { speaker: "rep", text: "Eighth." },
        { speaker: "prospect", text: "OK" },
        { speaker: "prospect", text: "Hmm" },
      ]);

      const triggered = engine.evaluate(window[window.length - 1], window);
      const ids = triggered.map((r) => r.ruleId);
      expect(ids).toContain("talk-ratio");
      expect(ids).toContain("long-monologue");
      expect(ids).toContain("no-questions");
    });

    it("cooldowns prevent re-triggering in second evaluate call", () => {
      const engine = new RulesEngine(coachingRules);

      const window = makeLines([
        { speaker: "rep", text: "First." },
        { speaker: "rep", text: "Second." },
        { speaker: "rep", text: "Third." },
        { speaker: "rep", text: "Fourth." },
        { speaker: "rep", text: "Fifth." },
        { speaker: "rep", text: "Sixth." },
        { speaker: "rep", text: "Seventh." },
        { speaker: "rep", text: "Eighth." },
        { speaker: "prospect", text: "OK" },
        { speaker: "prospect", text: "Hmm" },
      ]);

      const first = engine.evaluate(window[window.length - 1], window);
      expect(first.length).toBeGreaterThan(0);

      const second = engine.evaluate(window[window.length - 1], window);
      // All previously triggered rules should be in cooldown
      for (const rule of first) {
        expect(second.map((r) => r.ruleId)).not.toContain(rule.ruleId);
      }
    });

    it("resetCooldowns allows re-trigger with real rules", () => {
      const engine = new RulesEngine(coachingRules);

      const window = makeLines([
        { speaker: "rep", text: "First." },
        { speaker: "rep", text: "Second." },
        { speaker: "rep", text: "Third." },
        { speaker: "rep", text: "Fourth." },
        { speaker: "rep", text: "Fifth." },
        { speaker: "rep", text: "Sixth." },
        { speaker: "rep", text: "Seventh." },
        { speaker: "rep", text: "Eighth." },
        { speaker: "prospect", text: "OK" },
        { speaker: "prospect", text: "Hmm" },
      ]);

      const first = engine.evaluate(window[window.length - 1], window);
      const firstIds = first.map((r) => r.ruleId);

      engine.resetCooldowns();
      const afterReset = engine.evaluate(window[window.length - 1], window);
      const afterIds = afterReset.map((r) => r.ruleId);

      for (const id of firstIds) {
        expect(afterIds).toContain(id);
      }
    });
  });
});
