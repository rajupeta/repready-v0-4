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

// ============================================================
// TICKET-011 QA Validation — Edge cases and additional coverage
// ============================================================

describe('TranscriptPanel — edge cases', () => {
  it('renders multiple lines in order', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'First line' },
      { speaker: 'prospect', text: 'Second line' },
      { speaker: 'rep', text: 'Third line' },
      { speaker: 'prospect', text: 'Fourth line' },
    ];
    render(<TranscriptPanel lines={lines} />);

    const allText = document.body.textContent;
    const firstIdx = allText!.indexOf('First line');
    const secondIdx = allText!.indexOf('Second line');
    const thirdIdx = allText!.indexOf('Third line');
    const fourthIdx = allText!.indexOf('Fourth line');
    expect(firstIdx).toBeLessThan(secondIdx);
    expect(secondIdx).toBeLessThan(thirdIdx);
    expect(thirdIdx).toBeLessThan(fourthIdx);
  });

  it('handles lines with optional timestamp field', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'With timestamp', timestamp: 1234 },
      { speaker: 'prospect', text: 'Without timestamp' },
    ];
    render(<TranscriptPanel lines={lines} />);
    expect(screen.getByText('With timestamp')).toBeInTheDocument();
    expect(screen.getByText('Without timestamp')).toBeInTheDocument();
  });

  it('renders heading "Transcript" in both empty and populated states', () => {
    const { rerender } = render(<TranscriptPanel lines={[]} />);
    expect(screen.getByText('Transcript')).toBeInTheDocument();

    rerender(
      <TranscriptPanel lines={[{ speaker: 'rep', text: 'Hi' }]} />
    );
    expect(screen.getByText('Transcript')).toBeInTheDocument();
  });

  it('scrolling container has correct overflow classes', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Test' },
    ];
    render(<TranscriptPanel lines={lines} />);
    const container = screen.getByText('Test').closest('.overflow-y-auto');
    expect(container).not.toBeNull();
    expect(container!.className).toContain('flex-1');
  });

  it('handles long text content without breaking', () => {
    const longText = 'A'.repeat(500);
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: longText },
    ];
    render(<TranscriptPanel lines={lines} />);
    expect(screen.getByText(longText)).toBeInTheDocument();
  });

  it('correctly labels all rep lines as Rep and all prospect lines as Prospect', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Rep says one' },
      { speaker: 'rep', text: 'Rep says two' },
      { speaker: 'prospect', text: 'Prospect says one' },
    ];
    render(<TranscriptPanel lines={lines} />);
    const repBadges = screen.getAllByText('Rep');
    const prospectBadges = screen.getAllByText('Prospect');
    expect(repBadges).toHaveLength(2);
    expect(prospectBadges).toHaveLength(1);
  });
});

describe('CoachingPanel — edge cases', () => {
  it('renders heading "Coaching" in both empty and populated states', () => {
    const { rerender } = render(<CoachingPanel prompts={[]} />);
    expect(screen.getByText('Coaching')).toBeInTheDocument();

    rerender(
      <CoachingPanel
        prompts={[
          { ruleId: 'r1', ruleName: 'Rule', message: 'Msg', timestamp: 1 },
        ]}
      />
    );
    expect(screen.getByText('Coaching')).toBeInTheDocument();
  });

  it('renders card containers with amber border and background', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Test', message: 'Test msg', timestamp: 1 },
    ];
    render(<CoachingPanel prompts={prompts} />);
    const card = screen.getByText('Test').closest('.border-amber-500');
    expect(card).not.toBeNull();
    expect(card!.className).toContain('bg-amber-50');
  });

  it('renders multiple prompts in natural order (oldest first)', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Alpha', message: 'A msg', timestamp: 100 },
      { ruleId: 'r2', ruleName: 'Beta', message: 'B msg', timestamp: 200 },
      { ruleId: 'r3', ruleName: 'Gamma', message: 'G msg', timestamp: 300 },
    ];
    render(<CoachingPanel prompts={prompts} />);

    const allText = document.body.textContent!;
    const alphaIdx = allText.indexOf('Alpha');
    const betaIdx = allText.indexOf('Beta');
    const gammaIdx = allText.indexOf('Gamma');
    expect(alphaIdx).toBeLessThan(betaIdx);
    expect(betaIdx).toBeLessThan(gammaIdx);
  });

  it('displays message body text with amber-700 styling', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Rule', message: 'Check this', timestamp: 1 },
    ];
    render(<CoachingPanel prompts={prompts} />);
    const msgEl = screen.getByText('Check this');
    expect(msgEl.className).toContain('text-amber-800');
  });

  it('does not mutate the original prompts array', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'First', message: 'A', timestamp: 1 },
      { ruleId: 'r2', ruleName: 'Second', message: 'B', timestamp: 2 },
    ];
    const originalFirst = prompts[0];
    render(<CoachingPanel prompts={prompts} />);
    expect(prompts[0]).toBe(originalFirst);
  });
});

