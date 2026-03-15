/**
 * TICKET-004 QA Validation Tests
 * Validates all acceptance criteria for Claude SDK and service wrapper
 */
import { ClaudeService } from "@/services/claude-service";
import Anthropic from "@anthropic-ai/sdk";
import {
  TranscriptLine,
  Scorecard,
  RuleDefinition,
} from "@/types";
import * as fs from "fs";
import * as path from "path";

jest.mock("@anthropic-ai/sdk");

const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

const sampleRules: RuleDefinition[] = [
  {
    ruleId: "rule-pain",
    ruleName: "Open with pain point",
    description: "Rep should open by addressing the prospect's pain point",
  },
  {
    ruleId: "rule-discovery",
    ruleName: "Ask discovery questions",
    description: "Rep should ask open-ended discovery questions",
  },
  {
    ruleId: "rule-next-steps",
    ruleName: "Propose next steps",
    description: "Rep should propose clear next steps before ending the call",
  },
];

const sampleTranscript: TranscriptLine[] = [
  { speaker: "rep", text: "Hi, thanks for taking my call." },
  { speaker: "prospect", text: "Sure, what's this about?" },
  {
    speaker: "rep",
    text: "I noticed your team has been struggling with pipeline visibility.",
  },
  { speaker: "prospect", text: "Yeah, that's been a real challenge for us." },
  {
    speaker: "rep",
    text: "What tools are you currently using to track your pipeline?",
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

// ============================================================
// AC1: @anthropic-ai/sdk is in package.json
// ============================================================
describe("TICKET-004 AC1: @anthropic-ai/sdk in package.json", () => {
  it("@anthropic-ai/sdk is listed as a dependency", () => {
    const pkgPath = path.resolve(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    expect(pkg.dependencies).toHaveProperty("@anthropic-ai/sdk");
  });

  it("@anthropic-ai/sdk version is a valid semver range", () => {
    const pkgPath = path.resolve(__dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const version = pkg.dependencies["@anthropic-ai/sdk"];
    expect(version).toMatch(/^\^?\d+\.\d+\.\d+/);
  });
});

// ============================================================
// AC2: ClaudeService initializes with API key from env
// ============================================================
describe("TICKET-004 AC2: ClaudeService initializes with API key from env", () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key-abc123";
    mockCreate = setupMockCreate();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_MODEL;
  });

  it("passes ANTHROPIC_API_KEY to the Anthropic constructor", () => {
    new ClaudeService();
    expect(MockedAnthropic).toHaveBeenCalledWith({
      apiKey: "test-key-abc123",
    });
  });

  it("uses default model claude-sonnet-4-20250514 when CLAUDE_MODEL is not set", async () => {
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

// ============================================================
// AC3: getCoachingPrompts sends single batched call, returns CoachingPrompt[]
// ============================================================
describe("TICKET-004 AC3: getCoachingPrompts batched call and return type", () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate = setupMockCreate();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("makes exactly one API call regardless of how many rules are triggered", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify([
            { ruleId: "rule-pain", ruleName: "Open with pain point", message: "Lead with pain." },
            { ruleId: "rule-discovery", ruleName: "Ask discovery questions", message: "Ask discovery Q." },
            { ruleId: "rule-next-steps", ruleName: "Propose next steps", message: "Propose next steps." },
          ]),
        },
      ],
    });

    const service = new ClaudeService();
    await service.getCoachingPrompts(sampleRules, sampleTranscript);

    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("includes all triggered ruleIds in the single request", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "[]" }],
    });

    const service = new ClaudeService();
    await service.getCoachingPrompts(sampleRules, sampleTranscript);

    const userContent = mockCreate.mock.calls[0][0].messages[0].content;
    expect(userContent).toContain("rule-pain");
    expect(userContent).toContain("rule-discovery");
    expect(userContent).toContain("rule-next-steps");
  });

  it("returns CoachingPrompt[] with ruleId, ruleName, message, and timestamp", async () => {
    const responseData = [
      { ruleId: "rule-pain", ruleName: "Open with pain point", message: "Start by acknowledging their pipeline pain." },
      { ruleId: "rule-discovery", ruleName: "Ask discovery questions", message: "Try: What does your current process look like?" },
    ];

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(responseData) }],
    });

    const service = new ClaudeService();
    const result = await service.getCoachingPrompts(
      sampleRules.slice(0, 2),
      sampleTranscript
    );

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(2);
    result.forEach((item) => {
      expect(item).toHaveProperty("ruleId");
      expect(item).toHaveProperty("ruleName");
      expect(item).toHaveProperty("message");
      expect(item).toHaveProperty("timestamp");
      expect(typeof item.ruleId).toBe("string");
      expect(typeof item.message).toBe("string");
      expect(typeof item.timestamp).toBe("number");
    });
  });

  it("includes the rolling window transcript in the user message", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "[]" }],
    });

    const service = new ClaudeService();
    await service.getCoachingPrompts(sampleRules, sampleTranscript);

    const userContent = mockCreate.mock.calls[0][0].messages[0].content;
    for (const line of sampleTranscript) {
      expect(userContent).toContain(`${line.speaker}: ${line.text}`);
    }
  });

  it("uses the coaching system prompt", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "[]" }],
    });

    const service = new ClaudeService();
    await service.getCoachingPrompts(sampleRules, sampleTranscript);

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toContain("sales coaching assistant");
    expect(callArgs.system).toContain("JSON array");
    expect(callArgs.system).toContain("ruleId");
  });
});

