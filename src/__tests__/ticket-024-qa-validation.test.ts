/**
 * TICKET-024 QA Validation — Test Agent
 * Validates all acceptance criteria independently.
 */
import { coachingRules } from "@/rules/coaching-rules";
import { RulesEngine } from "@/services/rules-engine";
import { TranscriptLine, CallType, Severity } from "@/types";

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

describe("TICKET-024 QA: acceptance criteria validation", () => {
  // ─── AC1: All coaching rules implemented and active in RulesEngine ───

  describe("AC1: all coaching rules active in RulesEngine", () => {
    it("RulesEngine loads all 8 coaching rules and evaluates them", () => {
      const engine = new RulesEngine(coachingRules);
      // A window that triggers talk-ratio (>65% rep lines)
      const window = makeLines([
        { speaker: "rep", text: "Let me start." },
        { speaker: "rep", text: "Our product is great." },
        { speaker: "rep", text: "It does many things." },
        { speaker: "rep", text: "Very powerful." },
        { speaker: "rep", text: "Really amazing." },
        { speaker: "rep", text: "Incredible stuff." },
        { speaker: "rep", text: "Best in class." },
        { speaker: "prospect", text: "OK." },
      ]);
      const triggered = engine.evaluate(window);
      // Should trigger at least talk-ratio
      const ruleIds = triggered.map((r) => r.ruleId);
      expect(ruleIds).toContain("talk-ratio");
    });

    it("all rules have ruleId, name, description, cooldownMs, detect, callTypes, severity", () => {
      const validCallTypes: CallType[] = ["discovery", "demo", "objection-handling", "follow-up"];
      const validSeverities: Severity[] = ["low", "medium", "high"];

      for (const rule of coachingRules) {
        expect(typeof rule.ruleId).toBe("string");
        expect(typeof rule.name).toBe("string");
        expect(typeof rule.description).toBe("string");
        expect(typeof rule.cooldownMs).toBe("number");
        expect(rule.cooldownMs).toBeGreaterThan(0);
        expect(typeof rule.detect).toBe("function");
        expect(Array.isArray(rule.callTypes)).toBe(true);
        expect(rule.callTypes.length).toBeGreaterThan(0);
        rule.callTypes.forEach((ct) => expect(validCallTypes).toContain(ct));
        expect(validSeverities).toContain(rule.severity);
      }
    });

    it("exports exactly these 8 rule IDs", () => {
      const ids = coachingRules.map((r) => r.ruleId).sort();
      expect(ids).toEqual([
        "competitor-not-explored",
        "feature-dump",
        "filler-words",
        "long-monologue",
        "no-next-steps",
        "no-questions",
        "objection-deflected",
        "talk-ratio",
      ]);
    });
  });

  // ─── AC2: no-questions detects what/how/why phrasing ───

  describe("AC2: no-questions detects question words", () => {
    const rule = getRule("no-questions");

    it("does NOT trigger when rep uses 'what' without question mark", () => {
      const w = makeLines([
        { speaker: "rep", text: "Let me understand what your team needs." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does NOT trigger when rep uses 'how' without question mark", () => {
      const w = makeLines([
        { speaker: "rep", text: "I'd like to know how you handle onboarding." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does NOT trigger when rep uses 'why' without question mark", () => {
      const w = makeLines([
        { speaker: "rep", text: "Tell me why that became important." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("triggers when rep has no question marks AND no question words", () => {
      const w = makeLines([
        { speaker: "rep", text: "Our product is amazing." },
        { speaker: "rep", text: "It does everything." },
        { speaker: "rep", text: "You will love it." },
      ]);
      expect(rule.detect(w)).toBe(true);
    });
  });

  // ─── AC3: no-next-steps has midpoint check ───

  describe("AC3: no-next-steps midpoint check", () => {
    const rule = getRule("no-next-steps");

    it("detects missed opportunity at midpoint even when last 5 lines are clean", () => {
      const w = makeLines([
        { speaker: "rep", text: "Here's what we offer." },
        { speaker: "prospect", text: "OK." },
        { speaker: "rep", text: "We have analytics." },
        { speaker: "prospect", text: "Sounds great, definitely interested." }, // midpoint interest
        { speaker: "rep", text: "Cool. So we also have reports." },
        { speaker: "rep", text: "And dashboards." },
        // last 5: no interest, no trigger from last-5 check
        { speaker: "prospect", text: "Noted." },
        { speaker: "rep", text: "We also have a mobile app." },
        { speaker: "prospect", text: "OK." },
        { speaker: "rep", text: "And an API." },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not fire midpoint check when window is too short", () => {
      // Window of 5 lines — below the 6-line threshold for midpoint
      // No interest patterns anywhere => no trigger
      const w = makeLines([
        { speaker: "rep", text: "Let me show you." },
        { speaker: "prospect", text: "Hmm." },
        { speaker: "rep", text: "Here is the feature." },
        { speaker: "prospect", text: "I see." },
        { speaker: "rep", text: "Alright that wraps it up." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });
  });

  // ─── AC4: All rules have callTypes and severity ───

  describe("AC4: callTypes and severity on every rule", () => {
    it("every rule has a non-empty callTypes array", () => {
      for (const rule of coachingRules) {
        expect(rule.callTypes.length).toBeGreaterThan(0);
      }
    });

    it("every rule has a valid severity", () => {
      for (const rule of coachingRules) {
        expect(["low", "medium", "high"]).toContain(rule.severity);
      }
    });
  });

  // ─── AC5: Hedging language covers new phrases ───

  describe("AC5: filler-words covers hedging phrases", () => {
    const rule = getRule("filler-words");

    it("counts 'i think maybe' as filler", () => {
      // "i think maybe" + "um" + "basically" = 3
      const w = makeLines([
        { speaker: "rep", text: "I think maybe um, basically it works." },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("counts 'sort of' as filler", () => {
      // "sort of" + "like" + "you know" = 3
      const w = makeLines([
        { speaker: "rep", text: "It's sort of like, you know, a CRM." },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not trigger below threshold even with hedging phrases", () => {
      // "sort of" alone = 1 filler phrase — below threshold of 3
      const w = makeLines([
        { speaker: "rep", text: "It sort of does analytics." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });
  });

  // ─── AC6: Full test coverage for new rules ───

  describe("AC6: objection-deflected rule", () => {
    const rule = getRule("objection-deflected");

    it("triggers when objection is not addressed", () => {
      const w = makeLines([
        { speaker: "prospect", text: "That's too expensive for us." },
        { speaker: "rep", text: "So anyway, let me show you more features." },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not trigger when objection is addressed with 'I understand'", () => {
      const w = makeLines([
        { speaker: "prospect", text: "We don't need this right now." },
        { speaker: "rep", text: "I understand. Let me share some data on ROI." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("handles multiple objections — triggers only if at least one is unaddressed", () => {
      const w = makeLines([
        { speaker: "prospect", text: "That's too expensive." },
        { speaker: "rep", text: "I understand your concern about pricing." },
        { speaker: "prospect", text: "Also we already have a solution." },
        { speaker: "rep", text: "Let me show you the dashboard." },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not trigger when no objection patterns are present", () => {
      const w = makeLines([
        { speaker: "prospect", text: "That sounds interesting." },
        { speaker: "rep", text: "Great, let me continue." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });
  });

  describe("AC6: competitor-not-explored rule", () => {
    const rule = getRule("competitor-not-explored");

    it("triggers when competitor mentioned but not explored", () => {
      const w = makeLines([
        { speaker: "prospect", text: "We're currently using Salesforce." },
        { speaker: "rep", text: "Our tool has better features." },
      ]);
      expect(rule.detect(w)).toBe(true);
    });

    it("does not trigger when rep asks about the competitor", () => {
      const w = makeLines([
        { speaker: "prospect", text: "We're evaluating some alternatives." },
        { speaker: "rep", text: "Tell me about your experience with what you've seen so far." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("does not trigger when no competitor is mentioned", () => {
      const w = makeLines([
        { speaker: "prospect", text: "We need better analytics." },
        { speaker: "rep", text: "We have great analytics." },
      ]);
      expect(rule.detect(w)).toBe(false);
    });

    it("handles prospect as last line — no subsequent rep lines to evaluate", () => {
      const w = makeLines([
        { speaker: "rep", text: "Let me know your thoughts." },
        { speaker: "prospect", text: "We're considering other options." },
      ]);
      // Prospect is last, no rep response yet — rule should NOT trigger
      // (the detect looks for subsequent rep lines; if none, it continues)
      expect(rule.detect(w)).toBe(false);
    });
  });

  // ─── Integration: RulesEngine evaluates all rules together ───

  describe("Integration: RulesEngine evaluates rules correctly", () => {
    it("triggers multiple rules on a bad sales window", () => {
      const engine = new RulesEngine(coachingRules);
      // 10-line window: all rep, no questions, feature keywords, monologue
      const w = makeLines([
        { speaker: "rep", text: "Our platform has amazing features." },
        { speaker: "rep", text: "The product has great analytics." },
        { speaker: "rep", text: "Our solution includes a dashboard." },
        { speaker: "rep", text: "The tool also has integrations." },
        { speaker: "rep", text: "And the system is very fast." },
        { speaker: "rep", text: "We also have enterprise plans." },
        { speaker: "rep", text: "Plus pricing is competitive." },
        { speaker: "rep", text: "Our software is the best." },
        { speaker: "rep", text: "Literally the top product." },
        { speaker: "prospect", text: "OK." },
      ]);
      const triggered = engine.evaluate(w);
      const ids = triggered.map((r) => r.ruleId);
      // Should trigger: talk-ratio, long-monologue, no-questions, feature-dump
      expect(ids).toContain("talk-ratio");
      expect(ids).toContain("long-monologue");
      expect(ids).toContain("no-questions");
      expect(ids).toContain("feature-dump");
    });

    it("respects cooldown — same rule does not trigger twice within cooldown", () => {
      const engine = new RulesEngine(coachingRules);
      const w = makeLines([
        { speaker: "rep", text: "Our product is great." },
        { speaker: "rep", text: "Really amazing stuff." },
        { speaker: "rep", text: "The best out there." },
        { speaker: "rep", text: "Nothing compares." },
        { speaker: "rep", text: "Top of the line." },
        { speaker: "rep", text: "Incredible." },
        { speaker: "rep", text: "Powerful." },
        { speaker: "rep", text: "World class." },
        { speaker: "prospect", text: "OK." },
      ]);
      const first = engine.evaluate(w);
      const second = engine.evaluate(w);
      // Same window — rules already triggered and within cooldown
      const firstIds = first.map((r) => r.ruleId);
      const secondIds = second.map((r) => r.ruleId);
      expect(firstIds.length).toBeGreaterThan(0);
      expect(secondIds.length).toBe(0);
    });
  });
});
