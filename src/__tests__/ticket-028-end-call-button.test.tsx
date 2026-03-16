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

function defaultSSE() {
  return {
    lines: [],
    prompts: [],
    scorecard: null,
    sessionComplete: false,
    isConnected: false,
  };
}

beforeEach(() => {
  mockUseSSE.mockReturnValue(defaultSSE());
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TICKET-028: End Call button', () => {
  it('End Call button is NOT visible when session is idle', async () => {
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
    });
    expect(screen.queryByText('End Call')).not.toBeInTheDocument();
  });

  it('End Call button is visible when session is active', async () => {
    // Start with connected SSE to trigger active state
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      isConnected: true,
    });

    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'session-1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    await waitFor(() => {
      expect(screen.getByText('End Call')).toBeInTheDocument();
    });
  });

  it('End Call button calls POST /api/sessions/[id]/end', async () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      isConnected: true,
    });

    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'session-42' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'ended' }) });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    await waitFor(() => {
      expect(screen.getByText('End Call')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('End Call'));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/session-42/end',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });

  it('End Call button is NOT visible when session is completed', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: {
        overallScore: 80,
        summary: 'Done',
        entries: [],
      },
    });

    render(<Home />);
    expect(screen.queryByText('End Call')).not.toBeInTheDocument();
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
  });

  it('End Call button is NOT visible during loading state', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
      .mockImplementationOnce(() => new Promise(() => {})); // Never resolves

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Session'));
    expect(screen.getByText('Starting...')).toBeInTheDocument();
    expect(screen.queryByText('End Call')).not.toBeInTheDocument();
  });

  it('session transitions to completed after scorecard arrives from SSE', async () => {
    const { rerender } = render(<Home />);

    // Initially idle - no End Call button
    expect(screen.queryByText('End Call')).not.toBeInTheDocument();

    // Simulate scorecard arrival (which sets completed state)
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: {
        overallScore: 90,
        summary: 'Great session',
        entries: [],
      },
    });

    rerender(<Home />);

    // End Call should not be visible in completed state
    expect(screen.queryByText('End Call')).not.toBeInTheDocument();
  });
});