// ============================================================
// AC4: generateScorecard sends full transcript, returns Scorecard
// ============================================================
describe("TICKET-004 AC4: generateScorecard full transcript and return type", () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate = setupMockCreate();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("sends the full transcript text in the API call", async () => {
    mockCreate.mockResolvedValue({
      content: [
        {
          type: "text",
          text: JSON.stringify({ entries: [], overallScore: 80, summary: "Good call." }),
        },
      ],
    });

    const service = new ClaudeService();
    await service.generateScorecard(sampleTranscript, sampleRules);

    const userContent = mockCreate.mock.calls[0][0].messages[0].content;
    for (const line of sampleTranscript) {
      expect(userContent).toContain(`${line.speaker}: ${line.text}`);
    }
  });

  it("returns Scorecard with entries array, overallScore, and summary", async () => {
    const scorecardData: Scorecard = {
      entries: [
        {
          ruleId: "rule-pain",
          ruleName: "Open with pain point",
          assessment: "good",
          comment: "Great opening.",
        },
        {
          ruleId: "rule-discovery",
          ruleName: "Ask discovery questions",
          assessment: "needs-work",
          comment: "Could dig deeper.",
        },
        {
          ruleId: "rule-next-steps",
          ruleName: "Propose next steps",
          assessment: "missed",
          comment: "No next steps mentioned.",
        },
      ],
      overallScore: 55,
      summary: "Decent call but missed next steps.",
    };

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(scorecardData) }],
    });

    const service = new ClaudeService();
    const result = await service.generateScorecard(
      sampleTranscript,
      sampleRules
    );

    expect(result).toHaveProperty("entries");
    expect(result).toHaveProperty("overallScore");
    expect(result).toHaveProperty("summary");
    expect(Array.isArray(result.entries)).toBe(true);
    expect(typeof result.overallScore).toBe("number");
    expect(result.overallScore).toBe(55);
    expect(result.entries).toHaveLength(3);
  });

  it("scorecard entries contain ruleId, ruleName, assessment, and comment", async () => {
    const scorecardData: Scorecard = {
      entries: [
        {
          ruleId: "rule-pain",
          ruleName: "Open with pain point",
          assessment: "good",
          comment: "Nailed it.",
        },
      ],
      overallScore: 90,
      summary: "Strong call.",
    };

    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify(scorecardData) }],
    });

    const service = new ClaudeService();
    const result = await service.generateScorecard(
      sampleTranscript,
      sampleRules
    );

    const entry = result.entries[0];
    expect(entry).toHaveProperty("ruleId");
    expect(entry).toHaveProperty("ruleName");
    expect(entry).toHaveProperty("assessment");
    expect(entry).toHaveProperty("comment");
    expect(["good", "needs-work", "missed"]).toContain(entry.assessment);
  });

  it("uses the scorecard system prompt", async () => {
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

  it("includes all rule definitions in the request", async () => {
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

    const userContent = mockCreate.mock.calls[0][0].messages[0].content;
    for (const rule of sampleRules) {
      expect(userContent).toContain(rule.ruleId);
      expect(userContent).toContain(rule.ruleName);
      expect(userContent).toContain(rule.description);
    }
  });
});

