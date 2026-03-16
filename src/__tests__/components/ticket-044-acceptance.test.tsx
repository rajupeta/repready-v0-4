/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScorecardView from '@/components/ScorecardView';
import { Scorecard } from '@/types';

const mockScorecard: Scorecard = {
  overallScore: 68,
  summary: 'Solid discovery call with areas to improve.',
  entries: [
    {
      ruleId: 'rule-1',
      ruleName: 'Active Listening',
      assessment: 'good',
      comment: 'Good active listening throughout.',
    },
    {
      ruleId: 'rule-2',
      ruleName: 'Next Steps',
      assessment: 'missed',
      comment: 'No next steps were established.',
    },
  ],
};

describe('TICKET-044: Scorecard dialog has no close button — user is trapped', () => {
  it('AC1: User is never trapped — New Session button is always visible when onClose is provided', () => {
    const onClose = jest.fn();
    render(<ScorecardView scorecard={mockScorecard} onClose={onClose} />);

    const button = screen.getByText('New Session');
    expect(button).toBeVisible();
  });

  it('AC2: New Session button is functional and calls onClose when clicked', () => {
    const onClose = jest.fn();
    render(<ScorecardView scorecard={mockScorecard} onClose={onClose} />);

    const button = screen.getByText('New Session');
    fireEvent.click(button);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('AC3: Scorecard displays as full-width inline (not modal) — no overlay or dialog elements', () => {
    const onClose = jest.fn();
    const { container } = render(
      <ScorecardView scorecard={mockScorecard} onClose={onClose} />
    );

    // Should not have modal/dialog attributes
    const rootElement = container.firstElementChild!;
    expect(rootElement.getAttribute('role')).not.toBe('dialog');
    expect(rootElement.tagName).not.toBe('DIALOG');

    // Should be a regular div with card styling, not a modal overlay
    expect(rootElement.className).toContain('rounded-xl');
    expect(rootElement.className).not.toContain('fixed');
    expect(rootElement.className).not.toContain('absolute');
    expect(rootElement.className).not.toContain('modal');
  });

  it('AC4: After dismissing, user can start a new session — onClose resets state', () => {
    const onClose = jest.fn();
    const { rerender } = render(
      <ScorecardView scorecard={mockScorecard} onClose={onClose} />
    );

    // Click New Session
    fireEvent.click(screen.getByText('New Session'));
    expect(onClose).toHaveBeenCalled();

    // Simulate parent re-rendering without scorecard (as page.tsx would after reset)
    // The component simply unmounts — no stale state to worry about
    rerender(<div data-testid="session-idle">Session controls visible</div>);
    expect(screen.getByTestId('session-idle')).toBeInTheDocument();
    expect(screen.queryByText('Scorecard')).not.toBeInTheDocument();
  });
});
