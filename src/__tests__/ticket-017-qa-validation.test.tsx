/**
 * @jest-environment jsdom
 *
 * TICKET-017 QA Validation: Fix session.id crash — API returns sessionId not id
 *
 * Acceptance Criteria:
 * 1. page.tsx correctly reads sessionId from the API response
 * 2. Session creation no longer crashes
 * 3. Session ID is correctly passed to subsequent SSE and control calls
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '@/app/session/page';

// Mock useSSE hook
const mockUseSSE = jest.fn();
jest.mock('@/hooks/useSSE', () => ({
  useSSE: (...args: unknown[]) => mockUseSSE(...args),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Helper: click Start Session and flush async microtasks
async function clickStartAndFlush() {
  fireEvent.click(screen.getByText('Start Session'));
  await act(async () => { await new Promise(r => setTimeout(r, 50)); });
}

beforeEach(() => {
  jest.clearAllMocks();
  // Simulate SSE connecting once a sessionId is provided
  mockUseSSE.mockImplementation((sid: string | null) => ({
    lines: [],
    prompts: [],
    scorecard: null,
    sessionComplete: false,
    isConnected: !!sid,
  }));
});

describe('TICKET-017 QA: Acceptance Criteria Validation', () => {
  describe('AC1: page.tsx correctly reads sessionId from the API response', () => {
    it('extracts sessionId field from POST /api/sessions response', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-001' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      render(<Home />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument());

      await clickStartAndFlush();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/sessions/sess-001/start',
          expect.objectContaining({ method: 'POST' }),
        );
      });

      // Verify useSSE received the correct sessionId
      const lastSSECall = mockUseSSE.mock.calls[mockUseSSE.mock.calls.length - 1];
      expect(lastSSECall[0]).toBe('sess-001');
    });

    it('does NOT read an "id" field — only uses "sessionId"', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-correct', id: 'sess-wrong' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      render(<Home />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument());

      await clickStartAndFlush();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/sessions/sess-correct/start',
          expect.objectContaining({ method: 'POST' }),
        );
        expect(mockFetch).not.toHaveBeenCalledWith(
          '/api/sessions/sess-wrong/start',
          expect.anything(),
        );
      });
    });
  });

  describe('AC2: Session creation no longer crashes', () => {
    it('does not crash when API returns { sessionId }', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-valid' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      const { container } = render(<Home />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument());

      await clickStartAndFlush();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });

      expect(container.querySelector('main')).toBeInTheDocument();
    });

    it('does not call /api/sessions/undefined/start', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-defined' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      render(<Home />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument());

      await clickStartAndFlush();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(3);
      });

      const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
      expect(calls).not.toContain('/api/sessions/undefined/start');
      expect(calls).not.toContain('/api/sessions/null/start');
    });

    it('handles session creation error gracefully (reverts to idle)', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
        .mockRejectedValueOnce(new Error('Network error'));

      render(<Home />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument());

      await clickStartAndFlush();

      await waitFor(() => {
        expect(screen.getByText('Start Session')).not.toBeDisabled();
      });
    });
  });

  describe('AC3: Session ID is correctly passed to subsequent SSE and control calls', () => {
    it('passes sessionId to useSSE hook for SSE connection', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-sse-test' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      render(<Home />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument());

      await clickStartAndFlush();

      await waitFor(() => {
        expect(mockUseSSE).toHaveBeenCalledWith('sess-sse-test');
      });
    });

    it('passes sessionId to start session API call', async () => {
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-start-test' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      render(<Home />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument());

      await clickStartAndFlush();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/sessions/sess-start-test/start',
          expect.objectContaining({ method: 'POST' }),
        );
      });
    });

    it('useSSE starts as null (no session) before any session is created', () => {
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([]) });

      render(<Home />);

      expect(mockUseSSE).toHaveBeenCalledWith(null);
    });

    it('correctly sequences: create → SSE connect → start', async () => {
      const callOrder: string[] = [];

      mockFetch
        .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
        .mockImplementationOnce(async (url: string) => {
          callOrder.push(`create: ${url}`);
          return { json: () => Promise.resolve({ sessionId: 'sess-sequence' }) };
        })
        .mockImplementationOnce(async (url: string) => {
          callOrder.push(`start: ${url}`);
          return { json: () => Promise.resolve({ status: 'started' }) };
        });

      render(<Home />);
      await waitFor(() => expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument());

      await clickStartAndFlush();

      await waitFor(() => {
        expect(callOrder).toHaveLength(2);
      });

      expect(callOrder[0]).toBe('create: /api/sessions');
      expect(callOrder[1]).toBe('start: /api/sessions/sess-sequence/start');

      expect(mockUseSSE).toHaveBeenCalledWith('sess-sequence');
    });
  });
});

describe('TICKET-017 QA: Edge Cases', () => {
  it('handles session IDs with special characters', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-abc_123-def' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

    render(<Home />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument());

    await clickStartAndFlush();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/sess-abc_123-def/start',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('sends selected fixture in create request body', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}, {callType: 'demo', displayName: 'Demo Call'}]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-fixture' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

    render(<Home />);
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(2));

    await clickStartAndFlush();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ callType: 'discovery' }),
        }),
      );
    });
  });

  it('disables start button while session is loading', async () => {
    let resolveCreate: (value: unknown) => void;
    const createPromise = new Promise((resolve) => { resolveCreate = resolve; });

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
      .mockImplementationOnce(() => createPromise)
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

    render(<Home />);
    await waitFor(() => expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument());

    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(screen.getByText('Starting...')).toBeDisabled();
    });

    // Resolve to clean up
    await act(async () => {
      resolveCreate!({ json: () => Promise.resolve({ sessionId: 'sess-resolved' }) });
    });
  });
});

describe('TICKET-017 QA: Code Shape Verification', () => {
  it('page.tsx source reads session.sessionId not session.id', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const pagePath = path.resolve(__dirname, '../app/session/page.tsx');
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain('session.sessionId');
    expect(source).not.toMatch(/session\.id\b/);
  });
});
