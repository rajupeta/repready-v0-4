/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import TranscriptPanel from '@/components/TranscriptPanel';
import CoachingPanel from '@/components/CoachingPanel';
import ScorecardView from '@/components/ScorecardView';
import { TranscriptLine, CoachingPrompt, Scorecard } from '@/types';
import * as fs from 'fs';
import * as path from 'path';

// ==========================================================================
// TICKET-011 Acceptance Criteria Validation
// Final QA gate — validates every acceptance criterion listed in the ticket
// ==========================================================================

// ---- File-level checks ----

describe('TICKET-011: file structure and directives', () => {
  const componentsDir = path.resolve(__dirname, '../../components');

  it('TranscriptPanel.tsx exists in src/components/', () => {
    expect(fs.existsSync(path.join(componentsDir, 'TranscriptPanel.tsx'))).toBe(true);
  });

  it('CoachingPanel.tsx exists in src/components/', () => {
    expect(fs.existsSync(path.join(componentsDir, 'CoachingPanel.tsx'))).toBe(true);
  });

  it('ScorecardView.tsx exists in src/components/', () => {
    expect(fs.existsSync(path.join(componentsDir, 'ScorecardView.tsx'))).toBe(true);
  });

  it('TranscriptPanel has "use client" directive', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'TranscriptPanel.tsx'), 'utf-8');
    expect(content.trimStart().startsWith("'use client'")).toBe(true);
  });

  it('CoachingPanel has "use client" directive', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'CoachingPanel.tsx'), 'utf-8');
    expect(content.trimStart().startsWith("'use client'")).toBe(true);
  });

  it('ScorecardView has "use client" directive', () => {
    const content = fs.readFileSync(path.join(componentsDir, 'ScorecardView.tsx'), 'utf-8');
    expect(content.trimStart().startsWith("'use client'")).toBe(true);
  });

  it('all components import types from @/types (source check)', () => {
    const files = ['TranscriptPanel.tsx', 'CoachingPanel.tsx', 'ScorecardView.tsx'];
    for (const file of files) {
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
      expect(content).toContain("from '@/types'");
    }
  });

  it('all components use Tailwind CSS classes', () => {
    const files = ['TranscriptPanel.tsx', 'CoachingPanel.tsx', 'ScorecardView.tsx'];
    for (const file of files) {
      const content = fs.readFileSync(path.join(componentsDir, file), 'utf-8');
      expect(content).toContain('className=');
    }
  });
});

// ---- TranscriptPanel acceptance criteria ----

describe('TICKET-011: TranscriptPanel renders lines with color-coded speaker labels', () => {
  it('rep speaker gets blue badge (bg-blue-600 text-white)', () => {
    render(<TranscriptPanel lines={[{ speaker: 'rep', text: 'Hello' }]} />);
    const badge = screen.getByText('Rep');
    expect(badge).toHaveClass('bg-blue-600', 'text-white');
  });

  it('prospect speaker gets gray badge (bg-gray-500 text-white)', () => {
    render(<TranscriptPanel lines={[{ speaker: 'prospect', text: 'Hi' }]} />);
    const badge = screen.getByText('Prospect');
    expect(badge).toHaveClass('bg-gray-500', 'text-white');
  });

  it('renders text content next to each badge', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'How can I help?' },
      { speaker: 'prospect', text: 'Tell me about pricing.' },
    ];
    render(<TranscriptPanel lines={lines} />);
    expect(screen.getByText('How can I help?')).toBeInTheDocument();
    expect(screen.getByText('Tell me about pricing.')).toBeInTheDocument();
  });

  it('renders mixed conversation with alternating speakers', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Welcome' },
      { speaker: 'prospect', text: 'Thanks' },
      { speaker: 'rep', text: 'What brings you in?' },
      { speaker: 'prospect', text: 'Looking for a solution' },
    ];
    render(<TranscriptPanel lines={lines} />);
    expect(screen.getAllByText('Rep')).toHaveLength(2);
    expect(screen.getAllByText('Prospect')).toHaveLength(2);
  });
});

