import { GET } from '@/app/api/rules/route';
import { coachingRules } from '@/rules/coaching-rules';

describe('GET /api/rules', () => {
  it('returns 200 with an array of coaching rules', async () => {
    const response = await GET();
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(Array.isArray(json)).toBe(true);
    expect(json.length).toBe(coachingRules.length);
  });

  it('returns each rule with ruleId, name, description, and cooldownMs', async () => {
    const response = await GET();
    const json = await response.json();

    for (const rule of json) {
      expect(rule).toHaveProperty('ruleId');
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('description');
      expect(rule).toHaveProperty('cooldownMs');
      expect(typeof rule.ruleId).toBe('string');
      expect(typeof rule.name).toBe('string');
      expect(typeof rule.description).toBe('string');
      expect(typeof rule.cooldownMs).toBe('number');
    }
  });

  it('does not expose the detect function in the response', async () => {
    const response = await GET();
    const json = await response.json();

    for (const rule of json) {
      expect(rule).not.toHaveProperty('detect');
    }
  });

  it('returns the expected rule IDs', async () => {
    const response = await GET();
    const json = await response.json();
    const ruleIds = json.map((r: { ruleId: string }) => r.ruleId);

    expect(ruleIds).toContain('talk-ratio');
    expect(ruleIds).toContain('long-monologue');
    expect(ruleIds).toContain('no-questions');
    expect(ruleIds).toContain('filler-words');
    expect(ruleIds).toContain('feature-dump');
    expect(ruleIds).toContain('no-next-steps');
  });

  it('each rule has only the expected keys', async () => {
    const response = await GET();
    const json = await response.json();
    const expectedKeys = ['ruleId', 'name', 'description', 'cooldownMs'];

    for (const rule of json) {
      expect(Object.keys(rule).sort()).toEqual(expectedKeys.sort());
    }
  });
});
