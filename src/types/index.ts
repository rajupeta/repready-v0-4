export interface TranscriptLine {
  speaker: 'rep' | 'prospect';
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

export interface CoachingPrompt {
  ruleId: string;
  ruleName: string;
  message: string;
  timestamp: number;
}

export interface Session {
  id: string;
  status: 'idle' | 'active' | 'completed';
  fixtureId: string;
  transcript: TranscriptLine[];
  scorecard?: Scorecard;
}

export interface ScorecardEntry {
  ruleId: string;
  ruleName: string;
  assessment: 'good' | 'needs-work' | 'missed';
  comment: string;
}

export interface Scorecard {
  entries: ScorecardEntry[];
  overallScore: number;
  summary: string;
}

export interface RuleDefinition {
  ruleId: string;
  ruleName: string;
  description: string;
}

export interface SSEEvent {
  event: 'transcript' | 'coaching_prompt' | 'session_complete' | 'heartbeat';
  data: unknown;
}
