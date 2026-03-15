/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '@/app/session/page';

const mockUseSSE = jest.fn();
jest.mock('@/hooks/useSSE', () => ({
  useSSE: (...args: unknown[]) => mockUseSSE(...args),
}));

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
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TICKET-012 edge cases', () => {
  it('always shows static call type options — no fetch needed', async () => {
    render(<Home />);
    // Should still render without crashing
    expect(screen.getByText('RepReady')).toBeInTheDocument();
    expect(screen.getByText('Start Session')).toBeInTheDocument();
    // Static call type options are always present
    expect(screen.getAllByRole('option')).toHaveLength(4);
  });

  it('returns to idle state on session creation failure', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Server error'));

    render(<Home />);

    fireEvent.click(screen.getByText('Start Session'));

    // After failure, button should revert to "Start Session" (not stuck on "Starting...")
    await waitFor(() => {
      expect(screen.getByText('Start Session')).toBeInTheDocument();
    });
    // Button should be enabled again
    expect(screen.getByText('Start Session')).not.toBeDisabled();
  });

  it('disables call type selector and start button during active session', async () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<Home />);

    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      const select = screen.getByLabelText('Select call type');
      expect(select).toBeDisabled();
    });
  });

  it('shows "Live" indicator when session is active', async () => {
    // Start with loading state to trigger active transition
    let sseReturn = { ...defaultSSE(), isConnected: false };
    mockUseSSE.mockImplementation(() => sseReturn);
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    const { rerender } = render(<Home />);

    fireEvent.click(screen.getByText('Start Session'));
    await waitFor(() => {
      expect(screen.getByText('Starting...')).toBeInTheDocument();
    });

    // Simulate SSE connection opening
    sseReturn = { ...defaultSSE(), isConnected: true };
    mockUseSSE.mockImplementation(() => sseReturn);
    rerender(<Home />);

    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  it('shows "Session Complete" text when scorecard arrives', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: {
        overallScore: 65,
        summary: 'Decent effort',
        entries: [],
      },
    });
    render(<Home />);
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
  });

  it('Start Session button is NOT disabled since call type is always selected', () => {
    render(<Home />);
    // Call type options are always present and default is selected
    expect(screen.getByText('Start Session')).not.toBeDisabled();
  });

  it('accumulates multiple coaching prompts', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      prompts: [
        { ruleId: 'r1', ruleName: 'Active Listening', message: 'Reflect back', timestamp: 1 },
        { ruleId: 'r2', ruleName: 'Open Questions', message: 'Ask open questions', timestamp: 2 },
        { ruleId: 'r3', ruleName: 'Discovery', message: 'Dig deeper', timestamp: 3 },
      ],
    });
    render(<Home />);
    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('Open Questions')).toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
  });

  it('scorecard renders inline (not as overlay)', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: {
        overallScore: 90,
        summary: 'Excellent',
        entries: [
          { ruleId: 'r1', ruleName: 'Empathy', assessment: 'good', comment: 'Well done' },
        ],
      },
    });
    render(<Home />);
    // Scorecard content renders inline
    expect(screen.getByText('90')).toBeInTheDocument();
    expect(screen.getByText('Excellent')).toBeInTheDocument();
  });
});
