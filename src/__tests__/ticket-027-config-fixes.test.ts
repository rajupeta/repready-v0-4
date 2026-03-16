import { ClaudeService } from "@/services/claude-service";
import { PlaybackService } from "@/services/playback-service";
import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptLine } from "@/types";

jest.mock("@anthropic-ai/sdk");
jest.mock("fs", () => ({
  readFileSync: jest.fn().mockReturnValue(
    JSON.stringify([
      { speaker: "rep", text: "Hello" },
      { speaker: "prospect", text: "Hi there" },
      { speaker: "rep", text: "How are you?" },
    ])
  ),
}));

const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

describe("TICKET-027: Claude model default", () => {
  let mockCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CLAUDE_MODEL;
    process.env.ANTHROPIC_API_KEY = "test-key";
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

  it("defaults to claude-haiku-4-5-20251001 per spec", async () => {
    const service = new ClaudeService();
    await service.getCoachingPrompts(
      [{ ruleId: "r1", ruleName: "Test", description: "test" }],
      [{ speaker: "rep", text: "hello" }]
    );

    expect(mockCreate.mock.calls[0][0].model).toBe("claude-haiku-4-5-20251001");
  });

  it("uses claude-haiku-4-5-20251001 for scorecard generation too", async () => {
    mockCreate.mockResolvedValue({
      content: [{ type: "text", text: JSON.stringify({ entries: [], overallScore: 0, summary: "test" }) }],
    });
    const service = new ClaudeService();
    await service.generateScorecard(
      [{ speaker: "rep", text: "hello" }],
      [{ ruleId: "r1", ruleName: "Test", description: "test" }]
    );

    expect(mockCreate.mock.calls[0][0].model).toBe("claude-haiku-4-5-20251001");
  });

  it("allows override via CLAUDE_MODEL env var", async () => {
    process.env.CLAUDE_MODEL = "claude-sonnet-4-20250514";
    const service = new ClaudeService();
    await service.getCoachingPrompts(
      [{ ruleId: "r1", ruleName: "Test", description: "test" }],
      [{ speaker: "rep", text: "hello" }]
    );

    expect(mockCreate.mock.calls[0][0].model).toBe("claude-sonnet-4-20250514");
  });
});

describe("TICKET-027: Playback delay range 2-4s", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not emit second line before 2000ms (minimum delay)", () => {
    const service = new PlaybackService("test");
    service.loadFixture();

    const lines: TranscriptLine[] = [];
    service.start((line) => lines.push(line), () => {});

    // First line emitted synchronously
    expect(lines).toHaveLength(1);

    // At 1999ms, second line should NOT have been emitted
    jest.advanceTimersByTime(1999);
    expect(lines).toHaveLength(1);
  });

  it("emits second line by 4000ms (maximum delay)", () => {
    const service = new PlaybackService("test");
    service.loadFixture();

    const lines: TranscriptLine[] = [];
    service.start((line) => lines.push(line), () => {});

    expect(lines).toHaveLength(1);

    // At 4001ms, second line MUST have been emitted (max delay is 4000ms)
    jest.advanceTimersByTime(4001);
    expect(lines).toHaveLength(2);
  });

  it("delay is within 2-4s range across multiple samples", () => {
    // Mock Math.random to test boundary values
    const originalRandom = Math.random;

    // Test minimum: Math.random() = 0 → delay = 2000ms
    Math.random = () => 0;
    const serviceMin = new PlaybackService("test");
    serviceMin.loadFixture();
    const linesMin: TranscriptLine[] = [];
    serviceMin.start((line) => linesMin.push(line), () => {});
    expect(linesMin).toHaveLength(1);
    jest.advanceTimersByTime(2000);
    expect(linesMin).toHaveLength(2);
    serviceMin.stop();

    // Test maximum: Math.random() = 0.999... → delay ≈ 4000ms
    Math.random = () => 0.999;
    const serviceMax = new PlaybackService("test");
    serviceMax.loadFixture();
    const linesMax: TranscriptLine[] = [];
    serviceMax.start((line) => linesMax.push(line), () => {});
    expect(linesMax).toHaveLength(1);
    // At 3998ms it should NOT have fired yet (delay ≈ 3998ms)
    jest.advanceTimersByTime(3997);
    expect(linesMax).toHaveLength(1);
    // At 4000ms it should have fired
    jest.advanceTimersByTime(3);
    expect(linesMax).toHaveLength(2);
    serviceMax.stop();

    Math.random = originalRandom;
  });
});
