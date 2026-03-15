import { CoachingRule, Scorecard, TranscriptLine } from '@/types';
import { ClaudeService, MappedRule } from './claude-service.types';

export class ScorecardService {
  private claudeService: ClaudeService;

  constructor(claudeService: ClaudeService) {
    this.claudeService = claudeService;
  }

  async generate(
    transcript: TranscriptLine[],
    rules: CoachingRule[],
  ): Promise<Scorecard> {
    const mappedRules: MappedRule[] = rules.map((rule) => ({
      ruleId: rule.ruleId,
      ruleName: rule.name,
      description: rule.description,
    }));

    return this.claudeService.generateScorecard(transcript, mappedRules);
  }
}
