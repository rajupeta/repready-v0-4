/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
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
  overallScore: 75,
  summary: 'Good call overall with room for improvement.',
  entries: [
    { ruleId: 'r1', ruleName: 'Active Listening', assessment: 'good' as const, comment: 'Well done' },
    { ruleId: 'r2', ruleName: 'Objection Handling', assessment: 'needs-work' as const, comment: 'Needs practice' },
    { ruleId: 'r3', ruleName: 'Next Steps', assessment: 'missed' as const, comment: 'Did not set follow-up' },
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

describe('TICKET-047: Scorecard replaces split view inline (not overlapping)', () => {
  it('AC1: scorecard replaces split view inline with full width', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    // Scorecard is rendered inline
    const scorecardEl = screen.getByTestId('scorecard-inline');
    expect(scorecardEl).toBeInTheDocument();

    // Scorecard uses h-full and w-full to fill the container
    expect(scorecardEl.className).toContain('h-full');
    expect(scorecardEl.className).toContain('w-full');

    // Split grid is NOT rendered
    expect(document.querySelector('.grid.grid-cols-1')).toBeNull();
  });

  it('AC2: transcript and coaching panels are hidden when scorecard is shown', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    // Transcript heading should NOT be visible
    expect(screen.queryByText('Transcript')).not.toBeInTheDocument();
    // Coaching heading should NOT be visible
    expect(screen.queryByText('Coaching')).not.toBeInTheDocument();

    // Scorecard heading IS visible
    expect(screen.getByText('Scorecard')).toBeInTheDocument();
  });

  it('AC3: New Session button is visible when scorecard is displayed', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    const newSessionBtn = screen.getByText('New Session');
    expect(newSessionBtn).toBeInTheDocument();
    expect(newSessionBtn.tagName).toBe('BUTTON');
  });

  it('scorecard is not rendered with fixed/overlay positioning', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    const scorecardEl = screen.getByTestId('scorecard-inline');
    // Walk up the DOM tree to ensure no ancestor has overlay classes
    let el: HTMLElement | null = scorecardEl;
    while (el) {
      expect(el.className).not.toContain('fixed');
      expect(el.className).not.toContain('absolute');
      expect(el.className).not.toContain('z-50');
      expect(el.className).not.toContain('inset-0');
      el = el.parentElement;
    }
  });

  it('scorecard displays all entries and overall score', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('Good call overall with room for improvement.')).toBeInTheDocument();
    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('Objection Handling')).toBeInTheDocument();
    expect(screen.getByText('Next Steps')).toBeInTheDocument();
  });

  it('split view renders during active session (no scorecard)', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      lines: [{ speaker: 'rep', text: 'Hi there' }],
      isConnected: true,
    });
    render(<Home />);

    // Split grid IS rendered
    expect(document.querySelector('.grid')).not.toBeNull();
    // Transcript panel visible
    expect(screen.getByText('Hi there')).toBeInTheDocument();
    // Scorecard NOT rendered
    expect(screen.queryByTestId('scorecard-inline')).not.toBeInTheDocument();
  });

  it('scorecard uses flex column layout for proper content flow', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    const scorecardEl = screen.getByTestId('scorecard-inline');
    expect(scorecardEl.className).toContain('flex');
    expect(scorecardEl.className).toContain('flex-col');
  });
});
