export interface TranscriptLine {
  speaker: "rep" | "prospect";
  text: string;
  timestamp?: number;
}

export interface CoachingRule {
  ruleId: string;
  name: string;
  description: string;
  cooldownMs: number;
  detect: (window: TranscriptLine[]) => boolean;
}
