import { CoachingPrompt, Scorecard, TranscriptLine } from '@/types';

export interface MappedRule {
  ruleId: string;
  ruleName: string;
  description: string;
}

export interface ClaudeService {
  getCoachingPrompts(rules: MappedRule[], window: TranscriptLine[]): Promise<CoachingPrompt[]>;
  generateScorecard(transcript: TranscriptLine[], rules: MappedRule[]): Promise<Scorecard>;
}
