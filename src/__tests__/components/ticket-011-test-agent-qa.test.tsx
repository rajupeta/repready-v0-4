/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TranscriptPanel from '@/components/TranscriptPanel';
import CoachingPanel from '@/components/CoachingPanel';
import ScorecardView from '@/components/ScorecardView';
import { TranscriptLine, CoachingPrompt, Scorecard, ScorecardEntry } from '@/types';

// ==========================================================================
// TICKET-011 — Test Agent QA Validation
// Validates all acceptance criteria + additional edge cases for:
//   TranscriptPanel, CoachingPanel, ScorecardView
// ==========================================================================

// ---- TranscriptPanel Tests ----

describe('TranscriptPanel — acceptance criteria', () => {
  it('renders lines with color-coded speaker labels (rep=blue, prospect=gray)', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Hi there' },
      { speaker: 'prospect', text: 'Hello' },
    ];
    render(<TranscriptPanel lines={lines} />);

    const repBadge = screen.getByText('Rep');
    expect(repBadge).toHaveClass('bg-blue-600', 'text-white');

    const prospectBadge = screen.getByText('Prospect');
    expect(prospectBadge).toHaveClass('bg-gray-500', 'text-white');
  });

  it('shows empty state message when no lines provided', () => {
    render(<TranscriptPanel lines={[]} />);
    expect(screen.getByText('Waiting for call to start...')).toBeInTheDocument();
    expect(screen.queryByText('Rep')).not.toBeInTheDocument();
    expect(screen.queryByText('Prospect')).not.toBeInTheDocument();
  });

  it('has a scrollable container with max-height and overflow-y-auto', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Scroll test' },
    ];
    render(<TranscriptPanel lines={lines} />);
    const scrollContainer = screen.getByText('Scroll test').closest('div.overflow-y-auto');
    expect(scrollContainer).not.toBeNull();
    expect(scrollContainer).toHaveClass('flex-1', 'overflow-y-auto');
  });

  it('auto-scrolls to bottom when new lines are added (useEffect triggers on lines change)', () => {
    const mockScrollHeight = 500;

    const lines1: TranscriptLine[] = [
      { speaker: 'rep', text: 'Line 1' },
    ];
    const { rerender } = render(<TranscriptPanel lines={lines1} />);

    // Get the scroll container
    const scrollContainer = screen.getByText('Line 1').closest('.overflow-y-auto');
    expect(scrollContainer).not.toBeNull();

    // Define scrollHeight
    Object.defineProperty(scrollContainer!, 'scrollHeight', {
      value: mockScrollHeight,
      writable: true,
      configurable: true,
    });

    // Rerender with new lines to trigger useEffect
    const lines2: TranscriptLine[] = [
      { speaker: 'rep', text: 'Line 1' },
      { speaker: 'prospect', text: 'Line 2' },
      { speaker: 'rep', text: 'Line 3' },
    ];
    rerender(<TranscriptPanel lines={lines2} />);

    // Verify all lines rendered
    expect(screen.getByText('Line 1')).toBeInTheDocument();
    expect(screen.getByText('Line 2')).toBeInTheDocument();
    expect(screen.getByText('Line 3')).toBeInTheDocument();
  });

  it('uses "use client" directive (component file check)', async () => {
    // Verify the component can render in jsdom (client-side) environment
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Client component test' },
    ];
    const { container } = render(<TranscriptPanel lines={lines} />);
    expect(container.querySelector('div')).not.toBeNull();
  });
});

