import { readFileSync } from "fs";
import { join } from "path";
import type { FixtureLine } from "@/types/transcript";
import type { TranscriptLine } from "@/types";

export class PlaybackService {
  private fixtureId: string;
  private lines: FixtureLine[] = [];
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(fixtureId: string) {
    this.fixtureId = fixtureId;
  }

  loadFixture(): void {
    const filePath = join(process.cwd(), "src", "fixtures", `${this.fixtureId}.json`);
    const raw = readFileSync(filePath, "utf-8");
    this.lines = JSON.parse(raw) as FixtureLine[];
  }

  loadLines(lines: FixtureLine[]): void {
    this.lines = lines;
  }

  start(
    onLine: (line: TranscriptLine) => void,
    onComplete: () => void
  ): void {
    let index = 0;

    const emitNext = () => {
      if (index >= this.lines.length) {
        this.pendingTimeout = null;
        onComplete();
        return;
      }

      const fixture = this.lines[index];
      const transcriptLine: TranscriptLine = {
        speaker: fixture.speaker as TranscriptLine['speaker'],
        text: fixture.text,
        timestamp: Date.now(),
      };

      onLine(transcriptLine);
      index++;

      const delay = 2000 + Math.random() * 2000; // 2-4 seconds
      this.pendingTimeout = setTimeout(emitNext, delay);
    };

    emitNext();
  }

  stop(): void {
    if (this.pendingTimeout !== null) {
      clearTimeout(this.pendingTimeout);
      this.pendingTimeout = null;
    }
  }
}
