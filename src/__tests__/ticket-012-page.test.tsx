/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '@/app/page';

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
    isConnected: false,
  };
}

beforeEach(() => {
  mockUseSSE.mockReturnValue(defaultSSE());
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ sessionId: 'session-1' }),
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

  it('shows call type dropdown with options', () => {
    render(<Home />);
    expect(screen.getByLabelText('Select call type')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Demo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Objection Handling' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Follow-up' })).toBeInTheDocument();
  });

  it('renders Start Session button', () => {
    render(<Home />);
    expect(screen.getByText('Start Session')).toBeInTheDocument();
  });

  it('Start Session button creates and starts a session', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'session-1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<Home />);

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    await waitFor(() => {
      // POST /api/sessions with callType
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ callType: 'discovery' }),
      }));
      // POST /api/sessions/session-1/start
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/session-1/start', expect.objectContaining({
        method: 'POST',
      }));
    });

    // useSSE should be called with the session id
    expect(mockUseSSE).toHaveBeenCalledWith('session-1');
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
      prompts: [{ ruleId: 'r1', ruleName: 'Active Listening', message: 'Reflect back', timestamp: 1 }],
    });
    render(<Home />);
    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('Reflect back')).toBeInTheDocument();
  });

  it('shows ScorecardView as overlay when scorecard arrives', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: {
        overallScore: 80,
        summary: 'Great call',
        entries: [{ ruleId: 'r1', ruleName: 'Discovery', assessment: 'good', comment: 'Nice' }],
      },
    });
    render(<Home />);
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText('Great call')).toBeInTheDocument();
  });

  it('scorecard overlay has Close button that hides it', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: {
        overallScore: 80,
        summary: 'Great call',
        entries: [],
      },
    });
    render(<Home />);
    expect(screen.getByText('80')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('80')).not.toBeInTheDocument();
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
      .mockImplementationOnce(() => new Promise(() => {}));

    render(<Home />);

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });
});
