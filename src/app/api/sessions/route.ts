import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fixtureId } = body;

    if (!fixtureId || typeof fixtureId !== 'string' || fixtureId.trim() === '') {
      return NextResponse.json(
        { error: 'fixtureId is required' },
        { status: 400 },
      );
    }

    const sessionId = sessionManager.createSession(fixtureId);
    return NextResponse.json({ sessionId }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
