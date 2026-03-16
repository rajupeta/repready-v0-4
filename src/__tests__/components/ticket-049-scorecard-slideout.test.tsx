/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import CoachingPanel from '@/components/CoachingPanel';
import { CoachingPrompt } from '@/types';

describe('TICKET-049: Scorecard as slide-out panel', () => {
  const prompts: CoachingPrompt[] = [
    {
      ruleId: 'rule-1',
      ruleName: 'Ask Open Questions',
      message: 'Try asking an open-ended question.',
      timestamp: Date.now(),
    },
  ];

  describe('View Scorecard button in CoachingPanel', () => {
    it('does not show View Scorecard button during active session', () => {
      render(
        <CoachingPanel
          prompts={prompts}
          sessionCompleted={false}
          onGenerateScorecard={jest.fn()}
        />
      );
      expect(screen.queryByText('View Scorecard')).not.toBeInTheDocument();
    });

    it('shows View Scorecard button when session is completed', () => {
      render(
        <CoachingPanel
          prompts={prompts}
          sessionCompleted={true}
          onGenerateScorecard={jest.fn()}
        />
      );
      expect(screen.getByText('View Scorecard')).toBeInTheDocument();
    });

    it('calls onGenerateScorecard when button is clicked', () => {
      const onGenerateScorecard = jest.fn();
      render(
        <CoachingPanel
          prompts={prompts}
          sessionCompleted={true}
          onGenerateScorecard={onGenerateScorecard}
        />
      );
      fireEvent.click(screen.getByText('View Scorecard'));
      expect(onGenerateScorecard).toHaveBeenCalledTimes(1);
    });

    it('does not show View Scorecard button when onGenerateScorecard is not provided', () => {
      render(
        <CoachingPanel
          prompts={prompts}
          sessionCompleted={true}
        />
      );
      expect(screen.queryByText('View Scorecard')).not.toBeInTheDocument();
    });

    it('shows View Scorecard button even with empty prompts when session completed', () => {
      render(
        <CoachingPanel
          prompts={[]}
          sessionCompleted={true}
          onGenerateScorecard={jest.fn()}
        />
      );
      expect(screen.getByText('View Scorecard')).toBeInTheDocument();
    });

    it('coaching prompts remain visible when session is completed', () => {
      render(
        <CoachingPanel
          prompts={prompts}
          sessionCompleted={true}
          onGenerateScorecard={jest.fn()}
        />
      );
      expect(screen.getByText('Ask Open Questions')).toBeInTheDocument();
      expect(screen.getByText('Try asking an open-ended question.')).toBeInTheDocument();
    });
  });

  describe('CoachingPanel backward compatibility', () => {
    it('still works without new props (backward compatible)', () => {
      render(<CoachingPanel prompts={prompts} />);
      expect(screen.getByText('Ask Open Questions')).toBeInTheDocument();
      expect(screen.queryByText('View Scorecard')).not.toBeInTheDocument();
    });

    it('shows empty state without new props', () => {
      render(<CoachingPanel prompts={[]} />);
      expect(screen.getByText('No coaching prompts yet')).toBeInTheDocument();
    });
  });
});
