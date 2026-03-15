import { CallType } from '@/types';

/**
 * Maps each CallType to an ordered list of fixture IDs.
 * The first entry is the default fixture for that call type.
 */
const CALL_TYPE_FIXTURES: Record<CallType, string[]> = {
  discovery: ['discovery-call-001'],
  'objection-handling': ['objection-handling-001'],
  demo: ['discovery-call-001'],
  'follow-up': ['discovery-call-001'],
};

/**
 * Returns the fixture IDs available for a given call type.
 */
export function getFixturesForCallType(callType: CallType): string[] {
  return CALL_TYPE_FIXTURES[callType] ?? [];
}

/**
 * Returns the default fixture ID for a given call type.
 */
export function getDefaultFixture(callType: CallType): string | undefined {
  const fixtures = CALL_TYPE_FIXTURES[callType];
  return fixtures?.[0];
}

/**
 * Infers a CallType from a fixture ID based on naming convention.
 * Fixture naming: <call-type>-NNN.json (e.g., discovery-call-001, objection-handling-001)
 */
export function inferCallType(fixtureId: string): CallType {
  if (fixtureId.startsWith('objection-handling')) return 'objection-handling';
  if (fixtureId.startsWith('discovery')) return 'discovery';
  if (fixtureId.startsWith('demo')) return 'demo';
  if (fixtureId.startsWith('follow-up')) return 'follow-up';
  // Default to discovery if pattern doesn't match
  return 'discovery';
}

/**
 * Resolves a callType and optional fixtureId into a concrete fixtureId.
 * If fixtureId is provided, uses it directly.
 * If only callType is provided, returns the default fixture for that type.
 */
export function resolveFixture(
  callType?: CallType,
  fixtureId?: string,
): { fixtureId: string; callType: CallType } {
  if (fixtureId) {
    return {
      fixtureId,
      callType: callType ?? inferCallType(fixtureId),
    };
  }

  if (callType) {
    const defaultFixture = getDefaultFixture(callType);
    if (!defaultFixture) {
      throw new Error(`No fixtures available for call type: ${callType}`);
    }
    return { fixtureId: defaultFixture, callType };
  }

  throw new Error('Either callType or fixtureId must be provided');
}

/**
 * All valid call types.
 */
export const VALID_CALL_TYPES: CallType[] = [
  'discovery',
  'demo',
  'objection-handling',
  'follow-up',
];
