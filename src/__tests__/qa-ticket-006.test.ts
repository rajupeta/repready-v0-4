import { PlaybackService } from "@/services/playback-service";
import { TranscriptService } from "@/services/transcript-service";
import type { TranscriptLine } from "@/types";
import fs from "fs";

// Mock fs for PlaybackService tests
jest.mock("fs");

const readFileSync = fs.readFileSync as jest.Mock;

function makeLine(index: number): TranscriptLine {
  return {
    speaker: index % 2 === 0 ? "rep" : "prospect",
    text: `Line ${index}`,
    timestamp: Date.now() + index,
  };
}

describe("TICKET-006 QA: TranscriptService edge cases", () => {
  it("window is exactly 1 after first addLine", () => {
    const service = new TranscriptService(jest.fn());
    service.addLine(makeLine(0));
    expect(service.getWindow()).toHaveLength(1);
    expect(service.getTranscript()).toHaveLength(1);
  });

  it("window stays at 10 when exactly 10 lines added", () => {
    const service = new TranscriptService(jest.fn());
    for (let i = 0; i < 10; i++) {
      service.addLine(makeLine(i));
    }
    expect(service.getWindow()).toHaveLength(10);
    expect(service.getWindow()[0].text).toBe("Line 0");
    expect(service.getWindow()[9].text).toBe("Line 9");
  });

  it("window trims to 10 at the 11th line", () => {
    const service = new TranscriptService(jest.fn());
    for (let i = 0; i < 11; i++) {
      service.addLine(makeLine(i));
    }
    const window = service.getWindow();
    expect(window).toHaveLength(10);
    expect(window[0].text).toBe("Line 1");
    expect(window[9].text).toBe("Line 10");
  });

  it("full transcript grows unbounded while window stays capped", () => {
    const service = new TranscriptService(jest.fn());
    for (let i = 0; i < 50; i++) {
      service.addLine(makeLine(i));
    }
    expect(service.getTranscript()).toHaveLength(50);
    expect(service.getWindow()).toHaveLength(10);
    expect(service.getWindow()[0].text).toBe("Line 40");
    expect(service.getWindow()[9].text).toBe("Line 49");
  });

  it("callback receives the line that was just added", () => {
    const callback = jest.fn();
    const service = new TranscriptService(callback);
    const line = makeLine(42);
    service.addLine(line);
    expect(callback).toHaveBeenCalledWith(line, expect.arrayContaining([line]));
  });

  it("callback window argument is a copy (not the internal array)", () => {
    const callback = jest.fn();
    const service = new TranscriptService(callback);
    service.addLine(makeLine(0));

    const windowFromCallback = callback.mock.calls[0][1] as TranscriptLine[];
    windowFromCallback.push(makeLine(99)); // mutate the callback arg

    // Internal window should not be affected
    expect(service.getWindow()).toHaveLength(1);
  });

  it("mutating getTranscript result does not affect internal state", () => {
    const service = new TranscriptService(jest.fn());
    service.addLine(makeLine(0));

    const transcript = service.getTranscript();
    transcript.push(makeLine(99));

    expect(service.getTranscript()).toHaveLength(1);
  });

  it("mutating getWindow result does not affect internal state", () => {
    const service = new TranscriptService(jest.fn());
    service.addLine(makeLine(0));

    const window = service.getWindow();
    window.push(makeLine(99));

    expect(service.getWindow()).toHaveLength(1);
  });
});

