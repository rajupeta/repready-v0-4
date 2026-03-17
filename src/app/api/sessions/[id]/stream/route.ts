import { NextRequest } from 'next/server';
import { sessionManager } from '@/lib/session-manager-instance';
import { eventBus } from '@/lib/event-bus-instance';
import { createSSEStream } from '@/lib/sse';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = sessionManager.getSession(id);
  if (!session) {
    return Response.json(
      { error: 'Session not found' },
      { status: 404 },
    );
  }

  // Replay any events emitted before client connected (e.g. if /start was called first)
  const missedEvents = sessionManager.getEvents(id) || [];
  const stream = createSSEStream(id, eventBus, missedEvents);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
