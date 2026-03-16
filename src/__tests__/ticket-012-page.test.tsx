/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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
    ok: true,
    json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}, {callType: 'objection-handling', displayName: 'Objection Handling'}]),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Main page — acceptance criteria', () => {
  it('renders header with RepReady title and subtitle', async () => {
    render(<Home />);
    expect(screen.getByText('RepReady')).toBeInTheDocument();
    expect(screen.getByText('AI Sales Coaching')).toBeInTheDocument();
  });

  it('fetches fixtures on mount and populates dropdown', async () => {
    render(<Home />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/fixtures');
    });
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Objection Handling' })).toBeInTheDocument();
    });
  });

  it('renders Start Session button', () => {
    render(<Home />);
    expect(screen.getByText('Start Session')).toBeInTheDocument();
  });

  it('Start Session button creates session, connects SSE, then starts', async () => {
    // Return isConnected: true once a sessionId is provided (simulates SSE connecting)
    mockUseSSE.mockImplementation((sid: string | null) => {
      if (sid) return { ...defaultSSE(), isConnected: true };
      return defaultSSE();
    });

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'session-1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    const { act } = await import('@testing-library/react');

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    // POST /api/sessions
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ callType: 'discovery' }),
      }));
    });

    // useSSE should be called with the session id (SSE connects BEFORE start)
    await waitFor(() => {
      expect(mockUseSSE).toHaveBeenCalledWith('session-1');
    });

    // POST /start is called after SSE connects (via useEffect)
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-1/start', expect.objectContaining({
        method: 'POST',
      }));
    });
  });

  it('passes useSSE lines to TranscriptPanel', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      lines: [{ speaker: 'rep', text: 'Hello there' }],
    });
    render(<Home />);
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('passes useSSE prompts to CoachingPanel', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      prompts: [{ ruleId: 'r1', ruleName: 'Active Listening', message: 'Reflect back', timestamp: 1, triggerLineIndex: 1 }],
      lines: [{ speaker: 'rep' as const, text: 'Hello', timestamp: 1 }],
    });
    render(<Home />);
    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('Reflect back')).toBeInTheDocument();
  });

  it('shows View Scorecard button when scorecard arrives (TICKET-049 slide-out)', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: {
        overallScore: 80,
        summary: 'Great call',
        entries: [{ ruleId: 'r1', ruleName: 'Discovery', assessment: 'good', comment: 'Nice' }],
      },
    });
    render(<Home />);
    // View Scorecard button appears
    expect(screen.getByText('View Scorecard')).toBeInTheDocument();
    // No full-screen modal overlay
    expect(document.querySelector('.fixed.inset-0.z-50')).toBeNull();
  });

  it('transcript and coaching stay visible when session completes (TICKET-049)', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: {
        overallScore: 80,
        summary: 'Great call',
        entries: [],
      },
    });
    render(<Home />);
    // Split grid remains visible
    expect(document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2')).not.toBeNull();
  });

  it('uses responsive layout with grid classes', () => {
    render(<Home />);
    const grid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
    expect(grid).not.toBeNull();
  });

  it('calls useSSE with null initially', () => {
    render(<Home />);
    expect(mockUseSSE).toHaveBeenCalledWith(null);
  });

  it('disables Start Session button when loading', async () => {
    // Make fetch never resolve for session creation to keep loading state
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]) })
      .mockImplementationOnce(() => new Promise(() => {}));

    render(<Home />);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Session'));
    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });
});
