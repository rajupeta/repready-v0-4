import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';
import { resolveFixture, VALID_CALL_TYPES } from '@/lib/call-type-routing';
import type { CallType } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixtureId, callType } = body;

    // Normalize inputs: only accept valid string values
    const validFixtureId =
      typeof fixtureId === 'string' && fixtureId.trim() !== ''
        ? fixtureId
        : undefined;
    const validCallType =
      typeof callType === 'string' && VALID_CALL_TYPES.includes(callType as CallType)
        ? (callType as CallType)
        : undefined;

    // At least one must be provided
    if (!validFixtureId && !validCallType) {
      return NextResponse.json(
        { error: 'fixtureId or callType is required' },
        { status: 400 },
      );
    }

    const resolved = resolveFixture(validCallType, validFixtureId);
    const sessionId = sessionManager.createSession(resolved.fixtureId, resolved.callType);
    return NextResponse.json({ sessionId }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
