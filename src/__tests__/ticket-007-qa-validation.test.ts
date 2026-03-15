/**
 * TICKET-007 QA Validation — Edge cases and additional coverage
 * Test Agent: validates CoachingService and ScorecardService behavior
 */
import { CoachingService } from '@/services/coaching-service';
import { ScorecardService } from '@/services/scorecard-service';
import { ClaudeService } from '@/services/claude-service.types';
import { CoachingRule, TranscriptLine } from '@/types';

function createMockClaudeService(overrides?: Partial<ClaudeService>): ClaudeService {
  return {
    getCoachingPrompts: jest.fn().mockResolvedValue([]),
    generateScorecard: jest.fn().mockResolvedValue({
      entries: [],
      overallScore: 0,
      summary: '',
    }),
    ...overrides,
  };
}

function createRule(overrides?: Partial<CoachingRule>): CoachingRule {
  return {
    ruleId: 'rule-1',
    name: 'Test Rule',
    description: 'A test rule',
    cooldownMs: 5000,
    callTypes: ['discovery', 'demo', 'objection-handling', 'follow-up'],
    severity: 'medium',
    detect: () => true,
    ...overrides,
  };
}

describe('CoachingService — edge cases', () => {
  it('propagates errors from ClaudeService.getCoachingPrompts', async () => {
    const mockClaude = createMockClaudeService({
      getCoachingPrompts: jest.fn().mockRejectedValue(new Error('Claude API failed')),
    });
    const service = new CoachingService(mockClaude);
    const rules = [createRule()];
    const window: TranscriptLine[] = [{ speaker: 'rep', text: 'Hello' }];

    await expect(service.processTriggeredRules(rules, window)).rejects.toThrow('Claude API failed');
  });

  it('works with an empty window but rules present', async () => {
    const mockClaude = createMockClaudeService({
      getCoachingPrompts: jest.fn().mockResolvedValue([]),
    });
    const service = new CoachingService(mockClaude);
    const rules = [createRule()];

    const result = await service.processTriggeredRules(rules, []);

    expect(mockClaude.getCoachingPrompts).toHaveBeenCalledWith(
      [{ ruleId: 'rule-1', ruleName: 'Test Rule', description: 'A test rule' }],
      [],
    );
    expect(result).toEqual([]);
  });

  it('only maps ruleId, ruleName, and description — does not leak detect or cooldownMs', async () => {
    const mockClaude = createMockClaudeService({
      getCoachingPrompts: jest.fn().mockResolvedValue([]),
    });
    const service = new CoachingService(mockClaude);
    const rules = [createRule({ cooldownMs: 99999, ruleId: 'leak-test' })];

    await service.processTriggeredRules(rules, []);

    const calledWith = (mockClaude.getCoachingPrompts as jest.Mock).mock.calls[0][0];
    expect(calledWith[0]).toEqual({
      ruleId: 'leak-test',
      ruleName: 'Test Rule',
      description: 'A test rule',
    });
    expect(calledWith[0]).not.toHaveProperty('cooldownMs');
    expect(calledWith[0]).not.toHaveProperty('detect');
  });
});

describe('ScorecardService — edge cases', () => {
  it('propagates errors from ClaudeService.generateScorecard', async () => {
    const mockClaude = createMockClaudeService({
      generateScorecard: jest.fn().mockRejectedValue(new Error('Scorecard generation failed')),
    });
    const service = new ScorecardService(mockClaude);

    await expect(service.generate([], [])).rejects.toThrow('Scorecard generation failed');
  });

  it('handles empty transcript and empty rules', async () => {
    const mockClaude = createMockClaudeService();
    const service = new ScorecardService(mockClaude);

    const result = await service.generate([], []);

    expect(mockClaude.generateScorecard).toHaveBeenCalledWith([], []);
    expect(result).toEqual({ entries: [], overallScore: 0, summary: '' });
  });

  it('only maps ruleId, ruleName, and description — does not leak detect or cooldownMs', async () => {
    const mockClaude = createMockClaudeService();
    const service = new ScorecardService(mockClaude);
    const rules = [createRule({ cooldownMs: 99999, ruleId: 'leak-test' })];

    await service.generate([{ speaker: 'rep', text: 'Hi' }], rules);

    const calledWith = (mockClaude.generateScorecard as jest.Mock).mock.calls[0][1];
    expect(calledWith[0]).toEqual({
      ruleId: 'leak-test',
      ruleName: 'Test Rule',
      description: 'A test rule',
    });
    expect(calledWith[0]).not.toHaveProperty('cooldownMs');
    expect(calledWith[0]).not.toHaveProperty('detect');
  });
});
