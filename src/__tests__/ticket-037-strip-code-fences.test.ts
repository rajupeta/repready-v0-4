import { ClaudeService, stripCodeFences } from "@/services/claude-service";
import Anthropic from "@anthropic-ai/sdk";
import { TranscriptLine, RuleDefinition } from "@/types";

jest.mock("@anthropic-ai/sdk");

const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

const sampleRules: RuleDefinition[] = [
  {
    ruleId: "rule-1",
    ruleName: "Open with pain point",
    description: "Rep should open by addressing the prospect's pain point",
  },
];

const sampleTranscript: TranscriptLine[] = [
  { speaker: "rep", text: "Hi, thanks for taking my call." },
  { speaker: "prospect", text: "Sure, what's this about?" },
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

describe("TICKET-037: stripCodeFences", () => {
  it("returns raw JSON unchanged", () => {
    const raw = '[{"ruleId":"rule-1","message":"test"}]';
    expect(stripCodeFences(raw)).toBe(raw);
  });

  it("strips ```json fences", () => {
    const fenced = '```json\n[{"ruleId":"rule-1","message":"test"}]\n```';
    expect(stripCodeFences(fenced)).toBe('[{"ruleId":"rule-1","message":"test"}]');
  });

  it("strips ``` fences without language tag", () => {
    const fenced = '```\n{"entries":[],"overallScore":50}\n```';
    expect(stripCodeFences(fenced)).toBe('{"entries":[],"overallScore":50}');
  });

  it("handles fences with extra whitespace", () => {
    const fenced = '  ```json\n  {"key": "value"}  \n  ```  ';
    expect(stripCodeFences(fenced)).toBe('{"key": "value"}');
  });

  it("handles fences with no newline after language tag", () => {
    const fenced = '```json{"key":"value"}```';
    expect(stripCodeFences(fenced)).toBe('{"key":"value"}');
  });

  it("does not strip partial fences (missing closing)", () => {
    const partial = '```json\n{"key":"value"}';
    expect(stripCodeFences(partial)).toBe(partial.trim());
  });

  it("handles multiline JSON inside fences", () => {
    const fenced = '```json\n{\n  "entries": [],\n  "overallScore": 80,\n  "summary": "Good call"\n}\n```';
    const expected = '{\n  "entries": [],\n  "overallScore": 80,\n  "summary": "Good call"\n}';
    expect(stripCodeFences(fenced)).toBe(expected);
  });
});

describe("TICKET-037: ClaudeService handles markdown-fenced responses", () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-api-key";
    mockCreate = setupMockCreate();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  describe("getCoachingPrompts", () => {
    it("parses raw JSON response", async () => {
      const responseData = [
        { ruleId: "rule-1", ruleName: "Open with pain point", message: "Lead with pain." },
      ];
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(responseData) }],
      });

      const service = new ClaudeService();
      const result = await service.getCoachingPrompts(sampleRules, sampleTranscript);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe("rule-1");
      expect(result[0].message).toBe("Lead with pain.");
    });

    it("parses JSON wrapped in ```json fences", async () => {
      const responseData = [
        { ruleId: "rule-1", ruleName: "Open with pain point", message: "Lead with pain." },
      ];
      const fencedResponse = "```json\n" + JSON.stringify(responseData) + "\n```";
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: fencedResponse }],
      });

      const service = new ClaudeService();
      const result = await service.getCoachingPrompts(sampleRules, sampleTranscript);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe("rule-1");
      expect(result[0].message).toBe("Lead with pain.");
    });

    it("parses JSON wrapped in ``` fences (no language tag)", async () => {
      const responseData = [
        { ruleId: "rule-1", ruleName: "Open with pain point", message: "Lead with pain." },
      ];
      const fencedResponse = "```\n" + JSON.stringify(responseData) + "\n```";
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: fencedResponse }],
      });

      const service = new ClaudeService();
      const result = await service.getCoachingPrompts(sampleRules, sampleTranscript);

      expect(result).toHaveLength(1);
      expect(result[0].ruleId).toBe("rule-1");
    });
  });

  describe("generateScorecard", () => {
    const scorecardData = {
      entries: [
        {
          ruleId: "rule-1",
          ruleName: "Open with pain point",
          assessment: "good",
          comment: "Rep addressed pain early.",
        },
      ],
      overallScore: 85,
      summary: "Strong opening.",
    };

    it("parses raw JSON scorecard response", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: JSON.stringify(scorecardData) }],
      });

      const service = new ClaudeService();
      const result = await service.generateScorecard(sampleTranscript, sampleRules);

      expect(result.overallScore).toBe(85);
      expect(result.entries[0].assessment).toBe("good");
      expect(result.summary).toBe("Strong opening.");
    });

    it("parses scorecard wrapped in ```json fences", async () => {
      const fencedResponse = "```json\n" + JSON.stringify(scorecardData) + "\n```";
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: fencedResponse }],
      });

      const service = new ClaudeService();
      const result = await service.generateScorecard(sampleTranscript, sampleRules);

      expect(result.overallScore).toBe(85);
      expect(result.entries[0].assessment).toBe("good");
      expect(result.summary).toBe("Strong opening.");
    });

    it("parses scorecard wrapped in ``` fences (no language tag)", async () => {
      const fencedResponse = "```\n" + JSON.stringify(scorecardData) + "\n```";
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: fencedResponse }],
      });

      const service = new ClaudeService();
      const result = await service.generateScorecard(sampleTranscript, sampleRules);

      expect(result.overallScore).toBe(85);
      expect(result.entries).toHaveLength(1);
    });

    it("returns default scorecard when fenced content is still invalid", async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: "text", text: "```json\nnot valid json\n```" }],
      });
      const warnSpy = jest.spyOn(console, "warn").mockImplementation();

      const service = new ClaudeService();
      const result = await service.generateScorecard(sampleTranscript, sampleRules);

      expect(result.overallScore).toBe(0);
      expect(result.entries[0].assessment).toBe("missed");
      warnSpy.mockRestore();
    });
  });
});
