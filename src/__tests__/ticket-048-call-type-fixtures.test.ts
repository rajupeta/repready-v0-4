/**
 * TICKET-048: Add more call type fixtures — follow-up, demo, pricing, cold call
 *
 * Tests:
 * - At least 6 call type fixtures exist
 * - Each fixture triggers different coaching rules
 * - Dropdown shows friendly names
 * - Each fixture has unique conversation flow
 */

import fs from 'fs';
import path from 'path';
import type { TranscriptLine } from '@/types';
import {
  getAllCallTypes,
  getCallTypeDisplayName,
  getFixturesForCallType,
  getDefaultFixture,
  inferCallType,
  VALID_CALL_TYPES,
} from '@/lib/call-type-routing';
import { coachingRules } from '@/rules/coaching-rules';

const fixturesDir = path.join(process.cwd(), 'src', 'fixtures');

function loadFixture(name: string): TranscriptLine[] {
  return JSON.parse(
    fs.readFileSync(path.join(fixturesDir, `${name}.json`), 'utf-8'),
  );
}

// ---------------------------------------------------------------------------
// AC1: At least 6 call type fixtures
// ---------------------------------------------------------------------------
describe('AC1: At least 6 call type fixtures', () => {
  it('has at least 6 fixture files on disk', () => {
    const files = fs
      .readdirSync(fixturesDir)
      .filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it('has 6 valid call types defined', () => {
    expect(VALID_CALL_TYPES).toContain('discovery');
    expect(VALID_CALL_TYPES).toContain('demo');
    expect(VALID_CALL_TYPES).toContain('objection-handling');
    expect(VALID_CALL_TYPES).toContain('follow-up');
    expect(VALID_CALL_TYPES).toContain('pricing');
    expect(VALID_CALL_TYPES).toContain('cold-call');
    expect(VALID_CALL_TYPES).toHaveLength(6);
  });

  it('each call type has at least one fixture', () => {
    for (const ct of VALID_CALL_TYPES) {
      const fixtures = getFixturesForCallType(ct);
      expect(fixtures.length).toBeGreaterThan(0);
    }
  });

  const expectedFixtures = [
    'discovery-call-001',
    'objection-handling-001',
    'demo-call-001',
    'follow-up-call-001',
    'pricing-call-001',
    'cold-call-001',
  ];

  for (const fixture of expectedFixtures) {
    it(`${fixture}.json exists on disk`, () => {
      const filePath = path.join(fixturesDir, `${fixture}.json`);
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it(`${fixture}.json has valid format (speaker + text)`, () => {
      const data = loadFixture(fixture);
      expect(data.length).toBeGreaterThanOrEqual(15);
      for (const line of data) {
        expect(['rep', 'prospect']).toContain(line.speaker);
        expect(typeof line.text).toBe('string');
        expect(line.text.length).toBeGreaterThan(0);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// AC2: Each fixture triggers different coaching rules
// ---------------------------------------------------------------------------
describe('AC2: Each fixture triggers different coaching rules', () => {
  function getTriggeredRuleIds(fixtureId: string): Set<string> {
    const data = loadFixture(fixtureId);
    const triggered = new Set<string>();
    const callType = inferCallType(fixtureId);

    // Filter rules applicable to this call type
    const applicableRules = coachingRules.filter((r) =>
      r.callTypes.includes(callType),
    );

    // Simulate a rolling 10-line window across the transcript
    for (let i = 0; i < data.length; i++) {
      const start = Math.max(0, i - 9);
      const window = data.slice(start, i + 1).map((l) => ({
        ...l,
        timestamp: Date.now(),
      }));

      for (const rule of applicableRules) {
        if (rule.detect(window)) {
          triggered.add(rule.ruleId);
        }
      }
    }

    return triggered;
  }

  it('discovery-call-001 triggers coaching rules', () => {
    const triggered = getTriggeredRuleIds('discovery-call-001');
    expect(triggered.size).toBeGreaterThan(0);
  });

  it('objection-handling-001 triggers coaching rules', () => {
    const triggered = getTriggeredRuleIds('objection-handling-001');
    expect(triggered.size).toBeGreaterThan(0);
  });

  it('demo-call-001 triggers coaching rules', () => {
    const triggered = getTriggeredRuleIds('demo-call-001');
    expect(triggered.size).toBeGreaterThan(0);
    // Demo should trigger feature-dump (rep lists many features)
    expect(triggered.has('feature-dump') || triggered.has('long-monologue')).toBe(true);
  });

  it('follow-up-call-001 triggers coaching rules', () => {
    const triggered = getTriggeredRuleIds('follow-up-call-001');
    expect(triggered.size).toBeGreaterThan(0);
    // Follow-up should trigger filler-words
    expect(triggered.has('filler-words')).toBe(true);
  });

  it('pricing-call-001 triggers coaching rules', () => {
    const triggered = getTriggeredRuleIds('pricing-call-001');
    expect(triggered.size).toBeGreaterThan(0);
  });

  it('cold-call-001 triggers coaching rules', () => {
    const triggered = getTriggeredRuleIds('cold-call-001');
    expect(triggered.size).toBeGreaterThan(0);
    // Cold call should trigger long-monologue (rep pitches too long)
    expect(triggered.has('long-monologue') || triggered.has('feature-dump')).toBe(true);
  });

  it('different fixtures trigger different rule combinations', () => {
    const allTriggered = [
      'discovery-call-001',
      'objection-handling-001',
      'demo-call-001',
      'follow-up-call-001',
      'pricing-call-001',
      'cold-call-001',
    ].map((id) => getTriggeredRuleIds(id));

    // At least some fixtures should have different triggered rule sets
    const uniqueSets = new Set(allTriggered.map((s) => [...s].sort().join(',')));
    expect(uniqueSets.size).toBeGreaterThanOrEqual(3);
  });
});

// ---------------------------------------------------------------------------
// AC3: Dropdown shows friendly names
// ---------------------------------------------------------------------------
describe('AC3: Dropdown shows friendly names', () => {
  it('getAllCallTypes returns all 6 call types with display names', () => {
    const types = getAllCallTypes();
    expect(types).toHaveLength(6);

    const displayNames = types.map((t) => t.displayName);
    expect(displayNames).toContain('Discovery Call');
    expect(displayNames).toContain('Demo Call');
    expect(displayNames).toContain('Objection Handling');
    expect(displayNames).toContain('Follow-Up Call');
    expect(displayNames).toContain('Pricing Call');
    expect(displayNames).toContain('Cold Call');
  });

  it('getCallTypeDisplayName returns correct names', () => {
    expect(getCallTypeDisplayName('discovery')).toBe('Discovery Call');
    expect(getCallTypeDisplayName('demo')).toBe('Demo Call');
    expect(getCallTypeDisplayName('objection-handling')).toBe('Objection Handling');
    expect(getCallTypeDisplayName('follow-up')).toBe('Follow-Up Call');
    expect(getCallTypeDisplayName('pricing')).toBe('Pricing Call');
    expect(getCallTypeDisplayName('cold-call')).toBe('Cold Call');
  });

  it('each entry has both callType and displayName', () => {
    const types = getAllCallTypes();
    for (const t of types) {
      expect(typeof t.callType).toBe('string');
      expect(t.callType.length).toBeGreaterThan(0);
      expect(typeof t.displayName).toBe('string');
      expect(t.displayName.length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// AC4: Each fixture has unique conversation flow
// ---------------------------------------------------------------------------
describe('AC4: Each fixture has unique conversation flow', () => {
  const fixtureIds = [
    'discovery-call-001',
    'objection-handling-001',
    'demo-call-001',
    'follow-up-call-001',
    'pricing-call-001',
    'cold-call-001',
  ];

  it('no two fixtures have identical content', () => {
    const contents = fixtureIds.map((id) =>
      JSON.stringify(loadFixture(id)),
    );

    const uniqueContents = new Set(contents);
    expect(uniqueContents.size).toBe(fixtureIds.length);
  });

  it('each fixture has different opening lines', () => {
    const openings = fixtureIds.map((id) => {
      const data = loadFixture(id);
      return data[0].text;
    });

    const uniqueOpenings = new Set(openings);
    expect(uniqueOpenings.size).toBe(fixtureIds.length);
  });

  it('demo-call-001 focuses on product demonstration', () => {
    const data = loadFixture('demo-call-001');
    const allText = data.map((l) => l.text).join(' ').toLowerCase();
    expect(allText).toMatch(/demo|dashboard|platform|feature/i);
  });

  it('follow-up-call-001 references previous conversation', () => {
    const data = loadFixture('follow-up-call-001');
    const allText = data.map((l) => l.text).join(' ').toLowerCase();
    expect(allText).toMatch(/follow up|last time|we spoke|previous/i);
  });

  it('pricing-call-001 focuses on pricing negotiation', () => {
    const data = loadFixture('pricing-call-001');
    const allText = data.map((l) => l.text).join(' ').toLowerCase();
    expect(allText).toMatch(/pricing|price|cost|budget|per seat/i);
  });

  it('cold-call-001 is a cold outreach scenario', () => {
    const data = loadFixture('cold-call-001');
    const allText = data.map((l) => l.text).join(' ').toLowerCase();
    expect(allText).toMatch(/noticed|reaching out|catching you/i);
  });
});

// ---------------------------------------------------------------------------
// Routing: inferCallType works for new fixtures
// ---------------------------------------------------------------------------
describe('inferCallType works for new fixture types', () => {
  it('infers pricing from pricing-call-001', () => {
    expect(inferCallType('pricing-call-001')).toBe('pricing');
  });

  it('infers cold-call from cold-call-001', () => {
    expect(inferCallType('cold-call-001')).toBe('cold-call');
  });

  it('infers demo from demo-call-001', () => {
    expect(inferCallType('demo-call-001')).toBe('demo');
  });

  it('infers follow-up from follow-up-call-001', () => {
    expect(inferCallType('follow-up-call-001')).toBe('follow-up');
  });
});

// ---------------------------------------------------------------------------
// Default fixtures resolve correctly
// ---------------------------------------------------------------------------
describe('getDefaultFixture returns correct fixture for each call type', () => {
  it('discovery -> discovery-call-001', () => {
    expect(getDefaultFixture('discovery')).toBe('discovery-call-001');
  });

  it('demo -> demo-call-001', () => {
    expect(getDefaultFixture('demo')).toBe('demo-call-001');
  });

  it('objection-handling -> objection-handling-001', () => {
    expect(getDefaultFixture('objection-handling')).toBe('objection-handling-001');
  });

  it('follow-up -> follow-up-call-001', () => {
    expect(getDefaultFixture('follow-up')).toBe('follow-up-call-001');
  });

  it('pricing -> pricing-call-001', () => {
    expect(getDefaultFixture('pricing')).toBe('pricing-call-001');
  });

  it('cold-call -> cold-call-001', () => {
    expect(getDefaultFixture('cold-call')).toBe('cold-call-001');
  });
});
