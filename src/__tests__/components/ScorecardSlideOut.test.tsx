/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScorecardSlideOut from '@/components/ScorecardSlideOut';
import { Scorecard } from '@/types';

const mockScorecard: Scorecard = {
  overallScore: 75,
  summary: 'Good performance overall with room for improvement.',
  entries: [
    {
      ruleId: 'rule-1',
      ruleName: 'Active Listening',
      assessment: 'good',
      comment: 'Demonstrated strong active listening skills.',
    },
    {
      ruleId: 'rule-2',
      ruleName: 'Value Proposition',
      assessment: 'needs-work',
      comment: 'Could improve value proposition delivery.',
    },
    {
      ruleId: 'rule-3',
      ruleName: 'Objection Handling',
      assessment: 'missed',
      comment: 'Did not address prospect objections.',
    },
  ],
};

describe('ScorecardSlideOut', () => {
  const defaultProps = {
    scorecard: mockScorecard,
    isOpen: true,
    onClose: jest.fn(),
    onNewSession: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders scorecard content when open', () => {
    render(<ScorecardSlideOut {...defaultProps} />);
    expect(screen.getByText('Scorecard')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('Overall Score')).toBeInTheDocument();
  });

  it('displays all rule entries with assessments', () => {
    render(<ScorecardSlideOut {...defaultProps} />);
    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('good')).toBeInTheDocument();
    expect(screen.getByText('Value Proposition')).toBeInTheDocument();
    expect(screen.getByText('needs-work')).toBeInTheDocument();
    expect(screen.getByText('Objection Handling')).toBeInTheDocument();
    expect(screen.getByText('missed')).toBeInTheDocument();
  });

  it('displays summary text', () => {
    render(<ScorecardSlideOut {...defaultProps} />);
    expect(screen.getByText('Good performance overall with room for improvement.')).toBeInTheDocument();
  });

  it('has a close button that calls onClose', () => {
    const onClose = jest.fn();
    render(<ScorecardSlideOut {...defaultProps} onClose={onClose} />);
    const closeButton = screen.getByTestId('scorecard-close-button');
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has a New Session button that calls onNewSession', () => {
    const onNewSession = jest.fn();
    render(<ScorecardSlideOut {...defaultProps} onNewSession={onNewSession} />);
    const newSessionButton = screen.getByTestId('new-session-button');
    fireEvent.click(newSessionButton);
    expect(onNewSession).toHaveBeenCalledTimes(1);
  });

  it('is translated off-screen when closed', () => {
    render(<ScorecardSlideOut {...defaultProps} isOpen={false} />);
    const panel = screen.getByTestId('scorecard-slideout');
    expect(panel.className).toContain('translate-x-full');
    expect(panel.className).not.toContain('translate-x-0');
  });

  it('is visible (translate-x-0) when open', () => {
    render(<ScorecardSlideOut {...defaultProps} isOpen={true} />);
    const panel = screen.getByTestId('scorecard-slideout');
    expect(panel.className).toContain('translate-x-0');
  });

  it('renders backdrop when open', () => {
    render(<ScorecardSlideOut {...defaultProps} isOpen={true} />);
    expect(screen.getByTestId('scorecard-backdrop')).toBeInTheDocument();
  });

  it('does not render backdrop when closed', () => {
    render(<ScorecardSlideOut {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('scorecard-backdrop')).not.toBeInTheDocument();
  });

  it('clicking backdrop calls onClose', () => {
    const onClose = jest.fn();
    render(<ScorecardSlideOut {...defaultProps} onClose={onClose} isOpen={true} />);
    fireEvent.click(screen.getByTestId('scorecard-backdrop'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('scorecard content is scrollable', () => {
    render(<ScorecardSlideOut {...defaultProps} />);
    const content = screen.getByTestId('scorecard-content');
    expect(content.className).toContain('overflow-y-auto');
  });

  it('does not take over the full screen — uses max-w-md', () => {
    render(<ScorecardSlideOut {...defaultProps} />);
    const panel = screen.getByTestId('scorecard-slideout');
    expect(panel.className).toContain('max-w-md');
  });

  it('has role=dialog for accessibility', () => {
    render(<ScorecardSlideOut {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('applies correct score color — green for >= 70', () => {
    render(<ScorecardSlideOut {...defaultProps} />);
    const score = screen.getByText('75');
    expect(score.className).toContain('text-green-600');
  });

  it('applies correct score color — yellow for >= 40 and < 70', () => {
    render(
      <ScorecardSlideOut
        {...defaultProps}
        scorecard={{ ...mockScorecard, overallScore: 55 }}
      />
    );
    const score = screen.getByText('55');
    expect(score.className).toContain('text-yellow-600');
  });

  it('applies correct score color — red for < 40', () => {
    render(
      <ScorecardSlideOut
        {...defaultProps}
        scorecard={{ ...mockScorecard, overallScore: 25 }}
      />
    );
    const score = screen.getByText('25');
    expect(score.className).toContain('text-red-600');
  });
});
