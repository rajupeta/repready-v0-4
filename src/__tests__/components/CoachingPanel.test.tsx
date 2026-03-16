/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import CoachingPanel from '@/components/CoachingPanel';
import { CoachingPrompt } from '@/types';

describe('CoachingPanel', () => {
  it('shows empty state when no prompts', () => {
    render(<CoachingPanel prompts={[]} />);
    expect(screen.getByText('No coaching prompts yet')).toBeInTheDocument();
  });

  it('renders coaching prompts with rule name and message', () => {
    const prompts: CoachingPrompt[] = [
      {
        ruleId: 'rule-1',
        ruleName: 'Ask Open Questions',
        message: 'Try asking an open-ended question.',
        timestamp: Date.now(),
      },
    ];
    render(<CoachingPanel prompts={prompts} />);

    expect(screen.getByText('Ask Open Questions')).toBeInTheDocument();
    expect(screen.getByText('Try asking an open-ended question.')).toBeInTheDocument();
  });

  it('renders most recent prompt first', () => {
    const prompts: CoachingPrompt[] = [
      {
        ruleId: 'rule-1',
        ruleName: 'First Rule',
        message: 'First message',
        timestamp: 1000,
      },
      {
        ruleId: 'rule-2',
        ruleName: 'Second Rule',
        message: 'Second message',
        timestamp: 2000,
      },
    ];
    render(<CoachingPanel prompts={prompts} />);

    const cards = screen.getAllByText(/Rule$/);
    expect(cards[0]).toHaveTextContent('Second Rule');
    expect(cards[1]).toHaveTextContent('First Rule');
  });

  it('applies amber styling to prompt cards', () => {
    const prompts: CoachingPrompt[] = [
      {
        ruleId: 'rule-1',
        ruleName: 'Test Rule',
        message: 'Test message',
        timestamp: Date.now(),
      },
    ];
    render(<CoachingPanel prompts={prompts} />);

    const header = screen.getByText('Test Rule');
    expect(header.className).toContain('text-amber-900');
  });
});