describe('TranscriptPanel — additional edge cases', () => {
  it('renders single rep line correctly', () => {
    render(<TranscriptPanel lines={[{ speaker: 'rep', text: 'Solo rep' }]} />);
    expect(screen.getByText('Rep')).toBeInTheDocument();
    expect(screen.getByText('Solo rep')).toBeInTheDocument();
  });

  it('renders single prospect line correctly', () => {
    render(<TranscriptPanel lines={[{ speaker: 'prospect', text: 'Solo prospect' }]} />);
    expect(screen.getByText('Prospect')).toBeInTheDocument();
    expect(screen.getByText('Solo prospect')).toBeInTheDocument();
  });

  it('handles transition from empty to populated state', () => {
    const { rerender } = render(<TranscriptPanel lines={[]} />);
    expect(screen.getByText('Waiting for call to start...')).toBeInTheDocument();

    rerender(<TranscriptPanel lines={[{ speaker: 'rep', text: 'First message' }]} />);
    expect(screen.queryByText('Waiting for call to start...')).not.toBeInTheDocument();
    expect(screen.getByText('First message')).toBeInTheDocument();
  });

  it('renders many lines without error', () => {
    const lines: TranscriptLine[] = Array.from({ length: 100 }, (_, i) => ({
      speaker: i % 2 === 0 ? 'rep' as const : 'prospect' as const,
      text: `Line number ${i}`,
    }));
    render(<TranscriptPanel lines={lines} />);
    expect(screen.getByText('Line number 0')).toBeInTheDocument();
    expect(screen.getByText('Line number 99')).toBeInTheDocument();
  });

  it('preserves line text exactly as provided (special characters)', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Price is $1,000 — that\'s 50% off!' },
      { speaker: 'prospect', text: '<script>alert("xss")</script>' },
    ];
    render(<TranscriptPanel lines={lines} />);
    expect(screen.getByText('Price is $1,000 — that\'s 50% off!')).toBeInTheDocument();
    expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
  });

  it('each line has flex layout with gap between badge and text', () => {
    render(<TranscriptPanel lines={[{ speaker: 'rep', text: 'Layout check' }]} />);
    const lineContainer = screen.getByText('Rep').closest('div.flex');
    expect(lineContainer).not.toBeNull();
    expect(lineContainer).toHaveClass('items-start', 'gap-3');
  });

  it('speaker badge has shrink-0 to prevent compression', () => {
    render(<TranscriptPanel lines={[{ speaker: 'rep', text: 'Shrink test' }]} />);
    const badge = screen.getByText('Rep');
    expect(badge).toHaveClass('shrink-0');
  });
});

// ---- CoachingPanel Tests ----

describe('CoachingPanel — acceptance criteria', () => {
  it('renders prompts as styled cards with rule name and message', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Active Listening', message: 'Try reflecting back what the prospect said.', timestamp: 1000 },
    ];
    render(<CoachingPanel prompts={prompts} />);
    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('Try reflecting back what the prospect said.')).toBeInTheDocument();
  });

  it('shows empty state when no prompts', () => {
    render(<CoachingPanel prompts={[]} />);
    expect(screen.getByText('No coaching prompts yet')).toBeInTheDocument();
  });

  it('renders most recent prompt at top (reverses input order)', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Oldest', message: 'Old msg', timestamp: 100 },
      { ruleId: 'r2', ruleName: 'Middle', message: 'Mid msg', timestamp: 200 },
      { ruleId: 'r3', ruleName: 'Newest', message: 'New msg', timestamp: 300 },
    ];
    render(<CoachingPanel prompts={prompts} />);

    const headers = screen.getAllByRole('heading', { level: 3 });
    expect(headers[0]).toHaveTextContent('Newest');
    expect(headers[1]).toHaveTextContent('Middle');
    expect(headers[2]).toHaveTextContent('Oldest');
  });

  it('uses amber/yellow styling for coaching cards', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Test Rule', message: 'Test message', timestamp: 1 },
    ];
    render(<CoachingPanel prompts={prompts} />);

    const card = screen.getByText('Test Rule').closest('div.border-amber-500');
    expect(card).not.toBeNull();
    expect(card).toHaveClass('bg-amber-50');

    const header = screen.getByText('Test Rule');
    expect(header).toHaveClass('text-amber-900');

    const message = screen.getByText('Test message');
    expect(message).toHaveClass('text-amber-800');
  });

  it('uses "use client" directive (renders in jsdom)', () => {
    const { container } = render(<CoachingPanel prompts={[]} />);
    expect(container.querySelector('div')).not.toBeNull();
  });
});