describe('TICKET-011: TranscriptPanel auto-scrolls to bottom', () => {
  it('scroll container exists with overflow-y-auto and flex-1', () => {
    render(<TranscriptPanel lines={[{ speaker: 'rep', text: 'Scroll me' }]} />);
    const container = screen.getByText('Scroll me').closest('.overflow-y-auto');
    expect(container).not.toBeNull();
    expect(container).toHaveClass('flex-1');
  });

  it('re-render with additional lines still renders all content', () => {
    const initial: TranscriptLine[] = [{ speaker: 'rep', text: 'First' }];
    const { rerender } = render(<TranscriptPanel lines={initial} />);

    const updated: TranscriptLine[] = [
      ...initial,
      { speaker: 'prospect', text: 'Second' },
      { speaker: 'rep', text: 'Third' },
    ];
    rerender(<TranscriptPanel lines={updated} />);

    expect(screen.getByText('First')).toBeInTheDocument();
    expect(screen.getByText('Second')).toBeInTheDocument();
    expect(screen.getByText('Third')).toBeInTheDocument();
  });

  it('container uses useRef (scrollTop is set to scrollHeight on update)', () => {
    const lines: TranscriptLine[] = [{ speaker: 'rep', text: 'Test scroll' }];
    const { rerender } = render(<TranscriptPanel lines={lines} />);

    const container = screen.getByText('Test scroll').closest('.overflow-y-auto') as HTMLDivElement;
    Object.defineProperty(container, 'scrollHeight', { value: 999, configurable: true });

    rerender(<TranscriptPanel lines={[...lines, { speaker: 'prospect', text: 'New' }]} />);
    // scrollTop should have been set to scrollHeight (999)
    expect(container.scrollTop).toBe(999);
  });
});

describe('TICKET-011: TranscriptPanel shows empty state when no lines', () => {
  it('displays "Waiting for call to start..." with empty array', () => {
    render(<TranscriptPanel lines={[]} />);
    expect(screen.getByText('Waiting for call to start...')).toBeInTheDocument();
  });

  it('does not show speaker badges in empty state', () => {
    render(<TranscriptPanel lines={[]} />);
    expect(screen.queryByText('Rep')).not.toBeInTheDocument();
    expect(screen.queryByText('Prospect')).not.toBeInTheDocument();
  });

  it('transitions from empty to populated correctly', () => {
    const { rerender } = render(<TranscriptPanel lines={[]} />);
    expect(screen.getByText('Waiting for call to start...')).toBeInTheDocument();

    rerender(<TranscriptPanel lines={[{ speaker: 'rep', text: 'Call started' }]} />);
    expect(screen.queryByText('Waiting for call to start...')).not.toBeInTheDocument();
    expect(screen.getByText('Call started')).toBeInTheDocument();
  });
});

// ---- CoachingPanel acceptance criteria ----

