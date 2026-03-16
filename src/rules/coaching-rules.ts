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
  "i think maybe",
  "sort of",
];

const NEXT_STEP_KEYWORDS = /\b(schedule|call|send|follow up|book|meeting|demo|next step|action item)\b/i;

const INTEREST_PATTERNS =
  /(?<!\bnot\s)\b(yes|yeah|sure|sounds good|interested|love it|great|definitely|absolutely|let's do it|sign me up)\b/i;

const QUESTION_WORDS_PATTERN = /\b(what|how|why|where|when|who|which|could you|can you|would you|do you|tell me)\b/i;

const OBJECTION_PATTERNS =
  /\b(too expensive|not sure|don't think|can't afford|not ready|don't need|already have|not interested|too much|budget|cost concern|price is high|we're good|pass on|not a priority|concern)\b/i;

const OBJECTION_ADDRESSED_PATTERNS =
  /\b(understand|hear you|appreciate|let me address|great point|valid concern|makes sense|fair point|I get that|that's a good question|let me explain|here's how|what if|consider)\b/i;

const COMPETITOR_PATTERNS =
  /\b(competitor|alternative|other option|also looking at|compared to|versus|vs\.|currently using|switched from|thinking about|evaluating|considering)\b/i;

const COMPETITOR_EXPLORED_PATTERNS =
  /\b(what do you like|how does that compare|what's missing|why are you looking|what made you|tell me about your experience|what's working|what's not working|how long have you)\b/i;

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
  callTypes: ["discovery", "demo", "objection-handling", "follow-up", "pricing", "cold-call"],
  severity: "medium",
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
  callTypes: ["discovery", "demo", "objection-handling", "follow-up", "pricing", "cold-call"],
  severity: "medium",
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
    "Among rep lines in the window, none contain a question mark or question words (what/how/why/etc).",
  cooldownMs: 60000,
  callTypes: ["discovery", "demo", "follow-up", "cold-call"],
  severity: "high",
  detect(window: TranscriptLine[]): boolean {
    const repLines = window.filter((l) => l.speaker === "rep");
    if (repLines.length === 0) return false;
    return !repLines.some(
      (l) => l.text.includes("?") || QUESTION_WORDS_PATTERN.test(l.text)
    );
  },
};

const fillerWords: CoachingRule = {
  ruleId: "filler-words",
  name: "Filler Words",
  description:
    "Latest rep line contains 3+ filler words including hedging language (\"I think maybe\", \"sort of\").",
  cooldownMs: 20000,
  callTypes: ["discovery", "demo", "objection-handling", "follow-up", "pricing", "cold-call"],
  severity: "low",
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
  callTypes: ["demo", "discovery", "cold-call"],
  severity: "medium",
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
    "Prospect expresses interest but rep doesn't propose a next step. Checks last 5 lines and midpoint of window.",
  cooldownMs: 90000,
  callTypes: ["discovery", "demo", "objection-handling", "follow-up", "pricing", "cold-call"],
  severity: "high",
  detect(window: TranscriptLine[]): boolean {
    // Check last 5 lines
    const last5 = window.slice(-5);
    const last5Interest = last5.some(
      (l) => l.speaker === "prospect" && INTEREST_PATTERNS.test(l.text)
    );
    if (last5Interest) {
      const repLines = last5.filter((l) => l.speaker === "rep");
      const repProposesNext = repLines.some((l) =>
        NEXT_STEP_KEYWORDS.test(l.text)
      );
      if (!repProposesNext) return true;
    }

    // Midpoint check: if window is long enough, check the middle portion too
    if (window.length >= 6) {
      const midStart = Math.floor(window.length / 2) - 2;
      const midEnd = Math.floor(window.length / 2) + 3;
      const midSlice = window.slice(midStart, midEnd);
      const midInterest = midSlice.some(
        (l) => l.speaker === "prospect" && INTEREST_PATTERNS.test(l.text)
      );
      if (midInterest) {
        const midRepLines = midSlice.filter((l) => l.speaker === "rep");
        const midRepProposesNext = midRepLines.some((l) =>
          NEXT_STEP_KEYWORDS.test(l.text)
        );
        if (!midRepProposesNext) return true;
      }
    }

    return false;
  },
};

const objectionDeflected: CoachingRule = {
  ruleId: "objection-deflected",
  name: "Objection Deflected",
  description:
    "Prospect raises an objection but rep deflects instead of addressing it directly.",
  cooldownMs: 60000,
  callTypes: ["objection-handling", "demo", "discovery", "pricing"],
  severity: "high",
  detect(window: TranscriptLine[]): boolean {
    // Look for prospect objection followed by rep NOT addressing it
    for (let i = 0; i < window.length - 1; i++) {
      const line = window[i];
      if (line.speaker === "prospect" && OBJECTION_PATTERNS.test(line.text)) {
        // Check if any subsequent rep line in the window addresses the objection
        const subsequentRepLines = window
          .slice(i + 1)
          .filter((l) => l.speaker === "rep");
        if (subsequentRepLines.length === 0) continue;
        const addressed = subsequentRepLines.some((l) =>
          OBJECTION_ADDRESSED_PATTERNS.test(l.text)
        );
        if (!addressed) return true;
      }
    }
    return false;
  },
};

const competitorNotExplored: CoachingRule = {
  ruleId: "competitor-not-explored",
  name: "Competitor Not Explored",
  description:
    "Prospect mentions a competitor or alternative but rep doesn't explore it further.",
  cooldownMs: 60000,
  callTypes: ["discovery", "demo", "objection-handling", "pricing"],
  severity: "medium",
  detect(window: TranscriptLine[]): boolean {
    // Look for prospect mentioning a competitor followed by rep NOT exploring
    for (let i = 0; i < window.length - 1; i++) {
      const line = window[i];
      if (
        line.speaker === "prospect" &&
        COMPETITOR_PATTERNS.test(line.text)
      ) {
        // Check if any subsequent rep line explores the competitor mention
        const subsequentRepLines = window
          .slice(i + 1)
          .filter((l) => l.speaker === "rep");
        if (subsequentRepLines.length === 0) continue;
        const explored = subsequentRepLines.some((l) =>
          COMPETITOR_EXPLORED_PATTERNS.test(l.text)
        );
        if (!explored) return true;
      }
    }
    return false;
  },
};

export const coachingRules: CoachingRule[] = [
  talkRatio,
  longMonologue,
  noQuestions,
  fillerWords,
  featureDump,
  noNextSteps,
  objectionDeflected,
  competitorNotExplored,
];
