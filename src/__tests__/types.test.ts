import type {
  TranscriptLine,
  CoachingRule,
  CoachingPrompt,
  Session,
  ScorecardEntry,
  Scorecard,
  SSEEvent,
} from "@/types";

describe("Domain types", () => {
  it("TranscriptLine accepts valid speaker values", () => {
    const repLine: TranscriptLine = { speaker: "rep", text: "Hello" };
    const prospectLine: TranscriptLine = { speaker: "prospect", text: "Hi there" };
    const withTimestamp: TranscriptLine = { speaker: "rep", text: "Test", timestamp: 1000 };

    expect(repLine.speaker).toBe("rep");
    expect(prospectLine.speaker).toBe("prospect");
    expect(withTimestamp.timestamp).toBe(1000);
  });

  it("CoachingRule has required fields including detect function", () => {
    const rule: CoachingRule = {
      ruleId: "test-rule",
      name: "Test Rule",
      description: "A test rule",
      cooldownMs: 5000,
      detect: (window: TranscriptLine[]) => window.length > 0,
    };

    expect(rule.ruleId).toBe("test-rule");
    expect(rule.cooldownMs).toBe(5000);
    expect(typeof rule.detect).toBe("function");
    expect(rule.detect([{ speaker: "rep", text: "Hi" }])).toBe(true);
    expect(rule.detect([])).toBe(false);
  });

  it("CoachingPrompt has required fields", () => {
    const prompt: CoachingPrompt = {
      ruleId: "monologue",
      ruleName: "Monologue Detection",
      message: "You've been talking for a while",
      timestamp: 5000,
    };

    expect(prompt.ruleId).toBe("monologue");
    expect(prompt.timestamp).toBe(5000);
  });

  it("Session has required fields with optional scorecard", () => {
    const session: Session = {
      id: "session-1",
      status: "active",
      fixtureId: "discovery-call",
      transcript: [{ speaker: "rep", text: "Hello" }],
    };

    expect(session.status).toBe("active");
    expect(session.scorecard).toBeUndefined();

    const completedSession: Session = {
      id: "session-2",
      status: "completed",
      fixtureId: "demo-call",
      transcript: [],
      scorecard: {
        entries: [],
        overallScore: 85,
        summary: "Good performance",
      },
    };

    expect(completedSession.scorecard?.overallScore).toBe(85);
  });

  it("ScorecardEntry accepts valid assessment values", () => {
    const good: ScorecardEntry = {
      ruleId: "r1",
      ruleName: "Rule 1",
      assessment: "good",
      comment: "Well done",
    };
    const needsWork: ScorecardEntry = {
      ruleId: "r2",
      ruleName: "Rule 2",
      assessment: "needs-work",
      comment: "Could improve",
    };
    const missed: ScorecardEntry = {
      ruleId: "r3",
      ruleName: "Rule 3",
      assessment: "missed",
      comment: "Not observed",
    };

    expect(good.assessment).toBe("good");
    expect(needsWork.assessment).toBe("needs-work");
    expect(missed.assessment).toBe("missed");
  });

  it("Scorecard has entries, overallScore, and summary", () => {
    const scorecard: Scorecard = {
      entries: [
        { ruleId: "r1", ruleName: "Rule 1", assessment: "good", comment: "Nice" },
      ],
      overallScore: 90,
      summary: "Strong call",
    };

    expect(scorecard.entries).toHaveLength(1);
    expect(scorecard.overallScore).toBe(90);
  });

  it("SSEEvent accepts valid event types", () => {
    const events: SSEEvent[] = [
      { event: "transcript", data: { speaker: "rep", text: "Hi" } },
      { event: "coaching_prompt", data: { ruleId: "r1", message: "Tip" } },
      { event: "session_complete", data: { sessionId: "s1" } },
      { event: "heartbeat", data: {} },
    ];

    expect(events).toHaveLength(4);
    expect(events[0].event).toBe("transcript");
    expect(events[3].event).toBe("heartbeat");
  });
});