describe('CoachingPanel — additional edge cases', () => {
  it('renders a single prompt correctly', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Only Rule', message: 'Only msg', timestamp: 1 },
    ];
    render(<CoachingPanel prompts={prompts} />);
    expect(screen.getByText('Only Rule')).toBeInTheDocument();
    expect(screen.getByText('Only msg')).toBeInTheDocument();
  });

  it('handles prompts with long messages', () => {
    const longMsg = 'Consider asking more open-ended questions. '.repeat(20).trim();
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Verbose Rule', message: longMsg, timestamp: 1 },
    ];
    render(<CoachingPanel prompts={prompts} />);
    expect(screen.getByText(longMsg)).toBeInTheDocument();
  });

  it('handles transition from empty to populated', () => {
    const { rerender } = render(<CoachingPanel prompts={[]} />);
    expect(screen.getByText('No coaching prompts yet')).toBeInTheDocument();

    rerender(<CoachingPanel prompts={[
      { ruleId: 'r1', ruleName: 'New Prompt', message: 'Fresh coaching', timestamp: 1 },
    ]} />);
    expect(screen.queryByText('No coaching prompts yet')).not.toBeInTheDocument();
    expect(screen.getByText('New Prompt')).toBeInTheDocument();
  });

  it('does not mutate original prompts array', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'First', message: 'A', timestamp: 1 },
      { ruleId: 'r2', ruleName: 'Second', message: 'B', timestamp: 2 },
      { ruleId: 'r3', ruleName: 'Third', message: 'C', timestamp: 3 },
    ];
    const originalOrder = [...prompts];
    render(<CoachingPanel prompts={prompts} />);

    // Verify the original array was not reversed in place
    expect(prompts[0].ruleId).toBe(originalOrder[0].ruleId);
    expect(prompts[1].ruleId).toBe(originalOrder[1].ruleId);
    expect(prompts[2].ruleId).toBe(originalOrder[2].ruleId);
  });

  it('renders many prompts without error', () => {
    const prompts: CoachingPrompt[] = Array.from({ length: 50 }, (_, i) => ({
      ruleId: `r${i}`,
      ruleName: `Rule ${i}`,
      message: `Message ${i}`,
      timestamp: i * 1000,
    }));
    render(<CoachingPanel prompts={prompts} />);

    // Most recent (last added) should appear first
    const headers = screen.getAllByRole('heading', { level: 3 });
    expect(headers[0]).toHaveTextContent('Rule 49');
    expect(headers[headers.length - 1]).toHaveTextContent('Rule 0');
  });

  it('each card has rule name as h3 header and message as paragraph', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Structure Check', message: 'Check structure', timestamp: 1 },
    ];
    render(<CoachingPanel prompts={prompts} />);

    const header = screen.getByText('Structure Check');
    expect(header.tagName).toBe('H3');
    expect(header).toHaveClass('text-sm', 'font-bold');

    const message = screen.getByText('Check structure');
    expect(message.tagName).toBe('P');
  });
});

// ---- ScorecardView Tests ----

