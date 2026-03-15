/**
 * TICKET-027 QA Validation: Claude model and playback delay spec compliance
 *
 * Acceptance Criteria:
 * - Claude SDK wrapper configured to use claude-3-5-haiku-20241022
 * - Playback delay range updated to 2-4s
 * - Confirmed via config/code inspection and tests
 */
import { ClaudeService } from "@/services/claude-service";
import { PlaybackService } from "@/services/playback-service";
import Anthropic from "@anthropic-ai/sdk";
import type { TranscriptLine } from "@/types";

jest.mock("@anthropic-ai/sdk");
jest.mock("fs", () => ({
  readFileSync: jest.fn().mockReturnValue(
    JSON.stringify([
      { speaker: "rep", text: "Hello, thanks for taking the call." },
      { speaker: "prospect", text: "Sure, what do you have for me?" },
      { speaker: "rep", text: "I'd love to learn about your current setup." },
      { speaker: "prospect", text: "We use Competitor X right now." },
      { speaker: "rep", text: "Interesting. What challenges are you facing?" },
    ])
  ),
}));

const MockedAnthropic = Anthropic as jest.MockedClass<typeof Anthropic>;

describe("TICKET-027 QA: Acceptance Criteria Validation", () => {
  describe("AC1: Claude SDK wrapper uses claude-3-5-haiku-20241022", () => {
    let mockCreate: jest.Mock;

    beforeEach(() => {
      jest.clearAllMocks();
      delete process.env.CLAUDE_MODEL;
      process.env.ANTHROPIC_API_KEY = "test-key-qa";
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

    it("coaching prompts call uses claude-3-5-haiku-20241022 model", async () => {
      const service = new ClaudeService();
      await service.getCoachingPrompts(
        [{ ruleId: "qa-rule", ruleName: "QA Test Rule", description: "testing" }],
        [{ speaker: "rep", text: "test line" }]
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe("claude-3-5-haiku-20241022");
    });

    it("scorecard generation uses claude-3-5-haiku-20241022 model", async () => {
      mockCreate.mockResolvedValue({
        content: [{
          type: "text",
          text: JSON.stringify({
            entries: [{ ruleId: "qa-rule", ruleName: "QA Test", assessment: "good", comment: "ok" }],
            overallScore: 85,
            summary: "Good call",
          }),
        }],
      });

      const service = new ClaudeService();
      await service.generateScorecard(
        [{ speaker: "rep", text: "hello" }],
        [{ ruleId: "qa-rule", ruleName: "QA Test", description: "testing" }]
      );

      const callArgs = mockCreate.mock.calls[0][0];
      expect(callArgs.model).toBe("claude-3-5-haiku-20241022");
    });

    it("model is NOT claude-3-opus, claude-3-sonnet, or any other variant by default", async () => {
      const service = new ClaudeService();
      await service.getCoachingPrompts(
        [{ ruleId: "r1", ruleName: "R1", description: "d1" }],
        [{ speaker: "rep", text: "test" }]
      );

      const model = mockCreate.mock.calls[0][0].model;
      expect(model).not.toContain("opus");
      expect(model).not.toContain("sonnet");
      expect(model).not.toBe("claude-3-haiku-20240307");
      expect(model).toBe("claude-3-5-haiku-20241022");
    });

    it("CLAUDE_MODEL env var override still works", async () => {
      process.env.CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
      const service = new ClaudeService();
      await service.getCoachingPrompts(
        [{ ruleId: "r1", ruleName: "R1", description: "d1" }],
        [{ speaker: "rep", text: "test" }]
      );

      expect(mockCreate.mock.calls[0][0].model).toBe("claude-3-5-sonnet-20241022");
    });
  });

  describe("AC2: Playback delay range is 2-4s", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("minimum delay is 2000ms (Math.random=0)", () => {
      const origRandom = Math.random;
      Math.random = () => 0;

      try {
        const service = new PlaybackService("test");
        service.loadFixture();
        const lines: TranscriptLine[] = [];
        service.start((line) => lines.push(line), () => {});

        expect(lines).toHaveLength(1); // first line immediate

        jest.advanceTimersByTime(1999);
        expect(lines).toHaveLength(1); // not yet at 1999ms

        jest.advanceTimersByTime(1);
        expect(lines).toHaveLength(2); // exactly at 2000ms
        service.stop();
      } finally {
        Math.random = origRandom;
      }
    });

    it("maximum delay is ~4000ms (Math.random=0.999)", () => {
      const origRandom = Math.random;
      Math.random = () => 0.999;

      try {
        const service = new PlaybackService("test");
        service.loadFixture();
        const lines: TranscriptLine[] = [];
        service.start((line) => lines.push(line), () => {});

        expect(lines).toHaveLength(1);

        // At 3997ms: delay = 2000 + 0.999*2000 = 3998ms, should not have fired
        jest.advanceTimersByTime(3997);
        expect(lines).toHaveLength(1);

        // At 4000ms: past the 3998ms delay, should have fired
        jest.advanceTimersByTime(3);
        expect(lines).toHaveLength(2);
        service.stop();
      } finally {
        Math.random = origRandom;
      }
    });

    it("delay never goes below 2s — no line emitted at 1.5s", () => {
      const origRandom = Math.random;
      // Try several random values — all should produce delay >= 2000ms
      const randomValues = [0, 0.1, 0.25, 0.5, 0.75, 0.99];

      for (const rv of randomValues) {
        Math.random = () => rv;
        const service = new PlaybackService("test");
        service.loadFixture();
        const lines: TranscriptLine[] = [];
        service.start((line) => lines.push(line), () => {});

        expect(lines).toHaveLength(1);
        jest.advanceTimersByTime(1500);
        expect(lines).toHaveLength(1); // no second line at 1.5s for any random value
        service.stop();
        jest.clearAllTimers();
      }

      Math.random = origRandom;
    });

    it("delay never exceeds 4s — line always emitted by 4001ms", () => {
      const origRandom = Math.random;
      const randomValues = [0, 0.1, 0.5, 0.9, 0.999];

      for (const rv of randomValues) {
        Math.random = () => rv;
        const service = new PlaybackService("test");
        service.loadFixture();
        const lines: TranscriptLine[] = [];
        service.start((line) => lines.push(line), () => {});

        expect(lines).toHaveLength(1);
        jest.advanceTimersByTime(4001);
        expect(lines.length).toBeGreaterThanOrEqual(2); // at least one more by 4001ms
        service.stop();
        jest.clearAllTimers();
      }

      Math.random = origRandom;
    });

    it("emits all fixture lines with correct timing", () => {
      const origRandom = Math.random;
      Math.random = () => 0.5; // delay = 3000ms

      try {
        const service = new PlaybackService("test");
        service.loadFixture();
        const lines: TranscriptLine[] = [];
        let completed = false;
        service.start((line) => lines.push(line), () => { completed = true; });

        expect(lines).toHaveLength(1);

        // Advance through all 5 lines (4 intervals of 3000ms)
        for (let i = 2; i <= 5; i++) {
          jest.advanceTimersByTime(3000);
          expect(lines).toHaveLength(i);
        }

        // After all lines emitted, onComplete should fire on next tick
        jest.advanceTimersByTime(3000);
        expect(completed).toBe(true);
        service.stop();
      } finally {
        Math.random = origRandom;
      }
    });
  });
});
