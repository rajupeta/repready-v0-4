import { NextRequest, NextResponse } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    sessionManager.endSession(id);
    return NextResponse.json({ status: 'ended' });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    const status = message.includes('not found')
      ? 404
      : message.includes('not active')
        ? 400
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
