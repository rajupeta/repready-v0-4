import { ClaudeService } from "@/services/claude-service";
import Anthropic from "@anthropic-ai/sdk";
import { TranscriptLine, RuleDefinition, CoachingPrompt, Scorecard } from "@/types";

jest.mock("@anthropic-ai/sdk");

const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

const sampleRules: RuleDefinition[] = [
  {
    ruleId: "rule-1",
    ruleName: "Open with pain point",
    description: "Rep should open by addressing the prospect's pain point",
  },
  {
    ruleId: "rule-2",
    ruleName: "Ask discovery questions",
    description: "Rep should ask open-ended discovery questions",
  },
];

const sampleTranscript: TranscriptLine[] = [
  { speaker: "rep", text: "Hi, thanks for taking my call." },
  { speaker: "prospect", text: "Sure, what's this about?" },
  {
    speaker: "rep",
    text: "I wanted to talk about your current workflow challenges.",
  },
];

function setupMockCreate(): jest.Mock {
  const mockCreate = jest.fn();
  MockedAnthropic.mockImplementation(
    () =>
      ({
        messages: { create: mockCreate },
      }) as unknown as Anthropic
  );
  return mockCreate;
}

describe("ClaudeService", () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    mockCreate = setupMockCreate();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_MODEL;
  });

  describe("constructor", () => {
    it("initializes with API key from environment", () => {
      new ClaudeService();
      expect(MockedAnthropic).toHaveBeenCalledWith({
        apiKey: "test-api-key",
      });
    });

    it("uses default model when CLAUDE_MODEL is not set", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "[]" }],
      });

      const service = new ClaudeService();
      await service.getCoachingPrompts([sampleRules[0]], sampleTranscript);

      expect(mockCreate.mock.calls[0][0].model).toBe("claude-sonnet-4-20250514");
    });

    it("uses CLAUDE_MODEL env var when set", async () => {
      process.env.CLAUDE_MODEL = "claude-haiku-4-5-20251001";
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "[]" }],
      });

      const service = new ClaudeService();
      await service.getCoachingPrompts([sampleRules[0]], sampleTranscript);

      expect(mockCreate.mock.calls[0][0].model).toBe("claude-haiku-4-5-20251001");
    });
  });

  describe("getCoachingPrompts", () => {
    it("sends a single batched call with all triggered rules", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { ruleId: "rule-1", ruleName: "Open with pain point", message: "Try leading with their pain point." },
              { ruleId: "rule-2", ruleName: "Ask discovery questions", message: "Ask what challenges they face daily." },
            ]),
          },
        ],
      });

      const service = new ClaudeService();
      const result = await service.getCoachingPrompts(
        sampleRules,
        sampleTranscript
      );

      expect(mockCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages).toHaveLength(1);
      expect(callArgs.messages[0].content).toContain("rule-1");
      expect(callArgs.messages[0].content).toContain("rule-2");
      expect(result).toHaveLength(2);
      expect(result[0].ruleId).toBe("rule-1");
      expect(result[0].message).toBe("Try leading with their pain point.");
      expect(result[1].ruleId).toBe("rule-2");
      expect(result[1].message).toBe("Ask what challenges they face daily.");
    });

    it("returns CoachingPrompt[] with required fields", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify([
              { ruleId: "rule-1", ruleName: "Open with pain point", message: "Lead with pain." },
            ]),
          },
        ],
      });

      const service = new ClaudeService();
      const result = await service.getCoachingPrompts(
        [sampleRules[0]],
        sampleTranscript
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("ruleId");
      expect(result[0]).toHaveProperty("ruleName");
      expect(result[0]).toHaveProperty("message");
      expect(result[0]).toHaveProperty("timestamp");
      expect(typeof result[0].timestamp).toBe("number");
    });

    it("includes transcript context in the request", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "[]" }],
      });

      const service = new ClaudeService();
      await service.getCoachingPrompts(sampleRules, sampleTranscript);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(
        "rep: Hi, thanks for taking my call."
      );
      expect(callArgs.messages[0].content).toContain(
        "prospect: Sure, what's this about?"
      );
    });

    it("uses coaching system prompt with correct structure", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "[]" }],
      });

      const service = new ClaudeService();
      await service.getCoachingPrompts(sampleRules, sampleTranscript);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.system).toContain("sales coaching assistant");
      expect(callArgs.system).toContain("JSON array");
      expect(callArgs.max_tokens).toBe(1024);
    });

    it("returns empty array on API error", async () => {
      mockCreate.mockRejectedValue(new Error("API error"));
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const service = new ClaudeService();
      const result = await service.getCoachingPrompts(
        sampleRules,
        sampleTranscript
      );

      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        "ClaudeService.getCoachingPrompts failed:",
        expect.any(Error)
      );
      warnSpy.mockRestore();
    });

    it("returns empty array on invalid JSON response", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "not valid json" }],
      });
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const service = new ClaudeService();
      const result = await service.getCoachingPrompts(
        sampleRules,
        sampleTranscript
      );

      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it("returns empty array when response content is not text type", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "tool_use", id: "123", name: "test", input: {} }],
      });

      const service = new ClaudeService();
      const result = await service.getCoachingPrompts(
        sampleRules,
        sampleTranscript
      );

      expect(result).toEqual([]);
    });

    it("returns empty array on rate limit error", async () => {
      mockCreate.mockRejectedValue(
        Object.assign(new Error("rate_limit_exceeded"), { status: 429 })
      );
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const service = new ClaudeService();
      const result = await service.getCoachingPrompts(
        sampleRules,
        sampleTranscript
      );

      expect(result).toEqual([]);
      expect(warnSpy).toHaveBeenCalled();
      warnSpy.mockRestore();
    });
  });

  describe("generateScorecard", () => {
    it("sends full transcript and returns scorecard", async () => {
      const scorecardResponse = {
        entries: [
          {
            ruleId: "rule-1",
            ruleName: "Open with pain point",
            assessment: "good",
            comment: "Rep addressed workflow challenges early.",
          },
          {
            ruleId: "rule-2",
            ruleName: "Ask discovery questions",
            assessment: "needs-work",
            comment: "Could ask more open-ended questions.",
          },
        ],
        overallScore: 72,
        summary: "Solid opening but needs more discovery.",
      };

      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(scorecardResponse) }],
      });

      const service = new ClaudeService();
      const result = await service.generateScorecard(
        sampleTranscript,
        sampleRules
      );

      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(result.entries).toHaveLength(2);
      expect(result.overallScore).toBe(72);
      expect(result.summary).toBe("Solid opening but needs more discovery.");
      expect(result.entries[0].assessment).toBe("good");
      expect(result.entries[1].assessment).toBe("needs-work");
    });

    it("includes full transcript text in the API call", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({ entries: [], overallScore: 50, summary: "Ok" }),
          },
        ],
      });

      const service = new ClaudeService();
      await service.generateScorecard(sampleTranscript, sampleRules);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.messages[0].content).toContain(
        "rep: Hi, thanks for taking my call."
      );
      expect(callArgs.messages[0].content).toContain(
        "rep: I wanted to talk about your current workflow challenges."
      );
    });

    it("uses scorecard system prompt in the API call", async () => {
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({ entries: [], overallScore: 50, summary: "Ok" }),
          },
        ],
      });

      const service = new ClaudeService();
      await service.generateScorecard(sampleTranscript, sampleRules);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.system).toContain("evaluates SDR");
      expect(callArgs.system).toContain("overallScore");
      expect(callArgs.max_tokens).toBe(2048);
    });

    it("returns default scorecard on API error", async () => {
      mockCreate.mockRejectedValue(new Error("API error"));
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const service = new ClaudeService();
      const result = await service.generateScorecard(
        sampleTranscript,
        sampleRules
      );

      expect(result.overallScore).toBe(0);
      expect(result.entries).toHaveLength(2);
      expect(result.entries[0].assessment).toBe("missed");
      expect(result.entries[1].assessment).toBe("missed");
      expect(result.summary).toContain("Unable to generate scorecard");
      expect(warnSpy).toHaveBeenCalledWith(
        "ClaudeService.generateScorecard failed:",
        expect.any(Error)
      );
      warnSpy.mockRestore();
    });

    it("returns default scorecard on invalid JSON response", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "invalid json" }],
      });
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const service = new ClaudeService();
      const result = await service.generateScorecard(
        sampleTranscript,
        sampleRules
      );

      expect(result.overallScore).toBe(0);
      expect(result.entries).toHaveLength(2);
      result.entries.forEach((entry) => {
        expect(entry.assessment).toBe("missed");
      });
      warnSpy.mockRestore();
    });

    it("returns default scorecard when response content is not text type", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "tool_use", id: "123", name: "test", input: {} }],
      });

      const service = new ClaudeService();
      const result = await service.generateScorecard(
        sampleTranscript,
        sampleRules
      );

      expect(result.overallScore).toBe(0);
      expect(result.entries).toHaveLength(2);
      result.entries.forEach((entry) => {
        expect(entry.assessment).toBe("missed");
        expect(entry.comment).toBe(
          "Unable to evaluate — scoring unavailable."
        );
      });
    });

    it("default scorecard preserves rule IDs and names", async () => {
      mockCreate.mockRejectedValue(new Error("API error"));
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const service = new ClaudeService();
      const result = await service.generateScorecard(
        sampleTranscript,
        sampleRules
      );

      expect(result.entries[0].ruleId).toBe("rule-1");
      expect(result.entries[0].ruleName).toBe("Open with pain point");
      expect(result.entries[1].ruleId).toBe("rule-2");
      expect(result.entries[1].ruleName).toBe("Ask discovery questions");
      warnSpy.mockRestore();
    });

    it("handles empty rules with default scorecard on error", async () => {
      mockCreate.mockRejectedValue(new Error("API error"));
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const service = new ClaudeService();
      const result = await service.generateScorecard(sampleTranscript, []);

      expect(result.overallScore).toBe(0);
      expect(result.entries).toHaveLength(0);
      warnSpy.mockRestore();
    });

    it("uses custom model from environment variable", async () => {
      process.env.CLAUDE_MODEL = "claude-haiku-4-5-20251001";
      mockCreate.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify({
              entries: [],
              overallScore: 50,
              summary: "Ok",
            }),
          },
        ],
      });

      const service = new ClaudeService();
      await service.generateScorecard(sampleTranscript, sampleRules);

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe("claude-haiku-4-5-20251001");
    });
  });
});