// ============================================================
// AC5: Errors are caught and logged, returning safe defaults
// ============================================================
describe("TICKET-004 AC5: Error handling with safe defaults", () => {
  let mockCreate: jest.Mock;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate = setupMockCreate();
    warnSpy = jest.spyOn(console, "warn").mockImplementation();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    warnSpy.mockRestore();
  });

  it("getCoachingPrompts: returns [] on network error", async () => {
    mockCreate.mockRejectedValue(new Error("Network timeout"));

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
  });

  it("getCoachingPrompts: returns [] on malformed JSON", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "{not: valid json" }],
    });

    const service = new ClaudeService();
    const result = await service.getCoachingPrompts(
      sampleRules,
      sampleTranscript
    );

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("getCoachingPrompts: returns [] on non-text content type", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "t1", name: "fn", input: {} }],
    });

    const service = new ClaudeService();
    const result = await service.getCoachingPrompts(
      sampleRules,
      sampleTranscript
    );

    expect(result).toEqual([]);
  });

  it("getCoachingPrompts: returns [] on rate limit error", async () => {
    mockCreate.mockRejectedValue(
      Object.assign(new Error("rate_limit_exceeded"), { status: 429 })
    );

    const service = new ClaudeService();
    const result = await service.getCoachingPrompts(
      sampleRules,
      sampleTranscript
    );

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
  });

  it("generateScorecard: returns default scorecard on API error", async () => {
    mockCreate.mockRejectedValue(new Error("Internal server error"));

    const service = new ClaudeService();
    const result = await service.generateScorecard(
      sampleTranscript,
      sampleRules
    );

    expect(result.overallScore).toBe(0);
    expect(result.entries).toHaveLength(sampleRules.length);
    result.entries.forEach((entry, i) => {
      expect(entry.ruleId).toBe(sampleRules[i].ruleId);
      expect(entry.ruleName).toBe(sampleRules[i].ruleName);
      expect(entry.assessment).toBe("missed");
      expect(entry.comment).toBe("Unable to evaluate — scoring unavailable.");
    });
    expect(warnSpy).toHaveBeenCalledWith(
      "ClaudeService.generateScorecard failed:",
      expect.any(Error)
    );
  });

  it("generateScorecard: returns default scorecard on malformed JSON", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "not json at all" }],
    });

    const service = new ClaudeService();
    const result = await service.generateScorecard(
      sampleTranscript,
      sampleRules
    );

    expect(result.overallScore).toBe(0);
    expect(result.entries).toHaveLength(sampleRules.length);
    result.entries.forEach((e) => expect(e.assessment).toBe("missed"));
  });

  it("generateScorecard: returns default scorecard on non-text content", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "tool_use", id: "t2", name: "fn", input: {} }],
    });

    const service = new ClaudeService();
    const result = await service.generateScorecard(
      sampleTranscript,
      sampleRules
    );

    expect(result.overallScore).toBe(0);
    expect(result.entries).toHaveLength(sampleRules.length);
  });

  it("generateScorecard: default scorecard with empty rules returns empty entries", async () => {
    mockCreate.mockRejectedValue(new Error("fail"));

    const service = new ClaudeService();
    const result = await service.generateScorecard(sampleTranscript, []);

    expect(result.overallScore).toBe(0);
    expect(result.entries).toHaveLength(0);
  });
});

