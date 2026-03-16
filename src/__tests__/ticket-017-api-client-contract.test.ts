/**
 * TICKET-017: API/Client Contract Test
 *
 * Validates that the POST /api/sessions route returns { sessionId }
 * and that page.tsx reads that exact field. This is a contract test
 * ensuring the API response shape and client consumption stay aligned.
 */
import fs from 'fs';
import path from 'path';

describe('TICKET-017: API/Client sessionId contract', () => {
  const apiRoutePath = path.resolve(__dirname, '../app/api/sessions/route.ts');
  const pageClientPath = path.resolve(__dirname, '../app/session/page.tsx');

  let apiSource: string;
  let pageSource: string;

  beforeAll(() => {
    apiSource = fs.readFileSync(apiRoutePath, 'utf-8');
    pageSource = fs.readFileSync(pageClientPath, 'utf-8');
  });

  describe('API route contract', () => {
    it('POST /api/sessions returns { sessionId } in the response', () => {
      // The API must return NextResponse.json({ sessionId }, ...)
      expect(apiSource).toMatch(/NextResponse\.json\(\s*\{\s*sessionId\s*\}/);
    });

    it('does not return { id } in the response', () => {
      // Must NOT return { id } which was the old broken shape
      expect(apiSource).not.toMatch(/NextResponse\.json\(\s*\{\s*id\s*[,}]/);
    });

    it('returns 201 status on success', () => {
      expect(apiSource).toContain('status: 201');
    });
  });

  describe('Client consumption contract', () => {
    it('page.tsx reads session.sessionId', () => {
      expect(pageSource).toContain('session.sessionId');
    });

    it('page.tsx does NOT read session.id', () => {
      // Ensure the old broken pattern session.id is not used
      // Use word boundary to avoid matching sessionId
      expect(pageSource).not.toMatch(/session\.id\b/);
    });

    it('page.tsx passes sessionId to the start endpoint', () => {
      // The start call should use the extracted id variable
      expect(pageSource).toMatch(/\/api\/sessions\/\$\{id\}\/start/);
    });

    it('page.tsx sets sessionId state for SSE connection', () => {
      expect(pageSource).toContain('setSessionId(id)');
    });
  });

  describe('Full contract alignment', () => {
    it('API produces sessionId and client consumes sessionId (not id)', () => {
      // API side: creates sessionId and returns it
      const apiReturnsSessionId = apiSource.includes('{ sessionId }');
      // Client side: reads sessionId from response
      const clientReadsSessionId = pageSource.includes('session.sessionId');
      // Client side: does NOT read .id
      const clientDoesNotReadId = !pageSource.match(/session\.id\b/);

      expect(apiReturnsSessionId).toBe(true);
      expect(clientReadsSessionId).toBe(true);
      expect(clientDoesNotReadId).toBe(true);
    });
  });
});

describe('TICKET-017: API route unit tests', () => {
  // Test the route handler logic directly
  let POST: (request: Request) => Promise<Response>;

  beforeAll(async () => {
    // Mock the session manager
    jest.mock('@/lib/session-manager-instance', () => ({
      sessionManager: {
        createSession: jest.fn().mockReturnValue('mock-session-id-123'),
      },
    }));

    const routeModule = await import('@/app/api/sessions/route');
    POST = routeModule.POST as unknown as (request: Request) => Promise<Response>;
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('returns { sessionId } with 201 status on valid request', async () => {
    const request = new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixtureId: 'test-fixture' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data).toHaveProperty('sessionId');
    expect(data.sessionId).toBe('mock-session-id-123');
    // Must NOT have an 'id' field
    expect(data).not.toHaveProperty('id');
  });

  it('returns 400 when fixtureId is missing', async () => {
    const request = new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data).toHaveProperty('error');
  });

  it('returns 400 when fixtureId is empty string', async () => {
    const request = new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixtureId: '' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when fixtureId is whitespace only', async () => {
    const request = new Request('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fixtureId: '   ' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
