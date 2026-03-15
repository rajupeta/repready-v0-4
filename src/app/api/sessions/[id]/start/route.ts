import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const session = sessionManager.getSession(id);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 },
      );
    }

    if (session.status !== 'idle') {
      return NextResponse.json(
        { error: 'Session already started' },
        { status: 400 },
      );
    }

    sessionManager.startSession(id);
    return NextResponse.json({ status: 'started' }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
