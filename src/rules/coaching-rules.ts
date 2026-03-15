import { CoachingRule, TranscriptLine } from "@/types";

const FILLER_WORDS = [
  "um",
  "uh",
  "like",
  "you know",
  "basically",
  "actually",
  "literally",
  "right",
  "so yeah",
];

const NEXT_STEP_KEYWORDS = /\b(schedule|call|send|follow up)\b/i;

const INTEREST_PATTERNS =
  /(?<!\bnot\s)\b(yes|yeah|sure|sounds good|interested|love it|great|definitely|absolutely|let's do it|sign me up)\b/i;

function countFillerWords(text: string): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const filler of FILLER_WORDS) {
    // Use word-boundary matching for single words, substring match for phrases
    if (filler.includes(" ")) {
      // Multi-word filler: count occurrences as substrings
      let idx = 0;
      while ((idx = lower.indexOf(filler, idx)) !== -1) {
        count++;
        idx += filler.length;
      }
    } else {
      const regex = new RegExp(`\\b${filler}\\b`, "gi");
      const matches = lower.match(regex);
      if (matches) count += matches.length;
    }
  }
  return count;
}

const FEATURE_KEYWORDS =
  /\b(feature|product|platform|solution|tool|integration|dashboard|analytics|module|capability|functionality|system|software|upgrade|plan|pricing|package|tier|enterprise|offering)\b/i;

const talkRatio: CoachingRule = {
  ruleId: "talk-ratio",
  name: "Talk Ratio",
  description:
    "Rep speaks more than 65% of lines in the rolling window.",
  cooldownMs: 30000,
  detect(window: TranscriptLine[]): boolean {
    if (window.length === 0) return false;
    const repLines = window.filter((l) => l.speaker === "rep").length;
    return repLines / window.length > 0.65;
  },
};

const longMonologue: CoachingRule = {
  ruleId: "long-monologue",
  name: "Long Monologue",
  description:
    "Rep has 4+ consecutive lines without the prospect speaking in the window.",
  cooldownMs: 45000,
  detect(window: TranscriptLine[]): boolean {
    let consecutive = 0;
    for (const line of window) {
      if (line.speaker === "rep") {
        consecutive++;
        if (consecutive >= 4) return true;
      } else {
        consecutive = 0;
      }
    }
    return false;
  },
};

const noQuestions: CoachingRule = {
  ruleId: "no-questions",
  name: "No Questions Asked",
  description:
    "Among rep lines in the window, zero contain a question mark.",
  cooldownMs: 60000,
  detect(window: TranscriptLine[]): boolean {
    const repLines = window.filter((l) => l.speaker === "rep");
    if (repLines.length === 0) return false;
    return !repLines.some((l) => l.text.includes("?"));
  },
};

const fillerWords: CoachingRule = {
  ruleId: "filler-words",
  name: "Filler Words",
  description:
    "Latest rep line contains 3+ filler words.",
  cooldownMs: 20000,
  detect(window: TranscriptLine[]): boolean {
    // Find the latest rep line in the window
    for (let i = window.length - 1; i >= 0; i--) {
      if (window[i].speaker === "rep") {
        return countFillerWords(window[i].text) >= 3;
      }
    }
    return false;
  },
};

const featureDump: CoachingRule = {
  ruleId: "feature-dump",
  name: "Feature Dump",
  description:
    "3+ consecutive rep lines mention product/feature keywords without any questions.",
  cooldownMs: 45000,
  detect(window: TranscriptLine[]): boolean {
    let consecutive = 0;
    for (const line of window) {
      if (
        line.speaker === "rep" &&
        FEATURE_KEYWORDS.test(line.text) &&
        !line.text.includes("?")
      ) {
        consecutive++;
        if (consecutive >= 3) return true;
      } else {
        consecutive = 0;
      }
    }
    return false;
  },
};

const noNextSteps: CoachingRule = {
  ruleId: "no-next-steps",
  name: "No Next Steps",
  description:
    "In last 5 lines, prospect expresses interest/agreement but rep doesn't propose a next step.",
  cooldownMs: 90000,
  detect(window: TranscriptLine[]): boolean {
    const last5 = window.slice(-5);
    const prospectShowsInterest = last5.some(
      (l) => l.speaker === "prospect" && INTEREST_PATTERNS.test(l.text)
    );
    if (!prospectShowsInterest) return false;

    const repLines = last5.filter((l) => l.speaker === "rep");
    const repProposesNext = repLines.some((l) =>
      NEXT_STEP_KEYWORDS.test(l.text)
    );
    return !repProposesNext;
  },
};

export const coachingRules: CoachingRule[] = [
  talkRatio,
  longMonologue,
  noQuestions,
  fillerWords,
  featureDump,
  noNextSteps,
];
