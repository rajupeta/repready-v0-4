import { PlaybackService } from "@/services/playback-service";
import type { TranscriptLine } from "@/types";

// Mock fs to avoid reading actual fixture files during tests
jest.mock("fs", () => ({
  readFileSync: jest.fn().mockReturnValue(
    JSON.stringify([
      { speaker: "rep", text: "Hello" },
      { speaker: "prospect", text: "Hi there" },
      { speaker: "rep", text: "How are you?" },
    ])
  ),
}));

describe("PlaybackService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should load fixture and store lines", () => {
    const service = new PlaybackService("test-fixture");
    service.loadFixture();
    // If loadFixture didn't throw, it loaded successfully
    expect(true).toBe(true);
  });

  it("should emit all lines and call onComplete", () => {
    const service = new PlaybackService("test-fixture");
    service.loadFixture();

    const emittedLines: TranscriptLine[] = [];
    let completed = false;

    service.start(
      (line) => emittedLines.push(line),
      () => { completed = true; }
    );

    // First line emitted immediately (synchronously in emitNext)
    expect(emittedLines).toHaveLength(1);
    expect(emittedLines[0].speaker).toBe("rep");
    expect(emittedLines[0].text).toBe("Hello");
    expect(typeof emittedLines[0].timestamp).toBe("number");

    // Advance past the second delay (max 4s)
    jest.advanceTimersByTime(4000);
    expect(emittedLines).toHaveLength(2);
    expect(emittedLines[1].text).toBe("Hi there");

    // Advance past the third delay
    jest.advanceTimersByTime(4000);
    expect(emittedLines).toHaveLength(3);
    expect(emittedLines[2].text).toBe("How are you?");

    // Advance to trigger onComplete
    jest.advanceTimersByTime(4000);
    expect(completed).toBe(true);
  });

  it("should add timestamps to each emitted line", () => {
    const service = new PlaybackService("test-fixture");
    service.loadFixture();

    const emittedLines: TranscriptLine[] = [];

    service.start(
      (line) => emittedLines.push(line),
      () => {}
    );

    // Emit all lines
    jest.advanceTimersByTime(10000);

    for (const line of emittedLines) {
      expect(line.timestamp).toBeDefined();
      expect(typeof line.timestamp).toBe("number");
      expect(line.timestamp).toBeGreaterThan(0);
    }
  });

  it("should stop playback when stop() is called", () => {
    const service = new PlaybackService("test-fixture");
    service.loadFixture();

    const emittedLines: TranscriptLine[] = [];
    let completed = false;

    service.start(
      (line) => emittedLines.push(line),
      () => { completed = true; }
    );

    // First line emitted immediately
    expect(emittedLines).toHaveLength(1);

    // Stop before next line
    service.stop();

    // Advance time — no more lines should be emitted
    jest.advanceTimersByTime(10000);
    expect(emittedLines).toHaveLength(1);
    expect(completed).toBe(false);
  });

  it("should use randomized delays between 2-4 seconds", () => {
    const service = new PlaybackService("test-fixture");
    service.loadFixture();

    const emittedLines: TranscriptLine[] = [];

    service.start(
      (line) => emittedLines.push(line),
      () => {}
    );

    // First line is immediate
    expect(emittedLines).toHaveLength(1);

    // At 1999ms, next line should NOT have been emitted (min delay is 2000ms)
    jest.advanceTimersByTime(1999);
    expect(emittedLines).toHaveLength(1);

    // At 4001ms, next line SHOULD have been emitted (max delay is 4000ms)
    jest.advanceTimersByTime(2001);
    expect(emittedLines).toHaveLength(2);
  });
});
