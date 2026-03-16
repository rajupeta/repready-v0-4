/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

const mockScorecard = {
  overallScore: 82,
  summary: 'Strong discovery skills demonstrated.',
  entries: [
    { ruleId: 'r1', ruleName: 'Active Listening', assessment: 'good' as const, comment: 'Great job' },
    { ruleId: 'r2', ruleName: 'Objection Handling', assessment: 'needs-work' as const, comment: 'Could improve' },
    { ruleId: 'r3', ruleName: 'Next Steps', assessment: 'missed' as const, comment: 'Forgot to set next steps' },
  ],
};

beforeEach(() => {
  mockUseSSE.mockReturnValue(defaultSSE());
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve(['discovery-call-001']),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TICKET-044: Scorecard has close/new session button — user is not trapped (updated for TICKET-049)', () => {
  it('AC1: Generate Scorecard button appears when session completes', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
      sessionComplete: true,
    });
    render(<Home />);

    expect(screen.getByText('Generate Scorecard')).toBeInTheDocument();
  });

  it('AC1: New Session button is visible in scorecard slide-out panel', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
      sessionComplete: true,
    });
    render(<Home />);

    // Open the slide-out
    fireEvent.click(screen.getByText('Generate Scorecard'));

    expect(screen.getByText('New Session')).toBeInTheDocument();
  });

  it('AC2: New Session button resets the session', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
      sessionComplete: true,
    });
    render(<Home />);

    // Open slide-out
    fireEvent.click(screen.getByText('Generate Scorecard'));

    // Click New Session
    act(() => {
      fireEvent.click(screen.getByText('New Session'));
    });

    // After click, useSSE should be called with null (session reset)
    const lastCall = mockUseSSE.mock.calls[mockUseSSE.mock.calls.length - 1];
    expect(lastCall[0]).toBeNull();
  });

  it('AC3: scorecard slide-out has close button to dismiss', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
      sessionComplete: true,
    });
    render(<Home />);

    // Open slide-out
    fireEvent.click(screen.getByText('Generate Scorecard'));

    // Close button exists
    const closeButton = screen.getByTestId('scorecard-close-button');
    expect(closeButton).toBeInTheDocument();

    // Click close
    fireEvent.click(closeButton);

    // Slide-out should be closed (translate-x-full)
    const panel = screen.getByTestId('scorecard-slideout');
    expect(panel.className).toContain('translate-x-full');
  });

  it('AC4: after dismissing slideout, user can reopen it', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
      sessionComplete: true,
    });
    render(<Home />);

    // Open, close, then reopen
    fireEvent.click(screen.getByText('Generate Scorecard'));
    fireEvent.click(screen.getByTestId('scorecard-close-button'));
    fireEvent.click(screen.getByText('Generate Scorecard'));

    const panel = screen.getByTestId('scorecard-slideout');
    expect(panel.className).toContain('translate-x-0');
  });

  it('scorecard slide-out uses dialog role for accessibility', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
      sessionComplete: true,
    });
    render(<Home />);

    // Open slide-out
    fireEvent.click(screen.getByText('Generate Scorecard'));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
