import type { SSEEvent } from './sse';

export interface TranscriptLine {
  speaker: 'rep' | 'prospect';
  text: string;
  timestamp?: number;
}

export type CallType = 'discovery' | 'demo' | 'objection-handling' | 'follow-up';
export type Severity = 'low' | 'medium' | 'high';

export interface CoachingRule {
  ruleId: string;
  name: string;
  description: string;
  cooldownMs: number;
  callTypes: CallType[];
  severity: Severity;
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
  events: SSEEvent[];
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

export type { SSEEvent } from './sse';
