/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScorecardView from '@/components/ScorecardView';
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

describe('ScorecardView', () => {
  it('displays overall score prominently', () => {
    render(<ScorecardView scorecard={mockScorecard} />);
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('applies green color for score >= 70', () => {
    render(<ScorecardView scorecard={{ ...mockScorecard, overallScore: 85 }} />);
    const score = screen.getByText('85');
    expect(score.className).toContain('text-green-600');
  });

  it('applies yellow color for score >= 40 and < 70', () => {
    render(<ScorecardView scorecard={{ ...mockScorecard, overallScore: 55 }} />);
    const score = screen.getByText('55');
    expect(score.className).toContain('text-yellow-600');
  });

  it('applies red color for score < 40', () => {
    render(<ScorecardView scorecard={{ ...mockScorecard, overallScore: 25 }} />);
    const score = screen.getByText('25');
    expect(score.className).toContain('text-red-600');
  });

  it('renders all rule entries with assessment badges', () => {
    render(<ScorecardView scorecard={mockScorecard} />);

    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('good')).toBeInTheDocument();

    expect(screen.getByText('Value Proposition')).toBeInTheDocument();
    expect(screen.getByText('needs-work')).toBeInTheDocument();

    expect(screen.getByText('Objection Handling')).toBeInTheDocument();
    expect(screen.getByText('missed')).toBeInTheDocument();
  });

  it('applies correct colors to assessment badges', () => {
    render(<ScorecardView scorecard={mockScorecard} />);

    const goodBadge = screen.getByText('good');
    expect(goodBadge.className).toContain('bg-green-100');

    const needsWorkBadge = screen.getByText('needs-work');
    expect(needsWorkBadge.className).toContain('bg-yellow-100');

    const missedBadge = screen.getByText('missed');
    expect(missedBadge.className).toContain('bg-red-100');
  });

  it('displays entry comments', () => {
    render(<ScorecardView scorecard={mockScorecard} />);
    expect(screen.getByText('Demonstrated strong active listening skills.')).toBeInTheDocument();
  });

  it('displays summary paragraph', () => {
    render(<ScorecardView scorecard={mockScorecard} />);
    expect(screen.getByText('Good performance overall with room for improvement.')).toBeInTheDocument();
  });

  it('renders New Session button when onClose is provided', () => {
    const onClose = jest.fn();
    render(<ScorecardView scorecard={mockScorecard} onClose={onClose} />);

    const newSessionButton = screen.getByText('New Session');
    fireEvent.click(newSessionButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render New Session button when onClose is not provided', () => {
    render(<ScorecardView scorecard={mockScorecard} />);
    expect(screen.queryByText('New Session')).not.toBeInTheDocument();
  });
});