describe('TICKET-011: CoachingPanel renders prompts as styled cards', () => {
  it('card has rule name as header and message as body', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Open Questions', message: 'Ask more open-ended questions', timestamp: 1000 },
    ];
    render(<CoachingPanel prompts={prompts} />);

    const header = screen.getByText('Open Questions');
    expect(header.tagName).toBe('H3');

    const message = screen.getByText('Ask more open-ended questions');
    expect(message.tagName).toBe('P');
  });

  it('cards use amber/yellow styling', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Empathy', message: 'Show understanding', timestamp: 1 },
    ];
    render(<CoachingPanel prompts={prompts} />);

    // Card container
    const card = screen.getByText('Empathy').closest('div');
    expect(card).toHaveClass('bg-amber-50', 'border-amber-500');

    // Header text color
    expect(screen.getByText('Empathy')).toHaveClass('text-amber-900');

    // Message text color
    expect(screen.getByText('Show understanding')).toHaveClass('text-amber-800');
  });

  it('most recent prompt appears at top', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Early', message: 'M1', timestamp: 100 },
      { ruleId: 'r2', ruleName: 'Later', message: 'M2', timestamp: 200 },
    ];
    render(<CoachingPanel prompts={prompts} />);

    const text = document.body.textContent!;
    expect(text.indexOf('Later')).toBeLessThan(text.indexOf('Early'));
  });

  it('multiple prompts all render with cards', () => {
    const prompts: CoachingPrompt[] = [
      { ruleId: 'r1', ruleName: 'Rule A', message: 'Msg A', timestamp: 1 },
      { ruleId: 'r2', ruleName: 'Rule B', message: 'Msg B', timestamp: 2 },
      { ruleId: 'r3', ruleName: 'Rule C', message: 'Msg C', timestamp: 3 },
    ];
    render(<CoachingPanel prompts={prompts} />);

    expect(screen.getByText('Rule A')).toBeInTheDocument();
    expect(screen.getByText('Rule B')).toBeInTheDocument();
    expect(screen.getByText('Rule C')).toBeInTheDocument();
    expect(screen.getByText('Msg A')).toBeInTheDocument();
    expect(screen.getByText('Msg B')).toBeInTheDocument();
    expect(screen.getByText('Msg C')).toBeInTheDocument();
  });
});

describe('TICKET-011: CoachingPanel shows empty state', () => {
  it('displays "No coaching prompts yet" when prompts is empty', () => {
    render(<CoachingPanel prompts={[]} />);
    expect(screen.getByText('No coaching prompts yet')).toBeInTheDocument();
  });

  it('shows heading "Coaching" even in empty state', () => {
    render(<CoachingPanel prompts={[]} />);
    expect(screen.getByText('Coaching')).toBeInTheDocument();
  });
});

// ---- ScorecardView acceptance criteria ----

describe('TICKET-011: ScorecardView displays overall score with color coding', () => {
  const baseScorecard: Scorecard = {
    overallScore: 75,
    summary: 'Test summary',
    entries: [],
  };

  it('score is displayed as large prominent number', () => {
    render(<ScorecardView scorecard={baseScorecard} />);
    const score = screen.getByText('75');
    expect(score).toHaveClass('text-7xl', 'font-extrabold');
  });

  it('green (text-green-600) for score >= 70', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 70 }} />);
    expect(screen.getByText('70')).toHaveClass('text-green-600');
  });

  it('green for score 85', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 85 }} />);
    expect(screen.getByText('85')).toHaveClass('text-green-600');
  });

  it('yellow (text-yellow-600) for score >= 40 and < 70', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 55 }} />);
    expect(screen.getByText('55')).toHaveClass('text-yellow-600');
  });

  it('yellow for score 40 (boundary)', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 40 }} />);
    expect(screen.getByText('40')).toHaveClass('text-yellow-600');
  });

  it('red (text-red-600) for score < 40', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 25 }} />);
    expect(screen.getByText('25')).toHaveClass('text-red-600');
  });

  it('red for score 0', () => {
    render(<ScorecardView scorecard={{ ...baseScorecard, overallScore: 0 }} />);
    expect(screen.getByText('0')).toHaveClass('text-red-600');
  });
});

