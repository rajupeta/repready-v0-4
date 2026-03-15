import { CoachingService } from '@/services/coaching-service';
import { ScorecardService } from '@/services/scorecard-service';
import { ClaudeService } from '@/services/claude-service.types';
import {
  CoachingPrompt,
  CoachingRule,
  Scorecard,
  TranscriptLine,
} from '@/types';

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
    detect: () => true,
    ...overrides,
  };
}

const sampleWindow: TranscriptLine[] = [
  { speaker: 'rep', text: 'Hello, how are you today?' },
  { speaker: 'prospect', text: 'Good, thanks for calling.' },
];

const sampleTranscript: TranscriptLine[] = [
  { speaker: 'rep', text: 'Hello, how are you today?' },
  { speaker: 'prospect', text: 'Good, thanks for calling.' },
  { speaker: 'rep', text: 'I wanted to talk about our product.' },
  { speaker: 'prospect', text: 'Sure, go ahead.' },
];

describe('CoachingService', () => {
  it('returns empty array without calling Claude when no rules triggered', async () => {
    const mockClaude = createMockClaudeService();
    const service = new CoachingService(mockClaude);

    const result = await service.processTriggeredRules([], sampleWindow);

    expect(result).toEqual([]);
    expect(mockClaude.getCoachingPrompts).not.toHaveBeenCalled();
  });

  it('calls ClaudeService.getCoachingPrompts with mapped rules and window when rules are triggered', async () => {
    const expectedPrompts: CoachingPrompt[] = [
      {
        ruleId: 'rule-1',
        ruleName: 'Test Rule',
        message: 'Try asking an open-ended question.',
        timestamp: Date.now(),
      },
    ];

    const mockClaude = createMockClaudeService({
      getCoachingPrompts: jest.fn().mockResolvedValue(expectedPrompts),
    });

    const service = new CoachingService(mockClaude);
    const rules = [createRule()];

    const result = await service.processTriggeredRules(rules, sampleWindow);

    expect(mockClaude.getCoachingPrompts).toHaveBeenCalledTimes(1);
    expect(mockClaude.getCoachingPrompts).toHaveBeenCalledWith(
      [{ ruleId: 'rule-1', ruleName: 'Test Rule', description: 'A test rule' }],
      sampleWindow,
    );
    expect(result).toEqual(expectedPrompts);
  });

  it('maps multiple rules correctly', async () => {
    const mockClaude = createMockClaudeService({
      getCoachingPrompts: jest.fn().mockResolvedValue([]),
    });

    const service = new CoachingService(mockClaude);
    const rules = [
      createRule({ ruleId: 'rule-1', name: 'Rule One', description: 'First rule' }),
      createRule({ ruleId: 'rule-2', name: 'Rule Two', description: 'Second rule' }),
    ];

    await service.processTriggeredRules(rules, sampleWindow);

    expect(mockClaude.getCoachingPrompts).toHaveBeenCalledWith(
      [
        { ruleId: 'rule-1', ruleName: 'Rule One', description: 'First rule' },
        { ruleId: 'rule-2', ruleName: 'Rule Two', description: 'Second rule' },
      ],
      sampleWindow,
    );
  });
});

describe('ScorecardService', () => {
  it('calls ClaudeService.generateScorecard with full transcript and mapped rules', async () => {
    const expectedScorecard: Scorecard = {
      entries: [
        {
          ruleId: 'rule-1',
          ruleName: 'Test Rule',
          assessment: 'good',
          comment: 'Well done.',
        },
      ],
      overallScore: 85,
      summary: 'Good performance overall.',
    };

    const mockClaude = createMockClaudeService({
      generateScorecard: jest.fn().mockResolvedValue(expectedScorecard),
    });

    const service = new ScorecardService(mockClaude);
    const rules = [createRule()];

    const result = await service.generate(sampleTranscript, rules);

    expect(mockClaude.generateScorecard).toHaveBeenCalledTimes(1);
    expect(mockClaude.generateScorecard).toHaveBeenCalledWith(
      sampleTranscript,
      [{ ruleId: 'rule-1', ruleName: 'Test Rule', description: 'A test rule' }],
    );
    expect(result).toEqual(expectedScorecard);
  });

  it('maps multiple rules correctly for scorecard generation', async () => {
    const mockClaude = createMockClaudeService();
    const service = new ScorecardService(mockClaude);

    const rules = [
      createRule({ ruleId: 'r1', name: 'Rule A', description: 'Desc A' }),
      createRule({ ruleId: 'r2', name: 'Rule B', description: 'Desc B' }),
    ];

    await service.generate(sampleTranscript, rules);

    expect(mockClaude.generateScorecard).toHaveBeenCalledWith(
      sampleTranscript,
      [
        { ruleId: 'r1', ruleName: 'Rule A', description: 'Desc A' },
        { ruleId: 'r2', ruleName: 'Rule B', description: 'Desc B' },
      ],
    );
  });

  it('returns the scorecard from ClaudeService', async () => {
    const scorecard: Scorecard = {
      entries: [],
      overallScore: 50,
      summary: 'Average.',
    };

    const mockClaude = createMockClaudeService({
      generateScorecard: jest.fn().mockResolvedValue(scorecard),
    });

    const service = new ScorecardService(mockClaude);
    const result = await service.generate([], []);

    expect(result).toEqual(scorecard);
  });
});