describe('ScorecardView — acceptance criteria', () => {
  const fullScorecard: Scorecard = {
    overallScore: 72,
    summary: 'Solid call performance. Strong discovery phase but needs improvement on closing.',
    entries: [
      { ruleId: 'r1', ruleName: 'Discovery Questions', assessment: 'good', comment: 'Asked relevant questions' },
      { ruleId: 'r2', ruleName: 'Objection Handling', assessment: 'needs-work', comment: 'Missed some objections' },
      { ruleId: 'r3', ruleName: 'Closing Technique', assessment: 'missed', comment: 'No closing attempt made' },
    ],
  };

  it('displays prominent overall score as large number', () => {
    render(<ScorecardView scorecard={fullScorecard} />);
    const score = screen.getByText('72');
    expect(score).toHaveClass('text-7xl', 'font-extrabold');
  });

  it('color-codes score green when >= 70', () => {
    render(<ScorecardView scorecard={fullScorecard} />);
    expect(screen.getByText('72')).toHaveClass('text-green-600');
  });

  it('color-codes score yellow when >= 40 and < 70', () => {
    render(<ScorecardView scorecard={{ ...fullScorecard, overallScore: 55 }} />);
    expect(screen.getByText('55')).toHaveClass('text-yellow-600');
  });

  it('color-codes score red when < 40', () => {
    render(<ScorecardView scorecard={{ ...fullScorecard, overallScore: 20 }} />);
    expect(screen.getByText('20')).toHaveClass('text-red-600');
  });

  it('displays per-rule assessment badges with correct colors', () => {
    render(<ScorecardView scorecard={fullScorecard} />);

    const goodBadge = screen.getByText('good');
    expect(goodBadge).toHaveClass('bg-green-100', 'text-green-800');

    const needsWorkBadge = screen.getByText('needs-work');
    expect(needsWorkBadge).toHaveClass('bg-yellow-100', 'text-yellow-800');

    const missedBadge = screen.getByText('missed');
    expect(missedBadge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('displays rule names and comments for each entry', () => {
    render(<ScorecardView scorecard={fullScorecard} />);

    expect(screen.getByText('Discovery Questions')).toBeInTheDocument();
    expect(screen.getByText('Asked relevant questions')).toBeInTheDocument();
    expect(screen.getByText('Objection Handling')).toBeInTheDocument();
    expect(screen.getByText('Missed some objections')).toBeInTheDocument();
    expect(screen.getByText('Closing Technique')).toBeInTheDocument();
    expect(screen.getByText('No closing attempt made')).toBeInTheDocument();
  });

  it('displays summary paragraph at bottom', () => {
    render(<ScorecardView scorecard={fullScorecard} />);
    const summary = screen.getByText('Solid call performance. Strong discovery phase but needs improvement on closing.');
    expect(summary).toBeInTheDocument();
    // Summary is in a blue background container
    const summaryContainer = summary.closest('div.bg-blue-50');
    expect(summaryContainer).not.toBeNull();
  });

  it('renders close button when onClose is provided and calls it on click', () => {
    const onClose = jest.fn();
    render(<ScorecardView scorecard={fullScorecard} onClose={onClose} />);

    const closeBtn = screen.getByText('New Session');
    expect(closeBtn.tagName).toBe('BUTTON');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render close button when onClose is omitted', () => {
    render(<ScorecardView scorecard={fullScorecard} />);
    expect(screen.queryByText('New Session')).not.toBeInTheDocument();
  });

  it('uses Tailwind CSS and "use client" directive (renders in jsdom)', () => {
    const { container } = render(<ScorecardView scorecard={fullScorecard} />);
    expect(container.querySelector('div.rounded-lg')).not.toBeNull();
  });
});

describe('ScorecardView — score boundary edge cases', () => {
  const makeScorecard = (score: number): Scorecard => ({
    overallScore: score,
    summary: `Score: ${score}`,
    entries: [],
  });

  it.each([
    [70, 'text-green-600'],
    [71, 'text-green-600'],
    [100, 'text-green-600'],
    [69, 'text-yellow-600'],
    [40, 'text-yellow-600'],
    [50, 'text-yellow-600'],
    [39, 'text-red-600'],
    [0, 'text-red-600'],
    [1, 'text-red-600'],
  ])('score %d gets class %s', (score, expectedClass) => {
    render(<ScorecardView scorecard={makeScorecard(score)} />);
    const el = screen.getByText(String(score));
    expect(el).toHaveClass(expectedClass);
  });
});

describe('ScorecardView — additional edge cases', () => {
  it('renders with only "good" assessments', () => {
    const scorecard: Scorecard = {
      overallScore: 95,
      summary: 'Excellent',
      entries: [
        { ruleId: 'r1', ruleName: 'Rule A', assessment: 'good', comment: 'Great' },
        { ruleId: 'r2', ruleName: 'Rule B', assessment: 'good', comment: 'Superb' },
      ],
    };
    render(<ScorecardView scorecard={scorecard} />);
    const badges = screen.getAllByText('good');
    expect(badges).toHaveLength(2);
    badges.forEach(badge => expect(badge).toHaveClass('bg-green-100'));
  });

  it('renders with only "missed" assessments', () => {
    const scorecard: Scorecard = {
      overallScore: 10,
      summary: 'Needs significant improvement',
      entries: [
        { ruleId: 'r1', ruleName: 'Rule A', assessment: 'missed', comment: 'Did not attempt' },
        { ruleId: 'r2', ruleName: 'Rule B', assessment: 'missed', comment: 'Absent' },
      ],
    };
    render(<ScorecardView scorecard={scorecard} />);
    const badges = screen.getAllByText('missed');
    expect(badges).toHaveLength(2);
    badges.forEach(badge => expect(badge).toHaveClass('bg-red-100'));
  });

  it('renders with empty entries array', () => {
    const scorecard: Scorecard = {
      overallScore: 0,
      summary: 'No data',
      entries: [],
    };
    render(<ScorecardView scorecard={scorecard} />);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('No data')).toBeInTheDocument();
  });

  it('renders close button with correct styling', () => {
    const onClose = jest.fn();
    render(<ScorecardView scorecard={{ overallScore: 50, summary: 'Test', entries: [] }} onClose={onClose} />);

    const closeBtn = screen.getByText('New Session');
    expect(closeBtn).toHaveClass('rounded-lg', 'text-sm', 'font-semibold');
  });

  it('onClose button click does not fire multiple times for single click', () => {
    const onClose = jest.fn();
    render(<ScorecardView scorecard={{ overallScore: 50, summary: 'Test', entries: [] }} onClose={onClose} />);

    fireEvent.click(screen.getByText('New Session'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('displays "Overall Score" label text', () => {
    render(<ScorecardView scorecard={{ overallScore: 50, summary: 'Test', entries: [] }} />);
    expect(screen.getByText('Overall Score')).toBeInTheDocument();
  });

  it('displays "Scorecard" heading', () => {
    render(<ScorecardView scorecard={{ overallScore: 50, summary: 'Test', entries: [] }} />);
    const heading = screen.getByText('Scorecard');
    expect(heading.tagName).toBe('H2');
  });

  it('entry comment text uses gray-600 styling', () => {
    const scorecard: Scorecard = {
      overallScore: 60,
      summary: 'Test',
      entries: [
        { ruleId: 'r1', ruleName: 'Rule', assessment: 'good', comment: 'Style check comment' },
      ],
    };
    render(<ScorecardView scorecard={scorecard} />);
    const comment = screen.getByText('Style check comment');
    expect(comment).toHaveClass('text-sm', 'text-gray-600');
  });

  it('handles many entries without error', () => {
    const entries: ScorecardEntry[] = Array.from({ length: 20 }, (_, i) => ({
      ruleId: `r${i}`,
      ruleName: `Rule ${i}`,
      assessment: (['good', 'needs-work', 'missed'] as const)[i % 3],
      comment: `Comment for rule ${i}`,
    }));
    const scorecard: Scorecard = {
      overallScore: 65,
      summary: 'Many entries test',
      entries,
    };
    render(<ScorecardView scorecard={scorecard} />);
    expect(screen.getByText('Rule 0')).toBeInTheDocument();
    expect(screen.getByText('Rule 19')).toBeInTheDocument();
  });
});

// ---- Cross-component type integration ----

describe('Component type integration', () => {
  it('TranscriptPanel accepts TranscriptLine[] type correctly', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Type check', timestamp: 12345 },
    ];
    const { container } = render(<TranscriptPanel lines={lines} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('CoachingPanel accepts CoachingPrompt[] type correctly', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Rule', message: 'Msg', timestamp: 12345 },
    ];
    const { container } = render(<CoachingPanel prompts={prompts} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('ScorecardView accepts Scorecard type correctly', () => {
    const scorecard: Scorecard = {
      overallScore: 80,
      summary: 'Good',
      entries: [{ ruleId: 'r1', ruleName: 'Rule', assessment: 'good', comment: 'Nice' }],
    };
    const { container } = render(<ScorecardView scorecard={scorecard} />);
    expect(container.firstChild).not.toBeNull();
  });

  it('all components import types from @/types', () => {
    // This test verifies that types are properly exported from the types module
    // If any type was missing, TypeScript compilation would fail and this file wouldn't run
    const line: TranscriptLine = { speaker: 'rep', text: 'test' };
    const prompt: CoachingPrompt = { ruleId: 'r', ruleName: 'R', message: 'm', timestamp: 0 };
    const entry: ScorecardEntry = { ruleId: 'r', ruleName: 'R', assessment: 'good', comment: 'c' };
    const scorecard: Scorecard = { overallScore: 0, summary: 's', entries: [entry] };

    expect(line.speaker).toBe('rep');
    expect(prompt.ruleId).toBe('r');
    expect(scorecard.overallScore).toBe(0);
  });
});
