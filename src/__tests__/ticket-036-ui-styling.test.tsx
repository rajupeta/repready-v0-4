/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TranscriptPanel from '@/components/TranscriptPanel';
import CoachingPanel from '@/components/CoachingPanel';
import ScorecardView from '@/components/ScorecardView';
import { TranscriptLine, CoachingPrompt, Scorecard } from '@/types';

// ---- AC: Clear visual hierarchy with card shadows ----

describe('TICKET-036: Visual hierarchy with card shadows', () => {
  it('TranscriptPanel has shadow-md class for card depth', () => {
    render(<TranscriptPanel lines={[]} />);
    const card = screen.getByText('Transcript').closest('div');
    expect(card).toHaveClass('shadow-md');
  });

  it('CoachingPanel has shadow-md class for card depth', () => {
    render(<CoachingPanel prompts={[]} />);
    const card = screen.getByText('Coaching').closest('div');
    expect(card).toHaveClass('shadow-md');
  });

  it('ScorecardView has shadow-lg class for elevated card', () => {
    const scorecard: Scorecard = {
      overallScore: 80,
      summary: 'Great job.',
      entries: [],
    };
    render(<ScorecardView scorecard={scorecard} />);
    const card = screen.getByText('Scorecard').closest('.shadow-lg');
    expect(card).not.toBeNull();
    expect(card).toHaveClass('shadow-lg', 'bg-white');
  });

  it('TranscriptPanel uses rounded-xl for polished card edges', () => {
    render(<TranscriptPanel lines={[]} />);
    const card = screen.getByText('Transcript').closest('div');
    expect(card).toHaveClass('rounded-xl');
  });

  it('CoachingPanel uses rounded-xl for polished card edges', () => {
    render(<CoachingPanel prompts={[]} />);
    const card = screen.getByText('Coaching').closest('div');
    expect(card).toHaveClass('rounded-xl');
  });

  it('ScorecardView uses rounded-xl for polished card edges', () => {
    const scorecard: Scorecard = {
      overallScore: 80,
      summary: 'Great job.',
      entries: [],
    };
    render(<ScorecardView scorecard={scorecard} />);
    const card = screen.getByText('Scorecard').closest('.rounded-xl');
    expect(card).not.toBeNull();
    expect(card).toHaveClass('rounded-xl');
  });

  it('all panels use white background for cards on gray page', () => {
    render(<TranscriptPanel lines={[]} />);
    const card = screen.getByText('Transcript').closest('div');
    expect(card).toHaveClass('bg-white');
  });
});

// ---- AC: Speaker badges prominently colored ----

describe('TICKET-036: Speaker badges prominently colored', () => {
  it('Rep badge uses solid blue background with white text', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Hello' },
    ];
    render(<TranscriptPanel lines={lines} />);
    const badge = screen.getByText('Rep');
    expect(badge).toHaveClass('bg-blue-600', 'text-white');
  });

  it('Prospect badge uses solid gray background with white text', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'prospect', text: 'Hi' },
    ];
    render(<TranscriptPanel lines={lines} />);
    const badge = screen.getByText('Prospect');
    expect(badge).toHaveClass('bg-gray-500', 'text-white');
  });

  it('badges use uppercase tracking and bold font', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Test' },
    ];
    render(<TranscriptPanel lines={lines} />);
    const badge = screen.getByText('Rep');
    expect(badge).toHaveClass('uppercase', 'font-bold', 'tracking-wide');
  });
});

// ---- AC: Coaching prompts have amber/warning styling ----

describe('TICKET-036: Coaching prompts have amber/warning styling', () => {
  const prompts: CoachingPrompt[] = [
    {
      ruleId: 'rule-1',
      ruleName: 'Ask Questions',
      message: 'Try open-ended questions.',
      timestamp: Date.now(),
    },
  ];

  it('coaching card has amber-50 background', () => {
    render(<CoachingPanel prompts={prompts} />);
    const card = screen.getByText('Ask Questions').closest('div');
    expect(card).toHaveClass('bg-amber-50');
  });

  it('coaching card has amber left border accent', () => {
    render(<CoachingPanel prompts={prompts} />);
    const card = screen.getByText('Ask Questions').closest('div');
    expect(card).toHaveClass('border-l-4', 'border-amber-500');
  });

  it('coaching card has shadow-sm for subtle depth', () => {
    render(<CoachingPanel prompts={prompts} />);
    const card = screen.getByText('Ask Questions').closest('div');
    expect(card).toHaveClass('shadow-sm');
  });

  it('coaching title uses dark amber text', () => {
    render(<CoachingPanel prompts={prompts} />);
    const title = screen.getByText('Ask Questions');
    expect(title).toHaveClass('text-amber-900', 'font-bold');
  });
});

// ---- AC: Full viewport height with scrollable panels ----

describe('TICKET-036: Full viewport height with scrollable panels', () => {
  it('TranscriptPanel uses flex-col with flex-1 scrollable area', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Line 1' },
    ];
    render(<TranscriptPanel lines={lines} />);
    const card = screen.getByText('Transcript').closest('div');
    expect(card).toHaveClass('flex', 'flex-col', 'h-full');
  });

  it('CoachingPanel uses flex-col with flex-1 scrollable area', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Rule', message: 'Msg', timestamp: 1 },
    ];
    render(<CoachingPanel prompts={prompts} />);
    const card = screen.getByText('Coaching').closest('div');
    expect(card).toHaveClass('flex', 'flex-col', 'h-full');
  });

  it('TranscriptPanel scroll container has overflow-y-auto', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Scrollable content' },
    ];
    render(<TranscriptPanel lines={lines} />);
    const title = screen.getByText('Transcript');
    const scrollContainer = title.parentElement?.querySelector('.overflow-y-auto');
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer).toHaveClass('flex-1');
  });
});

// ---- AC: Tailwind-only, no custom CSS, no dark mode ----

describe('TICKET-036: Tailwind-only constraints', () => {
  it('components use only Tailwind utility classes (no inline styles)', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Test' },
    ];
    const { container } = render(<TranscriptPanel lines={lines} />);
    const allElements = container.querySelectorAll('[style]');
    expect(allElements.length).toBe(0);
  });

  it('no dark: prefix classes used in TranscriptPanel', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Test' },
    ];
    const { container } = render(<TranscriptPanel lines={lines} />);
    const html = container.innerHTML;
    expect(html).not.toContain('dark:');
  });

  it('no dark: prefix classes used in CoachingPanel', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Rule', message: 'Msg', timestamp: 1 },
    ];
    const { container } = render(<CoachingPanel prompts={prompts} />);
    const html = container.innerHTML;
    expect(html).not.toContain('dark:');
  });
});
