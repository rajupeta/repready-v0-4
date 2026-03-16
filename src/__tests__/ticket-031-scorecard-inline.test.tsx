/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
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

describe('TICKET-031: Scorecard renders inline not as modal overlay', () => {
  it('AC1: no modal overlay for scorecard', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    // No fixed overlay element
    expect(document.querySelector('.fixed.inset-0.z-50')).toBeNull();
    // No backdrop
    expect(document.querySelector('.bg-black\\/50')).toBeNull();
  });

  it('AC2: when session completes, scorecard renders inline full-width', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    // Scorecard content is visible
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Strong discovery skills demonstrated.')).toBeInTheDocument();
    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('Objection Handling')).toBeInTheDocument();
    expect(screen.getByText('Next Steps')).toBeInTheDocument();

    // Session Complete status shown
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
  });

  it('AC3: scorecard replaces the transcript/coaching split view', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    // Split grid is NOT rendered
    expect(document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2')).toBeNull();

    // Scorecard IS rendered
    expect(screen.getByText('82')).toBeInTheDocument();
  });

  it('AC4: clean transition - split view shows during active session', () => {
    // Active session (no scorecard yet)
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      lines: [{ speaker: 'rep', text: 'Hello prospect' }],
      prompts: [],
      isConnected: true,
    });
    render(<Home />);

    // Split grid IS rendered during active session
    expect(document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2')).not.toBeNull();

    // Transcript content visible
    expect(screen.getByText('Hello prospect')).toBeInTheDocument();
  });

  it('split view shows when no scorecard (idle state)', () => {
    render(<Home />);

    // Split grid IS rendered in idle state
    expect(document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2')).not.toBeNull();
  });

  it('scorecard is not rendered as a child of a fixed/overlay container', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
    });
    render(<Home />);

    // Find the scorecard heading
    const scorecardHeading = screen.getByText('Scorecard');
    // Walk up to check no parent has fixed positioning classes
    let el: HTMLElement | null = scorecardHeading;
    while (el) {
      expect(el.className).not.toContain('fixed');
      expect(el.className).not.toContain('inset-0');
      expect(el.className).not.toContain('z-50');
      el = el.parentElement;
    }
  });
});