describe("TICKET-006 QA: PlaybackService edge cases", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    readFileSync.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("emits lines with correct speaker and text from fixture", () => {
    readFileSync.mockReturnValue(
      JSON.stringify([
        { speaker: "rep", text: "Hello" },
        { speaker: "prospect", text: "World" },
      ])
    );

    const service = new PlaybackService("test");
    service.loadFixture();

    const lines: TranscriptLine[] = [];
    service.start((line) => lines.push(line), jest.fn());

    jest.advanceTimersByTime(10000);

    expect(lines[0].speaker).toBe("rep");
    expect(lines[0].text).toBe("Hello");
    expect(lines[1].speaker).toBe("prospect");
    expect(lines[1].text).toBe("World");
  });

  it("handles empty fixture gracefully — calls onComplete immediately", () => {
    readFileSync.mockReturnValue(JSON.stringify([]));

    const service = new PlaybackService("empty");
    service.loadFixture();

    let completed = false;
    const lines: TranscriptLine[] = [];

    service.start(
      (line) => lines.push(line),
      () => { completed = true; }
    );

    expect(completed).toBe(true);
    expect(lines).toHaveLength(0);
  });

  it("handles single-line fixture", () => {
    readFileSync.mockReturnValue(
      JSON.stringify([{ speaker: "rep", text: "Solo" }])
    );

    const service = new PlaybackService("single");
    service.loadFixture();

    const lines: TranscriptLine[] = [];
    let completed = false;

    service.start(
      (line) => lines.push(line),
      () => { completed = true; }
    );

    // First line emitted synchronously
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("Solo");

    // onComplete fires after next timer (max delay is 4000ms)
    jest.advanceTimersByTime(4000);
    expect(completed).toBe(true);
  });

  it("stop() is safe to call when not started", () => {
    const service = new PlaybackService("test");
    // should not throw
    expect(() => service.stop()).not.toThrow();
  });

  it("stop() is safe to call multiple times", () => {
    readFileSync.mockReturnValue(
      JSON.stringify([
        { speaker: "rep", text: "A" },
        { speaker: "prospect", text: "B" },
      ])
    );

    const service = new PlaybackService("test");
    service.loadFixture();
    service.start(jest.fn(), jest.fn());
    service.stop();
    expect(() => service.stop()).not.toThrow();
  });

  it("each emitted line has a numeric timestamp > 0", () => {
    readFileSync.mockReturnValue(
      JSON.stringify([
        { speaker: "rep", text: "A" },
        { speaker: "prospect", text: "B" },
        { speaker: "rep", text: "C" },
      ])
    );

    const service = new PlaybackService("test");
    service.loadFixture();

    const lines: TranscriptLine[] = [];
    service.start((line) => lines.push(line), jest.fn());
    jest.advanceTimersByTime(10000);

    expect(lines).toHaveLength(3);
    for (const line of lines) {
      expect(typeof line.timestamp).toBe("number");
      expect(line.timestamp).toBeGreaterThan(0);
    }
  });

  it("loadFixture reads from correct path using fixtureId", () => {
    readFileSync.mockReturnValue(JSON.stringify([]));
    const service = new PlaybackService("discovery-call-001");
    service.loadFixture();

    expect(readFileSync).toHaveBeenCalledTimes(1);
    const calledPath = readFileSync.mock.calls[0][0] as string;
    expect(calledPath).toContain("src");
    expect(calledPath).toContain("fixtures");
    expect(calledPath).toContain("discovery-call-001.json");
  });

  it("first line is emitted synchronously (no delay before first line)", () => {
    readFileSync.mockReturnValue(
      JSON.stringify([
        { speaker: "rep", text: "First" },
        { speaker: "prospect", text: "Second" },
      ])
    );

    const service = new PlaybackService("test");
    service.loadFixture();

    const lines: TranscriptLine[] = [];
    service.start((line) => lines.push(line), jest.fn());

    // Before any timer advancement, first line should already be emitted
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe("First");
  });
});

describe("TICKET-006 QA: Integration — PlaybackService + TranscriptService", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    readFileSync.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("PlaybackService feeds lines into TranscriptService correctly", () => {
    readFileSync.mockReturnValue(
      JSON.stringify([
        { speaker: "rep", text: "Hello" },
        { speaker: "prospect", text: "Hi" },
        { speaker: "rep", text: "How are you?" },
      ])
    );

    const callbackArgs: Array<{ line: TranscriptLine; window: TranscriptLine[] }> = [];
    const transcriptService = new TranscriptService((line, window) => {
      callbackArgs.push({ line, window: [...window] });
    });

    const playbackService = new PlaybackService("test");
    playbackService.loadFixture();

    let completed = false;
    playbackService.start(
      (line) => transcriptService.addLine(line),
      () => { completed = true; }
    );

    // Emit all lines
    jest.advanceTimersByTime(20000);

    expect(completed).toBe(true);
    expect(transcriptService.getTranscript()).toHaveLength(3);
    expect(transcriptService.getWindow()).toHaveLength(3);
    expect(callbackArgs).toHaveLength(3);

    // Verify callback received correct data
    expect(callbackArgs[0].line.text).toBe("Hello");
    expect(callbackArgs[0].window).toHaveLength(1);
    expect(callbackArgs[1].line.text).toBe("Hi");
    expect(callbackArgs[1].window).toHaveLength(2);
    expect(callbackArgs[2].line.text).toBe("How are you?");
    expect(callbackArgs[2].window).toHaveLength(3);
  });

  it("window caps at 10 when PlaybackService emits >10 lines", () => {
    const fixtureLines = Array.from({ length: 15 }, (_, i) => ({
      speaker: i % 2 === 0 ? "rep" : "prospect",
      text: `Line ${i}`,
    }));
    readFileSync.mockReturnValue(JSON.stringify(fixtureLines));

    const transcriptService = new TranscriptService(jest.fn());

    const playbackService = new PlaybackService("test");
    playbackService.loadFixture();

    playbackService.start(
      (line) => transcriptService.addLine(line),
      jest.fn()
    );

    jest.advanceTimersByTime(60000);

    expect(transcriptService.getTranscript()).toHaveLength(15);
    expect(transcriptService.getWindow()).toHaveLength(10);
    expect(transcriptService.getWindow()[0].text).toBe("Line 5");
    expect(transcriptService.getWindow()[9].text).toBe("Line 14");
  });
});

describe("TICKET-006 QA: Type contracts", () => {
  it("TranscriptLine has speaker, text, and timestamp fields", () => {
    const line: TranscriptLine = { speaker: "rep", text: "test", timestamp: 123 };
    expect(line.speaker).toBe("rep");
    expect(line.text).toBe("test");
    expect(line.timestamp).toBe(123);
  });
});
