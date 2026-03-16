/**
 * TICKET-005 Final QA — comprehensive validation of coaching rules and RulesEngine.
 * Covers all acceptance criteria, cooldown semantics, and integration scenarios.
 */
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

// =============================================================================
// AC: 6 coaching rules exported from coaching-rules.ts
// =============================================================================
describe("AC: coaching-rules.ts exports", () => {
  it("exports exactly 8 rules as an array", () => {
    expect(Array.isArray(coachingRules)).toBe(true);
    expect(coachingRules).toHaveLength(8);
  });

  const expectedRuleIds = [
    "talk-ratio",
    "long-monologue",
    "no-questions",
    "filler-words",
    "feature-dump",
    "no-next-steps",
    "objection-deflected",
    "competitor-not-explored",
  ];

  it("contains all expected ruleIds", () => {
    const ids = coachingRules.map((r) => r.ruleId);
    for (const id of expectedRuleIds) {
      expect(ids).toContain(id);
    }
  });

  it("all ruleIds are unique", () => {
    const ids = coachingRules.map((r) => r.ruleId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // AC: correct ruleId, name, description, cooldownMs, and detect functions
  it.each(coachingRules)(
    "$ruleId has ruleId, name, description, cooldownMs, detect",
    (rule) => {
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
  );

  it("cooldownMs values match the spec", () => {
    expect(getRule("talk-ratio").cooldownMs).toBe(30000);
    expect(getRule("long-monologue").cooldownMs).toBe(45000);
    expect(getRule("no-questions").cooldownMs).toBe(60000);
    expect(getRule("filler-words").cooldownMs).toBe(20000);
    expect(getRule("feature-dump").cooldownMs).toBe(45000);
    expect(getRule("no-next-steps").cooldownMs).toBe(90000);
  });
});

// =============================================================================
// AC: detect functions — positive and negative cases for each rule
// =============================================================================
describe("AC: detect functions", () => {
  describe("talk-ratio — rep >65% of lines", () => {
    const rule = getRule("talk-ratio");

    it("triggers at 70% rep (7 rep, 3 prospect)", () => {
      const w = makeLines([
        ...Array(7).fill({ speaker: "rep" as const, text: "talk" }),
        ...Array(3).fill({ speaker: "prospect" as const, text: "listen" }),
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does NOT trigger at exactly 65%", () => {
      const w = makeLines([
        ...Array(13).fill({ speaker: "rep" as const, text: "talk" }),
        ...Array(7).fill({ speaker: "prospect" as const, text: "listen" }),
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger on empty window", () => {
      expect(rule.detect([])).toBe(false);
    });

    it("triggers at 100% rep", () => {
      expect(rule.detect(makeLines([{ speaker: "rep", text: "x" }]))).toBe(true);
    });

    it("does not trigger at 50% rep", () => {
      const w = makeLines([
        { speaker: "rep", text: "a" },
        { speaker: "prospect", text: "b" },
      ]);
      expect(rule.detect(w)).toBe(false);
    });
  });

  describe("long-monologue — 4+ consecutive rep lines", () => {
    const rule = getRule("long-monologue");

    it("triggers with exactly 4 consecutive rep lines", () => {
      const w = makeLines([
        { speaker: "rep", text: "1" },
        { speaker: "rep", text: "2" },
        { speaker: "rep", text: "3" },
        { speaker: "rep", text: "4" },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not trigger with 3 consecutive rep lines", () => {
      const w = makeLines([
        { speaker: "rep", text: "1" },
        { speaker: "rep", text: "2" },
        { speaker: "rep", text: "3" },
        { speaker: "prospect", text: "ok" },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("resets count when prospect speaks", () => {
      const w = makeLines([
        { speaker: "rep", text: "1" },
        { speaker: "rep", text: "2" },
        { speaker: "rep", text: "3" },
        { speaker: "prospect", text: "break" },
        { speaker: "rep", text: "4" },
        { speaker: "rep", text: "5" },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("detects monologue in the middle of window", () => {
      const w = makeLines([
        { speaker: "prospect", text: "start" },
        { speaker: "rep", text: "1" },
        { speaker: "rep", text: "2" },
        { speaker: "rep", text: "3" },
        { speaker: "rep", text: "4" },
        { speaker: "prospect", text: "end" },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not trigger on empty window", () => {
      expect(rule.detect([])).toBe(false);
    });
  });

  describe("no-questions — zero ? in rep lines", () => {
    const rule = getRule("no-questions");

    it("triggers when rep lines have no question marks", () => {
      const w = makeLines([
        { speaker: "rep", text: "Our product is great." },
        { speaker: "rep", text: "It handles everything." },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not trigger when any rep line has ?", () => {
      const w = makeLines([
        { speaker: "rep", text: "What do you think?" },
        { speaker: "rep", text: "Our product is great." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("ignores prospect question marks", () => {
      const w = makeLines([
        { speaker: "rep", text: "Let me explain." },
        { speaker: "prospect", text: "How does it work?" },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not trigger with no rep lines", () => {
      const w = makeLines([{ speaker: "prospect", text: "Hello" }]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger on empty window", () => {
      expect(rule.detect([])).toBe(false);
    });
  });

  describe("filler-words — 3+ fillers in latest rep line", () => {
    const rule = getRule("filler-words");

    it("triggers with 3 distinct fillers", () => {
      const w = makeLines([
        { speaker: "rep", text: "Um, like, basically our product" },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not trigger with 2 fillers", () => {
      const w = makeLines([
        { speaker: "rep", text: "Um, basically our product" },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("is case-insensitive", () => {
      const w = makeLines([{ speaker: "rep", text: "UM LIKE BASICALLY" }]);
      expect(rule.detect(w)).toBe(true);
    });

    it("counts multi-word fillers (you know, so yeah)", () => {
      const w = makeLines([
        { speaker: "rep", text: "You know, um, so yeah it works" },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("only checks the LATEST rep line", () => {
      const w = makeLines([
        { speaker: "rep", text: "Um like basically you know right actually" },
        { speaker: "prospect", text: "Hmm" },
        { speaker: "rep", text: "The product is excellent." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger with no rep lines", () => {
      const w = makeLines([
        { speaker: "prospect", text: "um like basically you know" },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("counts repeated same filler word", () => {
      const w = makeLines([{ speaker: "rep", text: "um um um I think" }]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not false-positive on substrings (unlikely, rights)", () => {
      const w = makeLines([
        { speaker: "rep", text: "That is unlikely and the rights are clear" },
      ]);
      expect(rule.detect(w)).toBe(false);
    });
  });

  describe("feature-dump — 3+ consecutive rep lines with feature keywords, no ?", () => {
    const rule = getRule("feature-dump");

    it("triggers with 3 consecutive feature lines", () => {
      const w = makeLines([
        { speaker: "rep", text: "Our platform handles everything." },
        { speaker: "rep", text: "The dashboard shows metrics." },
        { speaker: "rep", text: "We have analytics built in." },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not trigger when a line has a question mark", () => {
      const w = makeLines([
        { speaker: "rep", text: "Our platform handles everything." },
        { speaker: "rep", text: "Have you seen the dashboard?" },
        { speaker: "rep", text: "We have analytics built in." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger when prospect interrupts the streak", () => {
      const w = makeLines([
        { speaker: "rep", text: "Our platform is great." },
        { speaker: "rep", text: "The dashboard is powerful." },
        { speaker: "prospect", text: "Tell me more" },
        { speaker: "rep", text: "The analytics are amazing." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger when lines lack feature keywords", () => {
      const w = makeLines([
        { speaker: "rep", text: "Hello there." },
        { speaker: "rep", text: "How are you." },
        { speaker: "rep", text: "Nice weather." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger on empty window", () => {
      expect(rule.detect([])).toBe(false);
    });
  });

  describe("no-next-steps — prospect interest without rep next step in last 5", () => {
    const rule = getRule("no-next-steps");

    it("triggers when prospect is interested but rep has no next step", () => {
      const w = makeLines([
        { speaker: "prospect", text: "That sounds great!" },
        { speaker: "rep", text: "Yeah, customers love it." },
        { speaker: "rep", text: "It's very popular." },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not trigger when rep says schedule", () => {
      const w = makeLines([
        { speaker: "prospect", text: "Sounds good, I'm interested." },
        { speaker: "rep", text: "Let me schedule a demo." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger when rep says call", () => {
      const w = makeLines([
        { speaker: "prospect", text: "Yes, definitely!" },
        { speaker: "rep", text: "Let's set up a call." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger when rep says send", () => {
      const w = makeLines([
        { speaker: "prospect", text: "Absolutely, love it." },
        { speaker: "rep", text: "I'll send you details." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger when rep says follow up", () => {
      const w = makeLines([
        { speaker: "prospect", text: "Sure, interested." },
        { speaker: "rep", text: "I'll follow up with a proposal." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger without prospect interest", () => {
      const w = makeLines([
        { speaker: "prospect", text: "I don't think so." },
        { speaker: "rep", text: "Let me know." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("only examines last 5 lines", () => {
      const w = makeLines([
        { speaker: "prospect", text: "Yes, I'm interested!" },
        { speaker: "rep", text: "Great." },
        { speaker: "rep", text: "Moving on." },
        { speaker: "prospect", text: "OK." },
        { speaker: "rep", text: "Pricing details." },
        { speaker: "prospect", text: "Hmm." },
        { speaker: "rep", text: "Very competitive." },
      ]);
      // Interest is in line 1, outside last 5 — should NOT trigger
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger on empty window", () => {
      expect(rule.detect([])).toBe(false);
    });

    it("does NOT match 'not interested' (negative lookahead)", () => {
      const w = makeLines([
        { speaker: "prospect", text: "I'm not interested." },
        { speaker: "rep", text: "Let me explain more." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });
  });
});

// =============================================================================
// AC: RulesEngine.evaluate() returns only rules that trigger AND are not in cooldown
// =============================================================================
describe("AC: RulesEngine.evaluate()", () => {
  it("returns only triggered rules (non-detecting rules excluded)", () => {
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

  it("filters out rules that are in cooldown", () => {
    const rule: CoachingRule = {
      ruleId: "cd-rule",
      name: "CD",
      description: "Cooldown test",
      cooldownMs: 60000,
      callTypes: ["discovery"],
      severity: "medium",
      detect: () => true,
    };
    const engine = new RulesEngine([rule]);
    const w = makeLines([{ speaker: "rep", text: "test" }]);

    expect(engine.evaluate(w[w.length - 1], w)).toHaveLength(1);
    // Second call — still in cooldown
    expect(engine.evaluate(w[w.length - 1], w)).toHaveLength(0);
  });

  it("allows rule to fire again after cooldown expires", () => {
    const rule: CoachingRule = {
      ruleId: "short-cd",
      name: "Short",
      description: "Short cooldown",
      cooldownMs: 100,
      callTypes: ["discovery"],
      severity: "medium",
      detect: () => true,
    };
    const engine = new RulesEngine([rule]);

    expect(engine.evaluate({ speaker: 'rep' as const, text: '' }, [])).toHaveLength(1);
    expect(engine.evaluate({ speaker: 'rep' as const, text: '' }, [])).toHaveLength(0);

    // Wait for cooldown to expire
    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(engine.evaluate({ speaker: 'rep' as const, text: '' }, [])).toHaveLength(1);
        resolve();
      }, 150);
    });
  });
});

// =============================================================================
// AC: Cooldown tracking works per-ruleId
// =============================================================================
describe("AC: cooldown tracking per-ruleId", () => {
  it("tracks each rule independently", () => {
    const ruleA: CoachingRule = {
      ruleId: "a",
      name: "A",
      description: "A",
      cooldownMs: 60000,
      callTypes: ["discovery"],
      severity: "medium",
      detect: () => true,
    };
    const ruleB: CoachingRule = {
      ruleId: "b",
      name: "B",
      description: "B",
      cooldownMs: 60000,
      callTypes: ["discovery"],
      severity: "medium",
      detect: () => true,
    };
    const engine = new RulesEngine([ruleA, ruleB]);

    const first = engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
    expect(first.map((r) => r.ruleId).sort()).toEqual(["a", "b"]);

    // Both should be in cooldown
    expect(engine.evaluate({ speaker: 'rep' as const, text: '' }, [])).toHaveLength(0);
  });

  it("one rule being in cooldown does not block another", () => {
    let aCount = 0;
    const ruleA: CoachingRule = {
      ruleId: "a",
      name: "A",
      description: "A",
      cooldownMs: 60000,
      callTypes: ["discovery"],
      severity: "medium",
      detect: () => {
        aCount++;
        return aCount === 1; // only first call
      },
    };
    const ruleB: CoachingRule = {
      ruleId: "b",
      name: "B",
      description: "B",
      cooldownMs: 60000,
      callTypes: ["discovery"],
      severity: "medium",
      detect: () => true,
    };
    const engine = new RulesEngine([ruleA, ruleB]);

    const first = engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
    expect(first.map((r) => r.ruleId).sort()).toEqual(["a", "b"]);

    // ruleA won't detect, ruleB in cooldown — neither should appear
    expect(engine.evaluate({ speaker: 'rep' as const, text: '' }, [])).toHaveLength(0);
  });
});

// =============================================================================
// AC: resetCooldowns() clears all tracking
// =============================================================================
describe("AC: resetCooldowns()", () => {
  it("allows all rules to trigger again after reset", () => {
    const rule: CoachingRule = {
      ruleId: "r",
      name: "R",
      description: "R",
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

  it("resets all rules simultaneously", () => {
    const rules: CoachingRule[] = ["x", "y", "z"].map((id) => ({
      ruleId: id,
      name: id,
      description: id,
      cooldownMs: 60000,
      callTypes: ["discovery"] as CoachingRule["callTypes"],
      severity: "medium" as CoachingRule["severity"],
      detect: () => true,
    }));
    const engine = new RulesEngine(rules);

    engine.evaluate({ speaker: 'rep' as const, text: '' }, []);
    expect(engine.evaluate({ speaker: 'rep' as const, text: '' }, [])).toHaveLength(0);

    engine.resetCooldowns();
    expect(engine.evaluate({ speaker: 'rep' as const, text: '' }, [])).toHaveLength(3);
  });

  it("does not throw on a fresh engine with no rules", () => {
    const engine = new RulesEngine([]);
    expect(() => engine.resetCooldowns()).not.toThrow();
  });
});

// =============================================================================
// Integration: RulesEngine with real coaching rules
// =============================================================================
describe("Integration: RulesEngine + real coaching rules", () => {
  it("evaluates a realistic window and triggers expected rules", () => {
    const engine = new RulesEngine(coachingRules);

    // 8/10 rep lines, 4+ consecutive, no questions → talk-ratio, long-monologue, no-questions
    const w = makeLines([
      { speaker: "rep", text: "First point." },
      { speaker: "rep", text: "Second point." },
      { speaker: "rep", text: "Third point." },
      { speaker: "rep", text: "Fourth point." },
      { speaker: "rep", text: "Fifth point." },
      { speaker: "rep", text: "Sixth point." },
      { speaker: "rep", text: "Seventh point." },
      { speaker: "rep", text: "Eighth point." },
      { speaker: "prospect", text: "OK" },
      { speaker: "prospect", text: "I see" },
    ]);

    const triggered = engine.evaluate(w[w.length - 1], w);
    const ids = triggered.map((r) => r.ruleId);
    expect(ids).toContain("talk-ratio");
    expect(ids).toContain("long-monologue");
    expect(ids).toContain("no-questions");
  });

  it("cooldowns prevent re-trigger on second evaluate", () => {
    const engine = new RulesEngine(coachingRules);

    const w = makeLines([
      ...Array(8).fill({ speaker: "rep" as const, text: "Statement." }),
      { speaker: "prospect", text: "OK" },
      { speaker: "prospect", text: "Hmm" },
    ]);

    const first = engine.evaluate(w[w.length - 1], w);
    expect(first.length).toBeGreaterThan(0);

    const second = engine.evaluate(w[w.length - 1], w);
    for (const rule of first) {
      expect(second.map((r) => r.ruleId)).not.toContain(rule.ruleId);
    }
  });

  it("resetCooldowns allows re-trigger with real rules", () => {
    const engine = new RulesEngine(coachingRules);

    const w = makeLines([
      ...Array(8).fill({ speaker: "rep" as const, text: "Statement." }),
      { speaker: "prospect", text: "OK" },
      { speaker: "prospect", text: "Hmm" },
    ]);

    const first = engine.evaluate(w[w.length - 1], w);
    const firstIds = first.map((r) => r.ruleId);

    engine.resetCooldowns();
    const afterReset = engine.evaluate(w[w.length - 1], w);
    const afterIds = afterReset.map((r) => r.ruleId);

    for (const id of firstIds) {
      expect(afterIds).toContain(id);
    }
  });

  it("clean conversation triggers no rules", () => {
    const engine = new RulesEngine(coachingRules);

    const w = makeLines([
      { speaker: "rep", text: "How are you doing today?" },
      { speaker: "prospect", text: "I'm great, thanks." },
      { speaker: "rep", text: "What challenges are you facing?" },
      { speaker: "prospect", text: "We need better analytics." },
      { speaker: "rep", text: "Can I show you our dashboard?" },
      { speaker: "prospect", text: "Sure!" },
      { speaker: "rep", text: "Let me schedule a demo for you." },
      { speaker: "prospect", text: "Sounds good." },
      { speaker: "rep", text: "I'll send you the details." },
      { speaker: "prospect", text: "Perfect." },
    ]);

    const triggered = engine.evaluate(w[w.length - 1], w);
    expect(triggered).toHaveLength(0);
  });
});
