import type { TranscriptLine } from "@/types";

const MAX_WINDOW_SIZE = 10;

export class TranscriptService {
  private window: TranscriptLine[] = [];
  private transcript: TranscriptLine[] = [];
  private onLineAdded: (line: TranscriptLine, window: TranscriptLine[]) => void;

  constructor(
    onLineAdded: (line: TranscriptLine, window: TranscriptLine[]) => void
  ) {
    this.onLineAdded = onLineAdded;
  }

  /**
   * The v0/v1 boundary. In v0, PlaybackService calls this.
   * In v1, a Deepgram webhook would call this.
   * Everything downstream is unchanged.
   */
  addLine(line: TranscriptLine): void {
    this.transcript.push(line);
    this.window.push(line);

    if (this.window.length > MAX_WINDOW_SIZE) {
      this.window = this.window.slice(-MAX_WINDOW_SIZE);
    }

    this.onLineAdded(line, this.getWindow());
  }

  getWindow(): TranscriptLine[] {
    return [...this.window];
  }

  getTranscript(): TranscriptLine[] {
    return [...this.transcript];
  }
}
