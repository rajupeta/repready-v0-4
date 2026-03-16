import { coachingRules } from "@/rules/coaching-rules";
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

describe("TICKET-024: coaching rules — all 8 rules active with callTypes and severity", () => {
  it("exports 8 coaching rules", () => {
    expect(coachingRules).toHaveLength(8);
  });

  it("each rule has required fields including callTypes and severity", () => {
    const validCallTypes: CallType[] = ["discovery", "demo", "objection-handling", "follow-up", "pricing", "cold-call"];
    const validSeverities: Severity[] = ["low", "medium", "high"];

    for (const rule of coachingRules) {
      expect(rule.ruleId).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(typeof rule.cooldownMs).toBe("number");
      expect(typeof rule.detect).toBe("function");
      // New fields
      expect(Array.isArray(rule.callTypes)).toBe(true);
      expect(rule.callTypes.length).toBeGreaterThan(0);
      for (const ct of rule.callTypes) {
        expect(validCallTypes).toContain(ct);
      }
      expect(validSeverities).toContain(rule.severity);
    }
  });

  it("all 8 expected rule IDs are present", () => {
    const ruleIds = coachingRules.map((r) => r.ruleId);
    expect(ruleIds).toContain("talk-ratio");
    expect(ruleIds).toContain("long-monologue");
    expect(ruleIds).toContain("no-questions");
    expect(ruleIds).toContain("filler-words");
    expect(ruleIds).toContain("feature-dump");
    expect(ruleIds).toContain("no-next-steps");
    expect(ruleIds).toContain("objection-deflected");
    expect(ruleIds).toContain("competitor-not-explored");
  });

  // ─── no-questions: now detects what/how/why (not just "?") ───

  describe("no-questions — question word detection", () => {
    const rule = getRule("no-questions");

    it("does not trigger when rep uses 'what' phrasing", () => {
      const window = makeLines([
        { speaker: "rep", text: "Tell me what challenges you face today." },
        { speaker: "prospect", text: "We have scaling issues" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger when rep uses 'how' phrasing", () => {
      const window = makeLines([
        { speaker: "rep", text: "I'd love to understand how your team handles that." },
        { speaker: "prospect", text: "We use spreadsheets" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger when rep uses 'why' phrasing", () => {
      const window = makeLines([
        { speaker: "rep", text: "Can you share why that became a priority." },
        { speaker: "prospect", text: "Leadership pushed it" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger when rep uses 'could you' phrasing", () => {
      const window = makeLines([
        { speaker: "rep", text: "Could you walk me through your current process." },
        { speaker: "prospect", text: "Sure, we start by..." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("still triggers when rep has no questions and no question words", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our product is amazing." },
        { speaker: "prospect", text: "OK" },
        { speaker: "rep", text: "It solves all your problems." },
        { speaker: "rep", text: "Very powerful stuff." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("still does not trigger when rep uses a question mark", () => {
      const window = makeLines([
        { speaker: "rep", text: "Interested in a demo?" },
        { speaker: "prospect", text: "Maybe" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("has severity high", () => {
      expect(rule.severity).toBe("high");
    });

    it("has callTypes including discovery", () => {
      expect(rule.callTypes).toContain("discovery");
    });
  });

  // ─── no-next-steps: midpoint check ───

  describe("no-next-steps — midpoint check", () => {
    const rule = getRule("no-next-steps");

    it("triggers on midpoint interest without next steps even when last 5 are clean", () => {
      // 10-line window: interest at midpoint, no next step keywords anywhere
      const window = makeLines([
        { speaker: "rep", text: "Let me tell you about our product." },
        { speaker: "prospect", text: "OK go ahead." },
        { speaker: "rep", text: "We have great analytics." },
        { speaker: "prospect", text: "That sounds great, I'm interested." }, // midpoint interest
        { speaker: "rep", text: "Yeah lots of people love it." },
        { speaker: "rep", text: "It also has reporting." },
        { speaker: "prospect", text: "Hmm tell me more." },
        { speaker: "rep", text: "The reporting is very detailed." },
        { speaker: "prospect", text: "OK." },
        { speaker: "rep", text: "We also have a mobile app." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger on midpoint interest when rep proposes next step at midpoint", () => {
      const window = makeLines([
        { speaker: "rep", text: "Let me tell you about our product." },
        { speaker: "prospect", text: "OK go ahead." },
        { speaker: "rep", text: "We have great analytics." },
        { speaker: "prospect", text: "That sounds great, I'm interested." },
        { speaker: "rep", text: "Let me schedule a demo for you." },
        { speaker: "rep", text: "It also has reporting." },
        { speaker: "prospect", text: "Hmm." },
        { speaker: "rep", text: "The reporting is very detailed." },
        { speaker: "prospect", text: "OK." },
        { speaker: "rep", text: "We also have a mobile app." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("still triggers on last-5 interest without next step", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our product saves 50% of your time." },
        { speaker: "prospect", text: "That sounds great, I'm interested." },
        { speaker: "rep", text: "Yeah it is really popular." },
        { speaker: "rep", text: "Lots of customers love it." },
        { speaker: "rep", text: "It also has a mobile app." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("has severity high", () => {
      expect(rule.severity).toBe("high");
    });
  });

  // ─── filler-words: hedging language ───

  describe("filler-words — hedging language expansion", () => {
    const rule = getRule("filler-words");

    it("detects 'I think maybe' as a filler phrase", () => {
      const window = makeLines([
        { speaker: "rep", text: "I think maybe we could um basically help you." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("detects 'sort of' as a filler phrase", () => {
      const window = makeLines([
        { speaker: "rep", text: "It sort of works like um basically a CRM." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("hedging phrases alone count towards the filler threshold", () => {
      // "i think maybe" (1) + "sort of" (1) + "basically" (1) = 3
      const window = makeLines([
        { speaker: "rep", text: "I think maybe it's sort of basically a good fit." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger with only 1-2 hedging/filler words", () => {
      const window = makeLines([
        { speaker: "rep", text: "I think maybe we can help with that." },
      ]);
      // Only "i think maybe" = 1 filler phrase
      expect(rule.detect(window)).toBe(false);
    });

    it("has severity low", () => {
      expect(rule.severity).toBe("low");
    });
  });

  // ─── objection-deflected: NEW rule ───

  describe("objection-deflected", () => {
    const rule = getRule("objection-deflected");

    it("triggers when prospect raises objection and rep deflects", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our product is $500 per month." },
        { speaker: "prospect", text: "That's too expensive for our budget." },
        { speaker: "rep", text: "Anyway, let me show you more features." },
        { speaker: "rep", text: "We also have a great dashboard." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger when rep addresses the objection", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our product is $500 per month." },
        { speaker: "prospect", text: "That's too expensive for our budget." },
        { speaker: "rep", text: "I understand your concern about pricing. Let me address that." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger when rep acknowledges with 'hear you'", () => {
      const window = makeLines([
        { speaker: "prospect", text: "We can't afford that right now." },
        { speaker: "rep", text: "I hear you. Let me walk through the ROI." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger when there is no objection", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our product is great." },
        { speaker: "prospect", text: "Sounds interesting." },
        { speaker: "rep", text: "Let me show you more." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("triggers on 'not interested' objection without addressing", () => {
      const window = makeLines([
        { speaker: "prospect", text: "We're not interested in changing tools right now." },
        { speaker: "rep", text: "Well our tool has great analytics." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("triggers on 'already have' objection without addressing", () => {
      const window = makeLines([
        { speaker: "prospect", text: "We already have a solution for that." },
        { speaker: "rep", text: "OK, so moving on to another topic." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger when rep uses 'appreciate' to acknowledge", () => {
      const window = makeLines([
        { speaker: "prospect", text: "I don't think this is a priority right now." },
        { speaker: "rep", text: "I appreciate you sharing that. What if we revisited this next quarter?" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("has severity high", () => {
      expect(rule.severity).toBe("high");
    });

    it("has callTypes including objection-handling", () => {
      expect(rule.callTypes).toContain("objection-handling");
    });

    it("has cooldownMs of 60000", () => {
      expect(rule.cooldownMs).toBe(60000);
    });
  });

  // ─── competitor-not-explored: NEW rule ───

  describe("competitor-not-explored", () => {
    const rule = getRule("competitor-not-explored");

    it("triggers when prospect mentions competitor and rep ignores it", () => {
      const window = makeLines([
        { speaker: "prospect", text: "We're also looking at a competitor product." },
        { speaker: "rep", text: "Well, let me tell you about our features." },
        { speaker: "rep", text: "Our dashboard is very powerful." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger when rep explores the competitor mention", () => {
      const window = makeLines([
        { speaker: "prospect", text: "We're currently using Salesforce for this." },
        { speaker: "rep", text: "Interesting — what do you like about your current setup?" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger when rep asks what's missing", () => {
      const window = makeLines([
        { speaker: "prospect", text: "We're evaluating some other options too." },
        { speaker: "rep", text: "Got it. What's missing from the alternatives you've seen?" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("triggers on 'versus' mention without exploration", () => {
      const window = makeLines([
        { speaker: "prospect", text: "How do you compare versus HubSpot?" },
        { speaker: "rep", text: "Our product is the best in the market." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("triggers on 'switched from' mention without exploration", () => {
      const window = makeLines([
        { speaker: "prospect", text: "We recently switched from Zendesk." },
        { speaker: "rep", text: "Great. Our pricing is very competitive." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger when rep asks 'why are you looking'", () => {
      const window = makeLines([
        { speaker: "prospect", text: "We're considering a few alternatives." },
        { speaker: "rep", text: "I see. Why are you looking to switch right now?" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger when no competitor is mentioned", () => {
      const window = makeLines([
        { speaker: "prospect", text: "We need better reporting." },
        { speaker: "rep", text: "Our reporting module is very robust." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("has severity medium", () => {
      expect(rule.severity).toBe("medium");
    });

    it("has callTypes including discovery", () => {
      expect(rule.callTypes).toContain("discovery");
    });

    it("has cooldownMs of 60000", () => {
      expect(rule.cooldownMs).toBe(60000);
    });
  });

  // ─── callTypes and severity for all existing rules ───

  describe("callTypes and severity on all rules", () => {
    it("talk-ratio has callTypes and severity medium", () => {
      const rule = getRule("talk-ratio");
      expect(rule.callTypes).toEqual(["discovery", "demo", "objection-handling", "follow-up", "pricing", "cold-call"]);
      expect(rule.severity).toBe("medium");
    });

    it("long-monologue has callTypes and severity medium", () => {
      const rule = getRule("long-monologue");
      expect(rule.callTypes).toEqual(["discovery", "demo", "objection-handling", "follow-up", "pricing", "cold-call"]);
      expect(rule.severity).toBe("medium");
    });

    it("no-questions has callTypes and severity high", () => {
      const rule = getRule("no-questions");
      expect(rule.callTypes).toEqual(["discovery", "demo", "follow-up", "cold-call"]);
      expect(rule.severity).toBe("high");
    });

    it("filler-words has callTypes and severity low", () => {
      const rule = getRule("filler-words");
      expect(rule.callTypes).toEqual(["discovery", "demo", "objection-handling", "follow-up", "pricing", "cold-call"]);
      expect(rule.severity).toBe("low");
    });

    it("feature-dump has callTypes and severity medium", () => {
      const rule = getRule("feature-dump");
      expect(rule.callTypes).toEqual(["demo", "discovery", "cold-call"]);
      expect(rule.severity).toBe("medium");
    });

    it("no-next-steps has callTypes and severity high", () => {
      const rule = getRule("no-next-steps");
      expect(rule.callTypes).toEqual(["discovery", "demo", "objection-handling", "follow-up", "pricing", "cold-call"]);
      expect(rule.severity).toBe("high");
    });

    it("objection-deflected has callTypes and severity high", () => {
      const rule = getRule("objection-deflected");
      expect(rule.callTypes).toEqual(["objection-handling", "demo", "discovery", "pricing"]);
      expect(rule.severity).toBe("high");
    });

    it("competitor-not-explored has callTypes and severity medium", () => {
      const rule = getRule("competitor-not-explored");
      expect(rule.callTypes).toEqual(["discovery", "demo", "objection-handling", "pricing"]);
      expect(rule.severity).toBe("medium");
    });
  });
});
