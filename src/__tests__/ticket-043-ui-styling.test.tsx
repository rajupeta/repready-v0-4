/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TranscriptPanel from '@/components/TranscriptPanel';
import CoachingPanel from '@/components/CoachingPanel';
import ScorecardView from '@/components/ScorecardView';
import Home from '@/app/session/page';
import { TranscriptLine, CoachingPrompt, Scorecard } from '@/types';

// Mock useSSE hook
const mockUseSSE = jest.fn();
jest.mock('@/hooks/useSSE', () => ({
  useSSE: (...args: unknown[]) => mockUseSSE(...args),
}));

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  mockUseSSE.mockReturnValue({
    lines: [],
    prompts: [],
    scorecard: null,
    isConnected: false,
  });
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve([{callType: 'discovery', displayName: 'Discovery Call'}]),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---- AC: Cards with shadows and borders ----

describe('TICKET-043: Cards with shadows and borders', () => {
  it('TranscriptPanel card has border and shadow', () => {
    render(<TranscriptPanel lines={[]} />);
    const card = screen.getByText('Transcript').closest('div');
    expect(card).toHaveClass('shadow-md', 'border', 'border-gray-200');
  });

  it('CoachingPanel card has border and shadow', () => {
    render(<CoachingPanel prompts={[]} />);
    const card = screen.getByText('Coaching').closest('div');
    expect(card).toHaveClass('shadow-md', 'border', 'border-gray-200');
  });

  it('ScorecardView card has border and shadow', () => {
    const scorecard: Scorecard = {
      overallScore: 80,
      summary: 'Good.',
      entries: [],
    };
    render(<ScorecardView scorecard={scorecard} />);
    const card = screen.getByText('Scorecard').closest('.shadow-lg');
    expect(card).toHaveClass('shadow-lg', 'border', 'border-gray-200');
  });
});

// ---- AC: Speaker badges colored (blue Rep, gray Prospect) ----

describe('TICKET-043: Speaker badges colored', () => {
  it('Rep badge is blue with white text', () => {
    const lines: TranscriptLine[] = [{ speaker: 'rep', text: 'Hi' }];
    render(<TranscriptPanel lines={lines} />);
    const badge = screen.getByText('Rep');
    expect(badge).toHaveClass('bg-blue-600', 'text-white');
  });

  it('Prospect badge is gray with white text', () => {
    const lines: TranscriptLine[] = [{ speaker: 'prospect', text: 'Hi' }];
    render(<TranscriptPanel lines={lines} />);
    const badge = screen.getByText('Prospect');
    expect(badge).toHaveClass('bg-gray-500', 'text-white');
  });
});

// ---- AC: Coaching prompts amber/warning style ----

describe('TICKET-043: Coaching prompts amber/warning style', () => {
  const prompts: CoachingPrompt[] = [
    {
      ruleId: 'rule-1',
      ruleName: 'Ask Questions',
      message: 'Try asking open-ended questions.',
      timestamp: Date.now(),
    },
  ];

  it('coaching prompt has amber background and left border', () => {
    render(<CoachingPanel prompts={prompts} />);
    const card = screen.getByText('Ask Questions').closest('.bg-amber-50');
    expect(card).toHaveClass('bg-amber-50', 'border-l-4', 'border-amber-500');
  });

  it('coaching prompt title uses amber-900 text', () => {
    render(<CoachingPanel prompts={prompts} />);
    const title = screen.getByText('Ask Questions');
    expect(title).toHaveClass('text-amber-900', 'font-bold');
  });

  it('coaching prompt message uses amber-800 text', () => {
    render(<CoachingPanel prompts={prompts} />);
    const msg = screen.getByText('Try asking open-ended questions.');
    expect(msg).toHaveClass('text-amber-800');
  });
});

// ---- AC: Full viewport height with scrollable panels ----

describe('TICKET-043: Full viewport height with scrollable panels', () => {
  it('main element uses h-screen and flex-col for viewport layout', () => {
    render(<Home />);
    const main = document.querySelector('main');
    expect(main).toHaveClass('h-screen', 'flex', 'flex-col');
  });

  it('header has shadow for visual separation', () => {
    render(<Home />);
    const header = document.querySelector('header');
    expect(header).toHaveClass('shadow-sm');
  });

  it('TranscriptPanel has overflow-y-auto for scrolling', () => {
    const lines: TranscriptLine[] = [{ speaker: 'rep', text: 'Line 1' }];
    render(<TranscriptPanel lines={lines} />);
    const scrollArea = screen.getByText('Transcript').parentElement?.querySelector('.overflow-y-auto');
    expect(scrollArea).not.toBeNull();
    expect(scrollArea).toHaveClass('flex-1');
  });

  it('CoachingPanel has overflow-y-auto for scrolling', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Rule', message: 'Msg', timestamp: 1 },
    ];
    render(<CoachingPanel prompts={prompts} />);
    const scrollArea = screen.getByText('Coaching').parentElement?.querySelector('.overflow-y-auto');
    expect(scrollArea).not.toBeNull();
    expect(scrollArea).toHaveClass('flex-1');
  });

  it('page background uses gray-100 for contrast with white cards', () => {
    render(<Home />);
    const main = document.querySelector('main');
    expect(main).toHaveClass('bg-gray-100');
  });
});

// ---- AC: Tests still pass (meta — no dark mode, no inline styles) ----

describe('TICKET-043: Tailwind-only constraints maintained', () => {
  it('no inline styles on TranscriptPanel', () => {
    const lines: TranscriptLine[] = [{ speaker: 'rep', text: 'Test' }];
    const { container } = render(<TranscriptPanel lines={lines} />);
    expect(container.querySelectorAll('[style]').length).toBe(0);
  });

  it('no dark: classes on CoachingPanel', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Rule', message: 'Msg', timestamp: 1 },
    ];
    const { container } = render(<CoachingPanel prompts={prompts} />);
    expect(container.innerHTML).not.toContain('dark:');
  });

  it('no dark: classes on ScorecardView', () => {
    const scorecard: Scorecard = {
      overallScore: 80,
      summary: 'Good.',
      entries: [],
    };
    const { container } = render(<ScorecardView scorecard={scorecard} />);
    expect(container.innerHTML).not.toContain('dark:');
  });
});
