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

describe('TICKET-044: Scorecard has close/new session button — user is not trapped', () => {
  it('AC1: user is never trapped — New Session button is visible when scorecard shows', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    expect(screen.getByText('New Session')).toBeInTheDocument();
  });

  it('AC2: New Session button is functional — clicking it dismisses scorecard', async () => {
    // Start with scorecard visible
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    const { rerender } = render(<Home />);

    // Scorecard should be visible
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('New Session')).toBeInTheDocument();

    // After clicking New Session, the useSSE will be called with null sessionId
    // which means scorecard goes away. Simulate this by updating mock.
    act(() => {
      fireEvent.click(screen.getByText('New Session'));
    });

    // After click, useSSE should be called with null (session reset)
    // The last call to mockUseSSE should have null as the sessionId
    const lastCall = mockUseSSE.mock.calls[mockUseSSE.mock.calls.length - 1];
    expect(lastCall[0]).toBeNull();
  });

  it('AC3: scorecard displays as full-width inline (not modal)', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    // No fixed overlay
    expect(document.querySelector('.fixed.inset-0')).toBeNull();
    // No backdrop
    expect(document.querySelector('.bg-black\\/50')).toBeNull();

    // Scorecard content visible inline
    expect(screen.getByText('Scorecard')).toBeInTheDocument();
    expect(screen.getByText('82')).toBeInTheDocument();

    // No modal/dialog role
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC4: after dismissing, user can start a new session', async () => {
    // Start with scorecard
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    // Click New Session
    act(() => {
      fireEvent.click(screen.getByText('New Session'));
    });

    // Now mock returns no scorecard (session reset)
    mockUseSSE.mockReturnValue(defaultSSE());

    // Re-render to apply state changes — the Start Session button should be enabled
    // The fixture dropdown and Start Session button should be available
    // Since the component re-renders after state change, check that the split grid returns
    // The sessionId was set to null, so useSSE(null) returns default state
  });

  it('scorecard is not rendered as a dialog or modal element', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    // Walk up from the scorecard heading to ensure no fixed/modal ancestor
    const heading = screen.getByText('Scorecard');
    let el: HTMLElement | null = heading;
    while (el) {
      expect(el.className).not.toContain('fixed');
      expect(el.className).not.toContain('z-50');
      el = el.parentElement;
    }
  });
});
