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

beforeEach(() => {
  jest.clearAllMocks();
  mockUseSSE.mockReturnValue({
    lines: [],
    prompts: [],
    scorecard: null,
    isConnected: false,
  });
});

describe('TICKET-017 QA: Acceptance Criteria Validation', () => {
  describe('AC1: page.tsx correctly reads sessionId from the API response', () => {
    it('extracts sessionId field from POST /api/sessions response', async () => {
      mockFetch
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-001' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      render(<Home />);

      fireEvent.click(screen.getByText('Start Session'));

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
      // Even if the API returned both, page.tsx should use sessionId
      mockFetch
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-correct', id: 'sess-wrong' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      render(<Home />);

      fireEvent.click(screen.getByText('Start Session'));

      await waitFor(() => {
        // Should use sessionId, not id
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
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-valid' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      // Should not throw
      const { container } = render(<Home />);

      fireEvent.click(screen.getByText('Start Session'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Component should still be mounted and functional
      expect(container.querySelector('main')).toBeInTheDocument();
    });

    it('does not call /api/sessions/undefined/start', async () => {
      mockFetch
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-defined' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      render(<Home />);

      fireEvent.click(screen.getByText('Start Session'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(2);
      });

      // Verify no call was made to undefined endpoint
      const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0]);
      expect(calls).not.toContain('/api/sessions/undefined/start');
      expect(calls).not.toContain('/api/sessions/null/start');
    });

    it('handles session creation error gracefully (reverts to idle)', async () => {
      mockFetch
        .mockRejectedValueOnce(new Error('Network error'));

      render(<Home />);

      fireEvent.click(screen.getByText('Start Session'));

      // Should revert to idle state (button re-enabled)
      await waitFor(() => {
        expect(screen.getByText('Start Session')).not.toBeDisabled();
      });
    });
  });

  describe('AC3: Session ID is correctly passed to subsequent SSE and control calls', () => {
    it('passes sessionId to useSSE hook for SSE connection', async () => {
      mockFetch
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-sse-test' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      render(<Home />);

      fireEvent.click(screen.getByText('Start Session'));

      await waitFor(() => {
        expect(mockUseSSE).toHaveBeenCalledWith('sess-sse-test');
      });
    });

    it('passes sessionId to start session API call', async () => {
      mockFetch
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-start-test' }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

      render(<Home />);

      fireEvent.click(screen.getByText('Start Session'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/sessions/sess-start-test/start',
          expect.objectContaining({ method: 'POST' }),
        );
      });
    });

    it('useSSE starts as null (no session) before any session is created', () => {
      render(<Home />);

      // Initially called with null (no session)
      expect(mockUseSSE).toHaveBeenCalledWith(null);
    });

    it('correctly sequences: create → start → SSE connect', async () => {
      const callOrder: string[] = [];

      mockFetch
        .mockImplementationOnce(async (url: string) => {
          callOrder.push(`create: ${url}`);
          return { json: () => Promise.resolve({ sessionId: 'sess-sequence' }) };
        })
        .mockImplementationOnce(async (url: string) => {
          callOrder.push(`start: ${url}`);
          return { json: () => Promise.resolve({ status: 'started' }) };
        });

      render(<Home />);

      fireEvent.click(screen.getByText('Start Session'));

      await waitFor(() => {
        expect(callOrder).toHaveLength(2);
      });

      // Verify correct order
      expect(callOrder[0]).toBe('create: /api/sessions');
      expect(callOrder[1]).toBe('start: /api/sessions/sess-sequence/start');

      // Verify SSE got the right ID
      expect(mockUseSSE).toHaveBeenCalledWith('sess-sequence');
    });
  });
});

describe('TICKET-017 QA: Edge Cases', () => {
  it('handles session IDs with special characters', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-abc_123-def' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

    render(<Home />);

    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/sess-abc_123-def/start',
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  it('sends selected call type fixtureId in create request body', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-fixture' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

    render(<Home />);

    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ fixtureId: 'discovery-call' }),
        }),
      );
    });
  });

  it('disables start button while session is loading', async () => {
    let resolveCreate: (value: unknown) => void;
    const createPromise = new Promise((resolve) => { resolveCreate = resolve; });

    mockFetch
      .mockImplementationOnce(() => createPromise);

    render(<Home />);

    const button = screen.getByText('Start Session');
    fireEvent.click(button);

    // While loading, button text changes and is disabled
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
    // Static verification — read the source to confirm the fix
    const fs = await import('fs');
    const path = await import('path');
    const pagePath = path.resolve(__dirname, '../app/session/page.tsx');
    const source = fs.readFileSync(pagePath, 'utf-8');

    // Must contain session.sessionId
    expect(source).toContain('session.sessionId');
    // Must NOT contain session.id (the old broken pattern)
    expect(source).not.toMatch(/session\.id\b/);
  });
});
