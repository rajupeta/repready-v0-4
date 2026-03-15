import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';

export async function GET(
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

    const events = sessionManager.getEvents(id);
    return NextResponse.json({ events }, { status: 200 });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
