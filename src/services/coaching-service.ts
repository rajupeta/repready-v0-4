import { CoachingPrompt, CoachingRule, TranscriptLine } from '@/types';
import { ClaudeService, MappedRule } from './claude-service.types';

export class CoachingService {
  private claudeService: ClaudeService;

  constructor(claudeService: ClaudeService) {
    this.claudeService = claudeService;
  }

  async processTriggeredRules(
    triggeredRules: CoachingRule[],
    window: TranscriptLine[],
  ): Promise<CoachingPrompt[]> {
    if (triggeredRules.length === 0) {
      return [];
    }

    const mappedRules: MappedRule[] = triggeredRules.map((rule) => ({
      ruleId: rule.ruleId,
      ruleName: rule.name,
      description: rule.description,
    }));

    return this.claudeService.getCoachingPrompts(mappedRules, window);
  }
}
