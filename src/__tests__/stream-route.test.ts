import { SessionManager } from '@/services/session-manager';
import { EventBus } from '@/services/event-bus';
// Mock the singleton instances before importing the route
const mockSessionManager = {
  getSession: jest.fn(),
} as unknown as SessionManager;

const mockEventBus = new EventBus();

jest.mock('@/lib/session-manager-instance', () => ({
  sessionManager: mockSessionManager,
}));

jest.mock('@/lib/event-bus-instance', () => ({
  eventBus: mockEventBus,
}));

// Import after mocks are set up
import { GET } from '@/app/api/sessions/[id]/stream/route';
import { NextRequest } from 'next/server';

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

describe('GET /api/sessions/[id]/stream', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 404 JSON when session does not exist', async () => {
    (mockSessionManager.getSession as jest.Mock).mockReturnValue(undefined);

    const request = createRequest('/api/sessions/nonexistent/stream');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'nonexistent' }),
    });

    expect(response.status).toBe(404);
    const body = await response.json();
    expect(body).toEqual({ error: 'Session not found' });
  });

  it('returns correct SSE headers for valid session', async () => {
    (mockSessionManager.getSession as jest.Mock).mockReturnValue({
      id: 'session-1',
      status: 'active',
      fixtureId: 'discovery-call-001',
      transcript: [],
    });

    const request = createRequest('/api/sessions/session-1/stream');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'session-1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('text/event-stream');
    expect(response.headers.get('Cache-Control')).toBe('no-cache, no-transform');
    expect(response.headers.get('Connection')).toBe('keep-alive');
    expect(response.headers.get('X-Accel-Buffering')).toBe('no');

    // Clean up stream to prevent open handle from heartbeat interval
    const reader = response.body!.getReader();
    await reader.cancel();
  });

  it('returns a readable stream body', async () => {
    (mockSessionManager.getSession as jest.Mock).mockReturnValue({
      id: 'session-2',
      status: 'active',
      fixtureId: 'objection-handling-001',
      transcript: [],
    });

    const request = createRequest('/api/sessions/session-2/stream');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'session-2' }),
    });

    expect(response.body).toBeInstanceOf(ReadableStream);

    // Clean up stream to prevent open handle from heartbeat interval
    const reader = response.body!.getReader();
    await reader.cancel();
  });

  it('stream delivers events in valid SSE format', async () => {
    (mockSessionManager.getSession as jest.Mock).mockReturnValue({
      id: 'session-3',
      status: 'active',
      fixtureId: 'discovery-call-001',
      transcript: [],
    });

    const request = createRequest('/api/sessions/session-3/stream');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'session-3' }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    // Emit a transcript event
    mockEventBus.emit('session-3', {
      type: 'transcript',
      data: { line: { speaker: 'rep', text: 'Hello' } },
    });

    const { value } = await reader.read();
    const chunk = decoder.decode(value);

    expect(chunk).toContain('event: transcript');
    expect(chunk).toContain('data: ');
    expect(chunk).toContain('"speaker":"rep"');
    expect(chunk).toContain('"text":"Hello"');

    await reader.cancel();
  });

  it('stream closes after session_complete event', async () => {
    (mockSessionManager.getSession as jest.Mock).mockReturnValue({
      id: 'session-4',
      status: 'active',
      fixtureId: 'discovery-call-001',
      transcript: [],
    });

    const request = createRequest('/api/sessions/session-4/stream');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'session-4' }),
    });

    const reader = response.body!.getReader();

    // Emit session_complete
    mockEventBus.emit('session-4', {
      type: 'session_complete',
      data: { scorecard: { overallScore: 85 } },
    });

    // Read the session_complete event
    await reader.read();

    // Next read should indicate stream is done
    const { done } = await reader.read();
    expect(done).toBe(true);
  });

  it('stream delivers all 4 event types', async () => {
    jest.useFakeTimers();

    (mockSessionManager.getSession as jest.Mock).mockReturnValue({
      id: 'session-5',
      status: 'active',
      fixtureId: 'discovery-call-001',
      transcript: [],
    });

    const request = createRequest('/api/sessions/session-5/stream');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'session-5' }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const receivedTypes: string[] = [];

    // 1. transcript event
    mockEventBus.emit('session-5', {
      type: 'transcript',
      data: { line: { speaker: 'rep', text: 'Hi' } },
    });
    let { value } = await reader.read();
    let chunk = decoder.decode(value);
    if (chunk.includes('event: transcript')) receivedTypes.push('transcript');

    // 2. coaching_prompt event
    mockEventBus.emit('session-5', {
      type: 'coaching_prompt',
      data: { prompt: { ruleId: 'r1', message: 'Ask a question' } },
    });
    ({ value } = await reader.read());
    chunk = decoder.decode(value);
    if (chunk.includes('event: coaching_prompt')) receivedTypes.push('coaching_prompt');

    // 3. heartbeat event (advance timer)
    jest.advanceTimersByTime(15_000);
    ({ value } = await reader.read());
    chunk = decoder.decode(value);
    if (chunk.includes('event: heartbeat')) receivedTypes.push('heartbeat');

    // 4. session_complete event
    mockEventBus.emit('session-5', {
      type: 'session_complete',
      data: { scorecard: { overallScore: 90 } },
    });
    ({ value } = await reader.read());
    chunk = decoder.decode(value);
    if (chunk.includes('event: session_complete')) receivedTypes.push('session_complete');

    expect(receivedTypes).toEqual([
      'transcript',
      'coaching_prompt',
      'heartbeat',
      'session_complete',
    ]);

    jest.useRealTimers();
  });

  it('returns 404 with JSON content type for missing session', async () => {
    (mockSessionManager.getSession as jest.Mock).mockReturnValue(undefined);

    const request = createRequest('/api/sessions/missing-id/stream');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'missing-id' }),
    });

    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });

  it('uses the session ID from route params, not URL path', async () => {
    (mockSessionManager.getSession as jest.Mock).mockReturnValue(undefined);

    const request = createRequest('/api/sessions/url-id/stream');
    await GET(request, {
      params: Promise.resolve({ id: 'param-id' }),
    });

    expect(mockSessionManager.getSession).toHaveBeenCalledWith('param-id');
  });

  it('coaching_prompt events include rule data in valid SSE format', async () => {
    (mockSessionManager.getSession as jest.Mock).mockReturnValue({
      id: 'session-6',
      status: 'active',
      fixtureId: 'discovery-call-001',
      transcript: [],
    });

    const request = createRequest('/api/sessions/session-6/stream');
    const response = await GET(request, {
      params: Promise.resolve({ id: 'session-6' }),
    });

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    mockEventBus.emit('session-6', {
      type: 'coaching_prompt',
      data: { ruleId: 'open-ended-questions', message: 'Try asking an open-ended question' },
    });

    const { value } = await reader.read();
    const chunk = decoder.decode(value);

    expect(chunk).toContain('event: coaching_prompt');
    expect(chunk).toContain('"ruleId":"open-ended-questions"');
    expect(chunk).toContain('"message":"Try asking an open-ended question"');

    await reader.cancel();
  });
});
