import { coachingRules } from "@/rules/coaching-rules";
import { RulesEngine } from "@/services/rules-engine";
import { TranscriptLine } from "@/types";

function makeLines(
  specs: Array<{ speaker: "rep" | "prospect"; text: string }>
): TranscriptLine[] {
  return specs.map((s) => ({ speaker: s.speaker, text: s.text }));
}

function getRule(ruleId: string) {
  const rule = coachingRules.find((r) => r.ruleId === ruleId);
  if (!rule) throw new Error(`Rule not found: ${ruleId}`);
  return rule;
}

describe("QA TICKET-005 — edge cases", () => {
  describe("talk-ratio boundary", () => {
    const rule = getRule("talk-ratio");

    it("does NOT trigger at exactly 65% (spec says >65%)", () => {
      // 13 rep, 7 prospect = 65% exactly
      const window = makeLines([
        ...Array(13).fill({ speaker: "rep" as const, text: "Talk" }),
        ...Array(7).fill({ speaker: "prospect" as const, text: "Listen" }),
      ]);
      expect(window.length).toBe(20);
      expect(rule.detect(window)).toBe(false);
    });

    it("triggers at 66% (just above threshold)", () => {
      // 2 rep, 1 prospect in a 3-line window = 66.7%
      const window = makeLines([
        { speaker: "rep", text: "A" },
        { speaker: "rep", text: "B" },
        { speaker: "prospect", text: "C" },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger with a single prospect line (0% rep)", () => {
      const window = makeLines([{ speaker: "prospect", text: "Hello" }]);
      expect(rule.detect(window)).toBe(false);
    });

    it("triggers with a single rep line (100% rep)", () => {
      const window = makeLines([{ speaker: "rep", text: "Hello" }]);
      expect(rule.detect(window)).toBe(true);
    });
  });

  describe("long-monologue edge cases", () => {
    const rule = getRule("long-monologue");

    it("triggers at exactly 4 consecutive rep lines", () => {
      const window = makeLines([
        { speaker: "rep", text: "1" },
        { speaker: "rep", text: "2" },
        { speaker: "rep", text: "3" },
        { speaker: "rep", text: "4" },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger at exactly 3 consecutive rep lines", () => {
      const window = makeLines([
        { speaker: "rep", text: "1" },
        { speaker: "rep", text: "2" },
        { speaker: "rep", text: "3" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("detects monologue in the middle of the window", () => {
      const window = makeLines([
        { speaker: "prospect", text: "Go ahead" },
        { speaker: "rep", text: "1" },
        { speaker: "rep", text: "2" },
        { speaker: "rep", text: "3" },
        { speaker: "rep", text: "4" },
        { speaker: "prospect", text: "I see" },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger on empty window", () => {
      expect(rule.detect([])).toBe(false);
    });
  });

  describe("no-questions edge cases", () => {
    const rule = getRule("no-questions");

    it("does not trigger on empty window", () => {
      expect(rule.detect([])).toBe(false);
    });

    it("prospect question marks don't prevent triggering", () => {
      const window = makeLines([
        { speaker: "rep", text: "Let me explain our product." },
        { speaker: "prospect", text: "What does it do?" },
        { speaker: "rep", text: "It handles everything." },
      ]);
      // Rep lines have no question marks, prospect does — rule should trigger
      expect(rule.detect(window)).toBe(true);
    });
  });

  describe("filler-words edge cases", () => {
    const rule = getRule("filler-words");

    it("does not trigger when no rep lines exist", () => {
      const window = makeLines([
        { speaker: "prospect", text: "um like basically tell me" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger on empty window", () => {
      expect(rule.detect([])).toBe(false);
    });

    it("counts repeated filler words correctly", () => {
      // "um" appears 3 times
      const window = makeLines([
        { speaker: "rep", text: "um um um I think so" },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("handles 'like' correctly as a filler word", () => {
      // "like" 3 times
      const window = makeLines([
        { speaker: "rep", text: "It's like, like, like really good" },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not false-positive on words containing filler substrings", () => {
      // "likely" contains "like" but should use word-boundary matching
      // "right" in "righteous" should not match — but "right" is single-word
      // This test verifies word-boundary for single-word fillers
      const window = makeLines([
        { speaker: "rep", text: "That is unlikely and the rights are clear" },
      ]);
      // "unlikely" should not match "like" (word boundary), "rights" should not match "right"
      expect(rule.detect(window)).toBe(false);
    });
  });

  describe("feature-dump edge cases", () => {
    const rule = getRule("feature-dump");

    it("does not trigger when rep lines lack feature keywords", () => {
      const window = makeLines([
        { speaker: "rep", text: "Hello there." },
        { speaker: "rep", text: "Nice weather today." },
        { speaker: "rep", text: "How are you doing." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("resets count when rep line has feature keyword but also a question", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our platform is great." },
        { speaker: "rep", text: "The dashboard is powerful." },
        { speaker: "rep", text: "Want to see the integration?" },
        { speaker: "rep", text: "The analytics are amazing." },
      ]);
      // 3rd line has "?" so streak resets, only 1 after reset
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger on empty window", () => {
      expect(rule.detect([])).toBe(false);
    });
  });

  describe("no-next-steps edge cases", () => {
    const rule = getRule("no-next-steps");

    it("does not trigger on empty window", () => {
      expect(rule.detect([])).toBe(false);
    });

    it("does NOT match 'not interested' due to negative lookahead", () => {
      const window = makeLines([
        { speaker: "prospect", text: "I'm not interested in that." },
        { speaker: "rep", text: "OK, let me explain more." },
        { speaker: "rep", text: "It has many benefits." },
      ]);
      // "not interested" should NOT be detected as interest
      expect(rule.detect(window)).toBe(false);
    });

    it("detects 'follow up' as a next step keyword", () => {
      const window = makeLines([
        { speaker: "prospect", text: "Yes, that sounds great!" },
        { speaker: "rep", text: "I'll follow up with you next week." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("detects 'send' as a next step keyword", () => {
      const window = makeLines([
        { speaker: "prospect", text: "Absolutely, I'm interested." },
        { speaker: "rep", text: "I'll send you the proposal today." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("works correctly with exactly 5 lines", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our product is excellent." },
        { speaker: "prospect", text: "Sounds good, I'm interested." },
        { speaker: "rep", text: "It saves time." },
        { speaker: "rep", text: "Many customers love it." },
        { speaker: "rep", text: "Very popular." },
      ]);
      // Prospect shows interest, no next step from rep
      expect(rule.detect(window)).toBe(true);
    });

    it("works with fewer than 5 lines", () => {
      const window = makeLines([
        { speaker: "prospect", text: "Yes, definitely interested." },
        { speaker: "rep", text: "Great, glad to hear that." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });
  });

  describe("RulesEngine edge cases", () => {
    it("handles empty rules array", () => {
      const engine = new RulesEngine([]);
      const evalLines = makeLines([{ speaker: "rep", text: "hi" }]);
      const result = engine.evaluate(evalLines[evalLines.length - 1], evalLines);
      expect(result).toHaveLength(0);
    });

    it("resetCooldowns on fresh engine does not throw", () => {
      const engine = new RulesEngine(coachingRules);
      expect(() => engine.resetCooldowns()).not.toThrow();
    });

    it("multiple evaluate calls without cooldown issue track each rule independently", () => {
      const engine = new RulesEngine(coachingRules);

      // Window that triggers talk-ratio and no-questions (8/10 rep, no questions)
      const window = makeLines([
        { speaker: "rep", text: "First line." },
        { speaker: "rep", text: "Second line." },
        { speaker: "rep", text: "Third line." },
        { speaker: "rep", text: "Fourth line." },
        { speaker: "rep", text: "Fifth line." },
        { speaker: "rep", text: "Sixth line." },
        { speaker: "prospect", text: "OK" },
        { speaker: "rep", text: "Seventh line." },
        { speaker: "rep", text: "Eighth line." },
        { speaker: "prospect", text: "Hmm" },
      ]);

      const first = engine.evaluate(window[window.length - 1], window);
      const firstIds = first.map((r) => r.ruleId);

      // Second call — same rules should be in cooldown
      const second = engine.evaluate(window[window.length - 1], window);
      // All previously triggered rules should now be suppressed
      for (const id of firstIds) {
        expect(second.map((r) => r.ruleId)).not.toContain(id);
      }

      // Reset and re-evaluate — should trigger again
      engine.resetCooldowns();
      const third = engine.evaluate(window[window.length - 1], window);
      const thirdIds = third.map((r) => r.ruleId);
      for (const id of firstIds) {
        expect(thirdIds).toContain(id);
      }
    });
  });
});
