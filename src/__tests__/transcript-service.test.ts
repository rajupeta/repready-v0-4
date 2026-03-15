import { TranscriptService } from "@/services/transcript-service";
import type { TranscriptLine } from "@/types";

function makeLine(index: number): TranscriptLine {
  return {
    speaker: index % 2 === 0 ? "rep" : "prospect",
    text: `Line ${index}`,
    timestamp: Date.now() + index,
  };
}

describe("TranscriptService", () => {
  it("should call onLineAdded callback with the line and current window", () => {
    const callback = jest.fn();
    const service = new TranscriptService(callback);

    const line = makeLine(0);
    service.addLine(line);

    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(line, [line]);
  });

  it("should grow the full transcript with each addLine call", () => {
    const service = new TranscriptService(jest.fn());

    for (let i = 0; i < 15; i++) {
      service.addLine(makeLine(i));
    }

    const transcript = service.getTranscript();
    expect(transcript).toHaveLength(15);
    expect(transcript[0].text).toBe("Line 0");
    expect(transcript[14].text).toBe("Line 14");
  });

  it("should keep the rolling window at max 10 lines", () => {
    const service = new TranscriptService(jest.fn());

    for (let i = 0; i < 15; i++) {
      service.addLine(makeLine(i));
    }

    const window = service.getWindow();
    expect(window).toHaveLength(10);
    expect(window[0].text).toBe("Line 5");
    expect(window[9].text).toBe("Line 14");
  });

  it("should return the window at exactly 10 when 10 lines are added", () => {
    const service = new TranscriptService(jest.fn());

    for (let i = 0; i < 10; i++) {
      service.addLine(makeLine(i));
    }

    expect(service.getWindow()).toHaveLength(10);
    expect(service.getTranscript()).toHaveLength(10);
  });

  it("should return copies from getWindow and getTranscript (not references)", () => {
    const service = new TranscriptService(jest.fn());
    service.addLine(makeLine(0));

    const window1 = service.getWindow();
    const window2 = service.getWindow();
    expect(window1).not.toBe(window2);
    expect(window1).toEqual(window2);

    const transcript1 = service.getTranscript();
    const transcript2 = service.getTranscript();
    expect(transcript1).not.toBe(transcript2);
    expect(transcript1).toEqual(transcript2);
  });

  it("should pass the correct window to callback as lines accumulate beyond 10", () => {
    const callback = jest.fn();
    const service = new TranscriptService(callback);

    for (let i = 0; i < 12; i++) {
      service.addLine(makeLine(i));
    }

    // The 12th call (index 11) should have a window of lines 2-11
    const lastCall = callback.mock.calls[11];
    const windowArg = lastCall[1] as TranscriptLine[];
    expect(windowArg).toHaveLength(10);
    expect(windowArg[0].text).toBe("Line 2");
    expect(windowArg[9].text).toBe("Line 11");
  });
});