// ============================================================
// AC6: Prompt templates are clear and well-structured
// ============================================================
describe("TICKET-004 AC6: Prompt templates structure", () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "test-key";
    mockCreate = setupMockCreate();
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("coaching system prompt explains role, output format, and constraints", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "[]" }],
    });

    const service = new ClaudeService();
    await service.getCoachingPrompts([sampleRules[0]], sampleTranscript);

    const systemPrompt = mockCreate.mock.calls[0][0].system;
    expect(systemPrompt).toContain("sales coaching assistant");
    expect(systemPrompt).toContain("SDR");
    expect(systemPrompt).toContain("JSON array");
    expect(systemPrompt).toContain("ruleId");
    expect(systemPrompt).toContain("ONLY");
  });

  it("scorecard system prompt explains role, fields, and output format", async () => {
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

    const systemPrompt = mockCreate.mock.calls[0][0].system;
    expect(systemPrompt).toContain("sales coaching assistant");
    expect(systemPrompt).toContain("evaluates SDR");
    expect(systemPrompt).toContain("ruleId");
    expect(systemPrompt).toContain("ruleName");
    expect(systemPrompt).toContain("assessment");
    expect(systemPrompt).toContain("comment");
    expect(systemPrompt).toContain("overallScore");
    expect(systemPrompt).toContain("good");
    expect(systemPrompt).toContain("needs-work");
    expect(systemPrompt).toContain("missed");
  });

  it("coaching user message includes transcript and rules sections", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: "[]" }],
    });

    const service = new ClaudeService();
    await service.getCoachingPrompts(sampleRules, sampleTranscript);

    const userMsg = mockCreate.mock.calls[0][0].messages[0].content;
    expect(userMsg).toContain("transcript window");
    expect(userMsg).toContain("coaching rules have been triggered");
    expect(userMsg).toContain("Generate a coaching prompt");
  });

  it("scorecard user message includes full transcript and rules", async () => {
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

    const userMsg = mockCreate.mock.calls[0][0].messages[0].content;
    expect(userMsg).toContain("complete call transcript");
    expect(userMsg).toContain("coaching rules");
    expect(userMsg).toContain("per-rule assessment");
  });
});

// ============================================================
// Additional: .env.example and source file validation
// ============================================================
describe("TICKET-004: .env.example contains ANTHROPIC_API_KEY", () => {
  it(".env.example file exists and contains ANTHROPIC_API_KEY", () => {
    const envPath = path.resolve(__dirname, "../../.env.example");
    expect(fs.existsSync(envPath)).toBe(true);
    const content = fs.readFileSync(envPath, "utf-8");
    expect(content).toContain("ANTHROPIC_API_KEY");
  });
});

describe("TICKET-004: Source file structure", () => {
  it("claude-service.ts exists in src/services/", () => {
    const filePath = path.resolve(
      __dirname,
      "../services/claude-service.ts"
    );
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it("ClaudeService is exported from claude-service.ts", () => {
    const filePath = path.resolve(
      __dirname,
      "../services/claude-service.ts"
    );
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("export class ClaudeService");
  });

  it("types file exports all required interfaces", () => {
    const filePath = path.resolve(__dirname, "../types/index.ts");
    const content = fs.readFileSync(filePath, "utf-8");
    expect(content).toContain("TranscriptLine");
    expect(content).toContain("CoachingPrompt");
    expect(content).toContain("Scorecard");
    expect(content).toContain("ScorecardEntry");
    expect(content).toContain("RuleDefinition");
  });
});
