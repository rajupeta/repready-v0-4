/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
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

describe('TICKET-031: Scorecard renders inline not as modal overlay (updated for TICKET-049 slide-out)', () => {
  it('AC1: scorecard does not auto-show as full-screen overlay when session completes', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
      sessionComplete: true,
    });
    render(<Home />);

    // No full-screen overlay covering everything
    expect(document.querySelector('.fixed.inset-0.z-50')).toBeNull();
    // No opaque backdrop that hides content (bg-black/50)
    expect(document.querySelector('.bg-black\\/50')).toBeNull();
  });

  it('AC2: when session completes, scorecard data is available and Generate Scorecard button appears', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
      sessionComplete: true,
    });
    render(<Home />);

    // Session Complete status shown
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
    // Generate Scorecard button is visible
    expect(screen.getByText('Generate Scorecard')).toBeInTheDocument();
  });

  it('AC3: transcript and coaching remain visible when session completes (TICKET-049)', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
      sessionComplete: true,
      lines: [{ speaker: 'rep', text: 'Hello prospect' }],
      prompts: [{ ruleId: 'r1', ruleName: 'Test Rule', message: 'Test msg', timestamp: 1 }],
    });
    render(<Home />);

    // Split grid IS rendered even when scorecard data exists
    expect(document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2')).not.toBeNull();

    // Transcript and coaching remain visible
    expect(screen.getByText('Hello prospect')).toBeInTheDocument();
    expect(screen.getByText('Test Rule')).toBeInTheDocument();
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

  it('scorecard opens in slide-out panel when Generate Scorecard is clicked', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: mockScorecard,
      sessionComplete: true,
    });
    render(<Home />);

    // Click Generate Scorecard
    fireEvent.click(screen.getByText('Generate Scorecard'));

    // Scorecard content now visible in slide-out
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Strong discovery skills demonstrated.')).toBeInTheDocument();
    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('Objection Handling')).toBeInTheDocument();
    expect(screen.getByText('Next Steps')).toBeInTheDocument();
  });
});