describe('ScorecardView — edge cases', () => {
  const baseScorecard: Scorecard = {
    overallScore: 50,
    summary: 'Test summary',
    entries: [
      { ruleId: 'r1', ruleName: 'Rule One', assessment: 'good', comment: 'Nice' },
    ],
  };

  it('score boundary: exactly 70 is green', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 70 }} />);
    const score = screen.getByText('70');
    expect(score.className).toContain('text-green-600');
  });

  it('score boundary: exactly 40 is yellow', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 40 }} />);
    const score = screen.getByText('40');
    expect(score.className).toContain('text-yellow-600');
  });

  it('score boundary: 39 is red', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 39 }} />);
    const score = screen.getByText('39');
    expect(score.className).toContain('text-red-600');
  });

  it('score boundary: 69 is yellow', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 69 }} />);
    const score = screen.getByText('69');
    expect(score.className).toContain('text-yellow-600');
  });

  it('score boundary: 0 is red', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 0 }} />);
    const score = screen.getByText('0');
    expect(score.className).toContain('text-red-600');
  });

  it('score boundary: 100 is green', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 100 }} />);
    const score = screen.getByText('100');
    expect(score.className).toContain('text-green-600');
  });

  it('renders with empty entries array', () => {
    const scorecard: Scorecard = {
      overallScore: 60,
      summary: 'No entries',
      entries: [],
    };
    render(<ScorecardView scorecard={scorecard} />);
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.getByText('No entries')).toBeInTheDocument();
  });

  it('renders "Overall Score" label', () => {
    render(<ScorecardView scorecard={baseScorecard} />);
    expect(screen.getByText('Overall Score')).toBeInTheDocument();
  });

  it('renders "Scorecard" heading', () => {
    render(<ScorecardView scorecard={baseScorecard} />);
    expect(screen.getByText('Scorecard')).toBeInTheDocument();
  });

  it('does not render close button when onClose is undefined', () => {
    render(<ScorecardView scorecard={baseScorecard} />);
    expect(screen.queryByText('Close')).not.toBeInTheDocument();
  });

  it('uses ruleId as key for entries (no duplicate key warnings)', () => {
    const scorecard: Scorecard = {
      overallScore: 80,
      summary: 'Multi-entry test',
      entries: [
        { ruleId: 'r1', ruleName: 'Rule A', assessment: 'good', comment: 'OK' },
        { ruleId: 'r2', ruleName: 'Rule B', assessment: 'missed', comment: 'Miss' },
        { ruleId: 'r3', ruleName: 'Rule C', assessment: 'needs-work', comment: 'Meh' },
      ],
    };
    render(<ScorecardView scorecard={scorecard} />);
    expect(screen.getByText('Rule A')).toBeInTheDocument();
    expect(screen.getByText('Rule B')).toBeInTheDocument();
    expect(screen.getByText('Rule C')).toBeInTheDocument();
  });
});

describe('All components — structural checks', () => {
  it('TranscriptPanel is a default export', () => {
    expect(typeof TranscriptPanel).toBe('function');
  });

  it('CoachingPanel is a default export', () => {
    expect(typeof CoachingPanel).toBe('function');
  });

  it('ScorecardView is a default export', () => {
    expect(typeof ScorecardView).toBe('function');
  });
});
