import { coachingRules } from "@/rules/coaching-rules";
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

describe("coaching-rules", () => {
  it("exports 8 coaching rules", () => {
    expect(coachingRules).toHaveLength(8);
  });

  it("each rule has required fields", () => {
    for (const rule of coachingRules) {
      expect(rule.ruleId).toBeTruthy();
      expect(rule.name).toBeTruthy();
      expect(rule.description).toBeTruthy();
      expect(typeof rule.cooldownMs).toBe("number");
      expect(typeof rule.detect).toBe("function");
    }
  });

  describe("talk-ratio", () => {
    const rule = getRule("talk-ratio");

    it("has cooldownMs of 30000", () => {
      expect(rule.cooldownMs).toBe(30000);
    });

    it("triggers when rep speaks >65% of lines", () => {
      // 7 rep, 3 prospect = 70% rep
      const window = makeLines([
        { speaker: "rep", text: "Hello" },
        { speaker: "rep", text: "Let me tell you" },
        { speaker: "prospect", text: "Sure" },
        { speaker: "rep", text: "Our product" },
        { speaker: "rep", text: "is great" },
        { speaker: "prospect", text: "OK" },
        { speaker: "rep", text: "and also" },
        { speaker: "rep", text: "we have" },
        { speaker: "prospect", text: "Interesting" },
        { speaker: "rep", text: "many features" },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger when rep speaks <=65%", () => {
      // 6 rep, 4 prospect = 60%
      const window = makeLines([
        { speaker: "rep", text: "Hello" },
        { speaker: "prospect", text: "Hi" },
        { speaker: "rep", text: "How are you" },
        { speaker: "prospect", text: "Good" },
        { speaker: "rep", text: "Great" },
        { speaker: "prospect", text: "Tell me more" },
        { speaker: "rep", text: "Sure" },
        { speaker: "prospect", text: "OK" },
        { speaker: "rep", text: "So" },
        { speaker: "rep", text: "Here it is" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger on empty window", () => {
      expect(rule.detect([])).toBe(false);
    });
  });

  describe("long-monologue", () => {
    const rule = getRule("long-monologue");

    it("has cooldownMs of 45000", () => {
      expect(rule.cooldownMs).toBe(45000);
    });

    it("triggers when rep has 4+ consecutive lines", () => {
      const window = makeLines([
        { speaker: "prospect", text: "Go ahead" },
        { speaker: "rep", text: "First point" },
        { speaker: "rep", text: "Second point" },
        { speaker: "rep", text: "Third point" },
        { speaker: "rep", text: "Fourth point" },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger with fewer than 4 consecutive rep lines", () => {
      const window = makeLines([
        { speaker: "rep", text: "First" },
        { speaker: "rep", text: "Second" },
        { speaker: "rep", text: "Third" },
        { speaker: "prospect", text: "I see" },
        { speaker: "rep", text: "Another" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });
  });

  describe("no-questions", () => {
    const rule = getRule("no-questions");

    it("has cooldownMs of 60000", () => {
      expect(rule.cooldownMs).toBe(60000);
    });

    it("triggers when no rep lines contain question marks", () => {
      const window = makeLines([
        { speaker: "rep", text: "Let me tell you about our product." },
        { speaker: "prospect", text: "OK" },
        { speaker: "rep", text: "It is great." },
        { speaker: "rep", text: "Very powerful." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger when a rep line contains a question mark", () => {
      const window = makeLines([
        { speaker: "rep", text: "What challenges are you facing?" },
        { speaker: "prospect", text: "We have scaling issues" },
        { speaker: "rep", text: "I see, tell me more." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger when there are no rep lines", () => {
      const window = makeLines([
        { speaker: "prospect", text: "Hello" },
        { speaker: "prospect", text: "Anyone there" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });
  });

  describe("filler-words", () => {
    const rule = getRule("filler-words");

    it("has cooldownMs of 20000", () => {
      expect(rule.cooldownMs).toBe(20000);
    });

    it("triggers when latest rep line has 3+ filler words", () => {
      const window = makeLines([
        { speaker: "prospect", text: "Tell me about pricing" },
        {
          speaker: "rep",
          text: "So um basically like our pricing is flexible",
        },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger when latest rep line has fewer than 3 filler words", () => {
      const window = makeLines([
        { speaker: "prospect", text: "Tell me about pricing" },
        { speaker: "rep", text: "So um our pricing is flexible" },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("is case insensitive", () => {
      const window = makeLines([
        { speaker: "rep", text: "UM Like BASICALLY it works" },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("detects multi-word fillers like 'you know' and 'so yeah'", () => {
      const window = makeLines([
        {
          speaker: "rep",
          text: "You know it's basically, so yeah, a great product",
        },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("checks only the latest rep line, not earlier ones", () => {
      const window = makeLines([
        { speaker: "rep", text: "Um like basically you know right" },
        { speaker: "prospect", text: "Interesting" },
        { speaker: "rep", text: "Our pricing is competitive." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });
  });

  describe("feature-dump", () => {
    const rule = getRule("feature-dump");

    it("has cooldownMs of 45000", () => {
      expect(rule.cooldownMs).toBe(45000);
    });

    it("triggers on 3+ consecutive rep lines with feature keywords and no questions", () => {
      const window = makeLines([
        { speaker: "prospect", text: "What do you offer" },
        { speaker: "rep", text: "Our platform has great analytics." },
        { speaker: "rep", text: "The dashboard shows real-time data." },
        { speaker: "rep", text: "Plus our integration with Slack is seamless." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger if a rep line contains a question", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our platform has great analytics." },
        { speaker: "rep", text: "Would you like to see the dashboard?" },
        { speaker: "rep", text: "The integration is seamless." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger if prospect speaks in between", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our platform is great." },
        { speaker: "rep", text: "The dashboard is powerful." },
        { speaker: "prospect", text: "Cool" },
        { speaker: "rep", text: "And the integration works well." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });
  });

  describe("no-next-steps", () => {
    const rule = getRule("no-next-steps");

    it("has cooldownMs of 90000", () => {
      expect(rule.cooldownMs).toBe(90000);
    });

    it("triggers when prospect shows interest but rep has no next step", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our product saves 50% of your time." },
        { speaker: "prospect", text: "That sounds great, I'm interested." },
        { speaker: "rep", text: "Yeah it is really popular." },
        { speaker: "rep", text: "Lots of customers love it." },
        { speaker: "rep", text: "It also has a mobile app." },
      ]);
      expect(rule.detect(window)).toBe(true);
    });

    it("does not trigger when rep proposes a next step", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our product saves 50% of your time." },
        { speaker: "prospect", text: "That sounds great, I'm interested." },
        { speaker: "rep", text: "Let me schedule a demo for you." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("does not trigger when prospect shows no interest", () => {
      const window = makeLines([
        { speaker: "rep", text: "Our product is great." },
        { speaker: "prospect", text: "I'm not sure about that." },
        { speaker: "rep", text: "Let me explain more." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });

    it("only looks at last 5 lines of window", () => {
      const window = makeLines([
        { speaker: "prospect", text: "Yes, I'm interested!" },
        { speaker: "rep", text: "Great." },
        // last 5 below — no interest expressed
        { speaker: "rep", text: "Moving on to pricing." },
        { speaker: "prospect", text: "OK." },
        { speaker: "rep", text: "It costs this much." },
        { speaker: "prospect", text: "Hmm." },
        { speaker: "rep", text: "Very competitive." },
      ]);
      expect(rule.detect(window)).toBe(false);
    });
  });
});