describe('TICKET-011: ScorecardView per-rule assessment badges', () => {
  it('good assessment has green badge (bg-green-100 text-green-800)', () => {
    const scorecard: Scorecard = {
      overallScore: 80,
      summary: 'Good',
      entries: [{ ruleId: 'r1', ruleName: 'Test Rule', assessment: 'good', comment: 'Well done' }],
    };
    render(<ScorecardView scorecard={scorecard} />);
    const badge = screen.getByText('good');
    expect(badge).toHaveClass('bg-green-100', 'text-green-800');
  });

  it('needs-work assessment has yellow badge (bg-yellow-100 text-yellow-800)', () => {
    const scorecard: Scorecard = {
      overallScore: 50,
      summary: 'Okay',
      entries: [{ ruleId: 'r1', ruleName: 'Test Rule', assessment: 'needs-work', comment: 'Try harder' }],
    };
    render(<ScorecardView scorecard={scorecard} />);
    const badge = screen.getByText('needs-work');
    expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800');
  });

  it('missed assessment has red badge (bg-red-100 text-red-800)', () => {
    const scorecard: Scorecard = {
      overallScore: 20,
      summary: 'Poor',
      entries: [{ ruleId: 'r1', ruleName: 'Test Rule', assessment: 'missed', comment: 'Not attempted' }],
    };
    render(<ScorecardView scorecard={scorecard} />);
    const badge = screen.getByText('missed');
    expect(badge).toHaveClass('bg-red-100', 'text-red-800');
  });

  it('displays rule name, assessment, and comment for each entry', () => {
    const scorecard: Scorecard = {
      overallScore: 65,
      summary: 'Mixed results',
      entries: [
        { ruleId: 'r1', ruleName: 'Active Listening', assessment: 'good', comment: 'Strong skills' },
        { ruleId: 'r2', ruleName: 'Closing', assessment: 'missed', comment: 'No attempt' },
      ],
    };
    render(<ScorecardView scorecard={scorecard} />);

    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('Strong skills')).toBeInTheDocument();
    expect(screen.getByText('Closing')).toBeInTheDocument();
    expect(screen.getByText('No attempt')).toBeInTheDocument();
  });
});

describe('TICKET-011: ScorecardView summary and close button', () => {
  const scorecard: Scorecard = {
    overallScore: 72,
    summary: 'Overall solid performance with room to grow.',
    entries: [
      { ruleId: 'r1', ruleName: 'Rule 1', assessment: 'good', comment: 'Great' },
    ],
  };

  it('displays summary paragraph', () => {
    render(<ScorecardView scorecard={scorecard} />);
    expect(screen.getByText('Overall solid performance with room to grow.')).toBeInTheDocument();
  });

  it('summary is in a styled container (bg-blue-50)', () => {
    render(<ScorecardView scorecard={scorecard} />);
    const summary = screen.getByText('Overall solid performance with room to grow.');
    expect(summary.closest('.bg-blue-50')).not.toBeNull();
  });

  it('renders close button when onClose is provided', () => {
    const onClose = jest.fn();
    render(<ScorecardView scorecard={scorecard} onClose={onClose} />);
    expect(screen.getByText('New Session')).toBeInTheDocument();
  });

  it('close button calls onClose when clicked', () => {
    const onClose = jest.fn();
    render(<ScorecardView scorecard={scorecard} onClose={onClose} />);
    fireEvent.click(screen.getByText('New Session'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render close button when onClose is not provided', () => {
    render(<ScorecardView scorecard={scorecard} />);
    expect(screen.queryByText('New Session')).not.toBeInTheDocument();
  });
});

// ---- TypeScript compilation check ----

describe('TICKET-011: TypeScript compiles clean', () => {
  it('TranscriptLine type has required speaker and text fields', () => {
    const line: TranscriptLine = { speaker: 'rep', text: 'test' };
    expect(line.speaker).toBe('rep');
    expect(line.text).toBe('test');
  });

  it('CoachingPrompt type has required ruleId, ruleName, message, timestamp', () => {
    const prompt: CoachingPrompt = { ruleId: 'r1', ruleName: 'Rule', message: 'msg', timestamp: 123 };
    expect(prompt.ruleId).toBe('r1');
  });

  it('Scorecard type has required entries, overallScore, summary', () => {
    const sc: Scorecard = { entries: [], overallScore: 0, summary: '' };
    expect(sc.overallScore).toBe(0);
  });
});
