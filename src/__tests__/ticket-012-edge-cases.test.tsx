/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '@/app/page';

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
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve(['discovery-call-001']),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TICKET-012 edge cases', () => {
  it('handles fixture fetch failure gracefully — no crash, empty dropdown', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    render(<Home />);
    // Should still render without crashing
    expect(screen.getByText('RepReady')).toBeInTheDocument();
    expect(screen.getByText('Start Session')).toBeInTheDocument();
    // No options in the dropdown
    await waitFor(() => {
      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });
  });

  it('returns to idle state on session creation failure', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve(['discovery-call-001']) })
      .mockRejectedValueOnce(new Error('Server error'));

    render(<Home />);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'discovery-call-001' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Session'));

    // After failure, button should revert to "Start Session" (not stuck on "Starting...")
    await waitFor(() => {
      expect(screen.getByText('Start Session')).toBeInTheDocument();
    });
    // Button should be enabled again
    expect(screen.getByText('Start Session')).not.toBeDisabled();
  });

  it('disables fixture selector and start button during active session', async () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve(['discovery-call-001']) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<Home />);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'discovery-call-001' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      const select = screen.getByLabelText('Select fixture');
      expect(select).toBeDisabled();
    });
  });

  it('shows "Live" indicator when session is active', async () => {
    // Start with loading state to trigger active transition
    let sseReturn = { ...defaultSSE(), isConnected: false };
    mockUseSSE.mockImplementation(() => sseReturn);
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve(['discovery-call-001']) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    const { rerender } = render(<Home />);
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'discovery-call-001' })).toBeInTheDocument();
    });

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

  it('Start Session button is disabled when no fixture is selected', async () => {
    mockFetch.mockResolvedValueOnce({
      json: () => Promise.resolve([]),
    });
    render(<Home />);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/fixtures');
    });
    // With empty fixtures, selectedFixture is '' which is falsy
    expect(screen.getByText('Start Session')).toBeDisabled();
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

  it('scorecard overlay renders with backdrop that covers full viewport', () => {
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
    // Check overlay has fixed positioning and covers full viewport
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    expect(overlay).not.toBeNull();
    // Check backdrop has semi-transparent bg
    expect(overlay?.className).toContain('bg-gray-50/95');
  });
});
