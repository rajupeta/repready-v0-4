import * as fs from "fs";
import * as path from "path";
import type { TranscriptLine } from "@/types";

describe("Fixture files", () => {
  const fixturesDir = path.join(process.cwd(), "src", "fixtures");

  const fixtureFiles = ["discovery-call.json", "demo-call.json"];

  it.each(fixtureFiles)("%s exists and is valid JSON", (filename) => {
    const filePath = path.join(fixturesDir, filename);
    expect(fs.existsSync(filePath)).toBe(true);

    const content = fs.readFileSync(filePath, "utf-8");
    const lines = JSON.parse(content);
    expect(Array.isArray(lines)).toBe(true);
  });

  it.each(fixtureFiles)("%s has approximately 25 lines", (filename) => {
    const filePath = path.join(fixturesDir, filename);
    const lines = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    expect(lines.length).toBeGreaterThanOrEqual(20);
    expect(lines.length).toBeLessThanOrEqual(30);
  });

  it.each(fixtureFiles)(
    "%s has valid speaker values (rep or prospect)",
    (filename) => {
      const filePath = path.join(fixturesDir, filename);
      const lines: TranscriptLine[] = JSON.parse(
        fs.readFileSync(filePath, "utf-8")
      );

      lines.forEach((line) => {
        expect(["rep", "prospect"]).toContain(line.speaker);
        expect(typeof line.text).toBe("string");
        expect(line.text.length).toBeGreaterThan(0);
      });
    }
  );

  it.each(fixtureFiles)(
    "%s has only speaker and text fields (no timestamps)",
    (filename) => {
      const filePath = path.join(fixturesDir, filename);
      const lines = JSON.parse(fs.readFileSync(filePath, "utf-8"));

      lines.forEach((line: Record<string, unknown>) => {
        const keys = Object.keys(line);
        expect(keys).toEqual(expect.arrayContaining(["speaker", "text"]));
        expect(keys.length).toBe(2);
      });
    }
  );

  it.each(fixtureFiles)("%s includes coachable moments", (filename) => {
    const filePath = path.join(fixturesDir, filename);
    const lines: TranscriptLine[] = JSON.parse(
      fs.readFileSync(filePath, "utf-8")
    );

    const allText = lines.map((l) => l.text.toLowerCase()).join(" ");

    // Check for filler words (um, uh, like, you know)
    const hasFillerWords = /\b(um|uh|like|you know)\b/.test(allText);

    // Check for long rep monologues (text > 200 chars)
    const hasMonologue = lines.some(
      (l) => l.speaker === "rep" && l.text.length > 200
    );

    // Check for feature dumping (lists of features)
    const hasFeatureDump = lines.some(
      (l) => l.speaker === "rep" && (l.text.match(/,/g) || []).length >= 4
    );

    expect(hasFillerWords).toBe(true);
    expect(hasMonologue).toBe(true);
    expect(hasFeatureDump).toBe(true);
  });

  it("both fixtures have a mix of rep and prospect lines", () => {
    fixtureFiles.forEach((filename) => {
      const filePath = path.join(fixturesDir, filename);
      const lines: TranscriptLine[] = JSON.parse(
        fs.readFileSync(filePath, "utf-8")
      );

      const repLines = lines.filter((l) => l.speaker === "rep");
      const prospectLines = lines.filter((l) => l.speaker === "prospect");

      expect(repLines.length).toBeGreaterThan(0);
      expect(prospectLines.length).toBeGreaterThan(0);
    });
  });
});
