/**
 * @jest-environment jsdom
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
  // Simulate SSE connecting once a sessionId is provided
  mockUseSSE.mockImplementation((sid: string | null) => ({
    lines: [],
    prompts: [],
    scorecard: null,
    sessionComplete: false,
    isConnected: !!sid,
  }));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TICKET-017: page.tsx reads sessionId from API response', () => {
  it('reads sessionId (not id) from POST /api/sessions response', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-abc-123' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    await waitFor(() => {
      // Verify start was called with the correct session ID from sessionId field
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/sess-abc-123/start',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    // useSSE should receive the session ID from sessionId field
    expect(mockUseSSE).toHaveBeenCalledWith('sess-abc-123');
  });

  it('does not crash when API returns sessionId instead of id', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'objection-handling', displayName: 'Objection Handling'}]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-xyz-789' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Objection Handling' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    // Should not fall back to idle (which would indicate a crash/error)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/sess-xyz-789/start',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    // Session ID should be passed to SSE, not undefined
    const sseCallArgs = mockUseSSE.mock.calls;
    const lastCall = sseCallArgs[sseCallArgs.length - 1];
    expect(lastCall[0]).toBe('sess-xyz-789');
    expect(lastCall[0]).not.toBeUndefined();
  });

  it('session ID is correctly used in subsequent API calls', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-correct-id' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'started' }) });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    await waitFor(() => {
      // Verify the session create call
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ callType: 'discovery' }),
      }));

      // Verify the start call uses the sessionId from response, not undefined
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/sess-correct-id/start',
        expect.objectContaining({ method: 'POST' }),
      );

      // Verify start was NOT called with undefined
      expect(mockFetch).not.toHaveBeenCalledWith(
        '/api/sessions/undefined/start',
        expect.anything(),
      );
    });
  });
});
