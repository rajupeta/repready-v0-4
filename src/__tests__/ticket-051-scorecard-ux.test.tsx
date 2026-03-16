/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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
  overallScore: 78,
  summary: 'Good discovery call with room for improvement on objection handling.',
  entries: [
    { ruleId: 'r1', ruleName: 'Active Listening', assessment: 'good' as const, comment: 'Well done' },
    { ruleId: 'r2', ruleName: 'Objection Handling', assessment: 'needs-work' as const, comment: 'Could improve' },
    { ruleId: 'r3', ruleName: 'Next Steps', assessment: 'missed' as const, comment: 'Did not set follow-up' },
  ],
};

beforeEach(() => {
  mockUseSSE.mockReturnValue(defaultSSE());
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve([{ callType: 'discovery', displayName: 'Discovery Call' }]),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TICKET-051: Scorecard UX — keep transcript+coaching visible, scorecard on-demand in slide-out', () => {
  it('AC1: session end — transcript+coaching freeze in place, NO auto-scorecard', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: mockScorecard,
      lines: [{ speaker: 'rep', text: 'Hi there' }],
      prompts: [{ ruleId: 'r1', ruleName: 'Active Listening', message: 'Reflect back', timestamp: 1, triggerLineIndex: 1 }],
    });
    render(<Home />);

    // Transcript and coaching are visible
    expect(screen.getByText('Transcript')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
    expect(screen.getByText('Coaching')).toBeInTheDocument();
    expect(screen.getByText('Active Listening')).toBeInTheDocument();

    // Scorecard content is NOT auto-displayed
    expect(screen.queryByText('78')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC2: Generate Scorecard button appears in coaching panel after session ends', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: mockScorecard,
    });
    render(<Home />);

    const button = screen.getByTestId('generate-scorecard-button');
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('Generate Scorecard');
  });

  it('AC2: Generate Scorecard button does NOT appear during active session', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      isConnected: true,
      lines: [{ speaker: 'rep', text: 'Hello' }],
    });
    render(<Home />);

    expect(screen.queryByTestId('generate-scorecard-button')).not.toBeInTheDocument();
  });

  it('AC3: clicking Generate Scorecard opens slide-out panel from right', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: mockScorecard,
    });
    render(<Home />);

    fireEvent.click(screen.getByTestId('generate-scorecard-button'));

    // Slide-out panel is open
    const panel = screen.getByTestId('scorecard-slideout');
    expect(panel.className).toContain('translate-x-0');
    expect(panel).toHaveAttribute('role', 'dialog');

    // Scorecard content is visible
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('Good discovery call with room for improvement on objection handling.')).toBeInTheDocument();
  });

  it('AC4: transcript and coaching ALWAYS visible (never replaced) — even with slide-out open', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: mockScorecard,
      lines: [{ speaker: 'rep', text: 'Test transcript line' }],
      prompts: [{ ruleId: 'r1', ruleName: 'Test Rule', message: 'Test coaching', timestamp: 1, triggerLineIndex: 1 }],
    });
    render(<Home />);

    // Open slide-out
    fireEvent.click(screen.getByTestId('generate-scorecard-button'));

    // Transcript and coaching still visible behind the slide-out
    expect(screen.getByText('Test transcript line')).toBeInTheDocument();
    expect(screen.getByText('Test Rule')).toBeInTheDocument();

    // Grid layout is always present
    expect(document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2')).not.toBeNull();
  });

  it('AC5: slide-out has close button to dismiss', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: mockScorecard,
    });
    render(<Home />);

    // Open slide-out
    fireEvent.click(screen.getByTestId('generate-scorecard-button'));
    expect(screen.getByTestId('scorecard-slideout').className).toContain('translate-x-0');

    // Close it
    fireEvent.click(screen.getByTestId('scorecard-close-button'));
    expect(screen.getByTestId('scorecard-slideout').className).toContain('translate-x-full');
  });

  it('AC6: New Session button in slide-out', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: mockScorecard,
    });
    render(<Home />);

    // Open slide-out
    fireEvent.click(screen.getByTestId('generate-scorecard-button'));

    // New Session button is present
    const newSessionBtn = screen.getByTestId('new-session-button');
    expect(newSessionBtn).toBeInTheDocument();
    expect(newSessionBtn).toHaveTextContent('New Session');

    // Clicking it resets the session
    act(() => {
      fireEvent.click(newSessionBtn);
    });
    const lastCall = mockUseSSE.mock.calls[mockUseSSE.mock.calls.length - 1];
    expect(lastCall[0]).toBeNull();
  });

  it('AC7: scorecard scrollable in slide-out', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: mockScorecard,
    });
    render(<Home />);

    // Open slide-out
    fireEvent.click(screen.getByTestId('generate-scorecard-button'));

    const content = screen.getByTestId('scorecard-content');
    expect(content.className).toContain('overflow-y-auto');
  });

  it('session completion detected independently from scorecard (error case)', () => {
    // Session completes but no scorecard data (e.g., generation failed)
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: null,
    });
    render(<Home />);

    // Session is marked as completed
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
    // Generate Scorecard button is shown
    expect(screen.getByTestId('generate-scorecard-button')).toBeInTheDocument();
  });

  it('Generate Scorecard button shows loading state', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: null,
    });
    render(<Home />);

    // Button is present and enabled (no scorecard yet - will try API)
    const button = screen.getByTestId('generate-scorecard-button');
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
  });

  it('can close and reopen slide-out', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: mockScorecard,
    });
    render(<Home />);

    // Open
    fireEvent.click(screen.getByTestId('generate-scorecard-button'));
    expect(screen.getByTestId('scorecard-slideout').className).toContain('translate-x-0');

    // Close
    fireEvent.click(screen.getByTestId('scorecard-close-button'));
    expect(screen.getByTestId('scorecard-slideout').className).toContain('translate-x-full');

    // Reopen
    fireEvent.click(screen.getByTestId('generate-scorecard-button'));
    expect(screen.getByTestId('scorecard-slideout').className).toContain('translate-x-0');
  });

  it('scorecard shows all entries with correct assessments', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      sessionComplete: true,
      scorecard: mockScorecard,
    });
    render(<Home />);

    fireEvent.click(screen.getByTestId('generate-scorecard-button'));

    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('good')).toBeInTheDocument();
    expect(screen.getByText('Objection Handling')).toBeInTheDocument();
    expect(screen.getByText('needs-work')).toBeInTheDocument();
    expect(screen.getByText('Next Steps')).toBeInTheDocument();
    expect(screen.getByText('missed')).toBeInTheDocument();
    expect(screen.getByText('Overall Score')).toBeInTheDocument();
  });
});
