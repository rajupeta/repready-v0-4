/**
 * TICKET-027 Test Agent QA — Additional validation for Claude model and playback delay
 *
 * This test file validates edge cases and code-level assertions for TICKET-027:
 * - Claude default model is claude-3-5-haiku-20241022 (not claude-sonnet-4-20250514)
 * - Playback delay formula is 2000 + Math.random() * 2000 (2-4s range)
 * - Source code inspection tests verify the constants directly
 */
import { join } from "path";
import { ClaudeService } from "@/services/claude-service";
import { PlaybackService } from "@/services/playback-service";
import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptLine } from "@/types";

jest.mock("@anthropic-ai/sdk");
jest.mock("fs", () => ({
  readFileSync: jest.fn().mockReturnValue(
    JSON.stringify([
      { speaker: "rep", text: "Hi, thanks for joining." },
      { speaker: "prospect", text: "No problem." },
      { speaker: "rep", text: "Let me tell you about our product." },
    ])
  ),
  // Keep join available
  ...jest.requireActual("path"),
}));

const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

describe("TICKET-027 Test Agent QA: Source code verification", () => {
  it("claude-service.ts hardcodes claude-3-5-haiku-20241022 as default", () => {
    const source = jest.requireActual("fs").readFileSync(
      join(process.cwd(), "src/services/claude-service.ts"),
      "utf-8"
    ) as string;
    expect(source).toContain('"claude-3-5-haiku-20241022"');
    expect(source).not.toContain('"claude-sonnet-4-20250514"');
  });

  it("playback-service.ts uses Math.random() * 2000 for delay range", () => {
    const source = jest.requireActual("fs").readFileSync(
      join(process.cwd(), "src/services/playback-service.ts"),
      "utf-8"
    ) as string;
    // Verify the delay formula: 2000 + Math.random() * 2000
    expect(source).toMatch(/2000\s*\+\s*Math\.random\(\)\s*\*\s*2000/);
    // Verify the comment says 2-4 seconds
    expect(source).toMatch(/2-4\s*seconds/);
  });
});

describe("TICKET-027 Test Agent QA: Claude model runtime behavior", () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CLAUDE_MODEL;
    process.env.ANTHROPIC_API_KEY = "test-key-qa-agent";
    mockCreate = jest.fn().mockResolvedValue({
      content: [{ type: "text", text: "[]" }],
    });
    MockedAnthropic.mockImplementation(
      () =>
        ({
          messages: { create: mockCreate },
        }) as unknown as Anthropic
    );
  });

  afterEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.CLAUDE_MODEL;
  });

  it("multiple ClaudeService instances all default to haiku", async () => {
    const service1 = new ClaudeService();
    const service2 = new ClaudeService();

    await service1.getCoachingPrompts(
      [{ ruleId: "r1", ruleName: "Rule 1", description: "d1" }],
      [{ speaker: "rep", text: "hello" }]
    );
    await service2.getCoachingPrompts(
      [{ ruleId: "r2", ruleName: "Rule 2", description: "d2" }],
      [{ speaker: "rep", text: "world" }]
    );

    expect(mockCreate.mock.calls[0][0].model).toBe("claude-3-5-haiku-20241022");
    expect(mockCreate.mock.calls[1][0].model).toBe("claude-3-5-haiku-20241022");
  });

  it("empty CLAUDE_MODEL env var falls back to default", async () => {
    process.env.CLAUDE_MODEL = "";
    const service = new ClaudeService();
    await service.getCoachingPrompts(
      [{ ruleId: "r1", ruleName: "R1", description: "d1" }],
      [{ speaker: "rep", text: "test" }]
    );

    // Empty string is falsy, should use default
    expect(mockCreate.mock.calls[0][0].model).toBe("claude-3-5-haiku-20241022");
  });

  it("ClaudeService silently returns empty on API error (does not crash)", async () => {
    mockCreate.mockRejectedValue(new Error("API timeout"));
    const service = new ClaudeService();
    const result = await service.getCoachingPrompts(
      [{ ruleId: "r1", ruleName: "R1", description: "d1" }],
      [{ speaker: "rep", text: "test" }]
    );

    expect(result).toEqual([]);
  });

  it("generateScorecard returns default scorecard on API error", async () => {
    mockCreate.mockRejectedValue(new Error("Network error"));
    const service = new ClaudeService();
    const rules = [{ ruleId: "r1", ruleName: "R1", description: "d1" }];
    const result = await service.generateScorecard(
      [{ speaker: "rep", text: "test" }],
      rules
    );

    expect(result.overallScore).toBe(0);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].assessment).toBe("missed");
  });
});

describe("TICKET-027 Test Agent QA: Playback delay edge cases", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("stop() prevents further line emissions", () => {
    const origRandom = Math.random;
    Math.random = () => 0.5; // 3000ms delay

    try {
      const service = new PlaybackService("test");
      service.loadFixture();
      const lines: TranscriptLine[] = [];
      service.start((line) => lines.push(line), () => {});

      expect(lines).toHaveLength(1);
      service.stop();

      jest.advanceTimersByTime(10000);
      expect(lines).toHaveLength(1); // no more lines after stop
    } finally {
      Math.random = origRandom;
    }
  });

  it("onComplete fires after all lines emitted", () => {
    const origRandom = Math.random;
    Math.random = () => 0; // 2000ms delay (minimum)

    try {
      const service = new PlaybackService("test");
      service.loadFixture();
      const lines: TranscriptLine[] = [];
      let completed = false;
      service.start(
        (line) => lines.push(line),
        () => { completed = true; }
      );

      // 3 fixture lines: first immediate, then 2 at 2000ms intervals
      expect(lines).toHaveLength(1);
      expect(completed).toBe(false);

      jest.advanceTimersByTime(2000);
      expect(lines).toHaveLength(2);

      jest.advanceTimersByTime(2000);
      expect(lines).toHaveLength(3);

      // After all lines, next tick should fire onComplete
      jest.advanceTimersByTime(2000);
      expect(completed).toBe(true);
    } finally {
      Math.random = origRandom;
    }
  });

  it("each emitted line has a timestamp", () => {
    const origRandom = Math.random;
    Math.random = () => 0;

    try {
      const service = new PlaybackService("test");
      service.loadFixture();
      const lines: TranscriptLine[] = [];
      service.start((line) => lines.push(line), () => {});

      expect(lines[0].timestamp).toBeDefined();
      expect(typeof lines[0].timestamp).toBe("number");
      expect(lines[0].timestamp).toBeGreaterThan(0);

      jest.advanceTimersByTime(2000);
      expect(lines[1].timestamp).toBeDefined();
      expect(lines[1].timestamp!).toBeGreaterThanOrEqual(lines[0].timestamp!);
    } finally {
      Math.random = origRandom;
    }
  });

  it("delay statistical distribution: midpoint random gives ~3s delay", () => {
    const origRandom = Math.random;
    Math.random = () => 0.5; // delay = 2000 + 0.5*2000 = 3000ms

    try {
      const service = new PlaybackService("test");
      service.loadFixture();
      const lines: TranscriptLine[] = [];
      service.start((line) => lines.push(line), () => {});

      expect(lines).toHaveLength(1);

      jest.advanceTimersByTime(2999);
      expect(lines).toHaveLength(1); // not yet at 2999ms

      jest.advanceTimersByTime(1);
      expect(lines).toHaveLength(2); // exactly at 3000ms
      service.stop();
    } finally {
      Math.random = origRandom;
    }
  });
});
