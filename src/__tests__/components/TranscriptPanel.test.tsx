/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import TranscriptPanel from '@/components/TranscriptPanel';
import { TranscriptLine } from '@/types';

describe('TranscriptPanel', () => {
  it('shows empty state when no lines', () => {
    render(<TranscriptPanel lines={[]} />);
    expect(screen.getByText('Waiting for call to start...')).toBeInTheDocument();
  });

  it('renders transcript lines with speaker labels', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Hello, how are you?' },
      { speaker: 'prospect', text: 'Doing well, thanks.' },
    ];
    render(<TranscriptPanel lines={lines} />);

    expect(screen.getByText('Rep')).toBeInTheDocument();
    expect(screen.getByText('Prospect')).toBeInTheDocument();
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
    expect(screen.getByText('Doing well, thanks.')).toBeInTheDocument();
  });

  it('applies blue styling to Rep badge', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Test line' },
    ];
    render(<TranscriptPanel lines={lines} />);
    const badge = screen.getByText('Rep');
    expect(badge.className).toContain('bg-blue-100');
    expect(badge.className).toContain('text-blue-800');
  });

  it('applies gray styling to Prospect badge', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'prospect', text: 'Test line' },
    ];
    render(<TranscriptPanel lines={lines} />);
    const badge = screen.getByText('Prospect');
    expect(badge.className).toContain('bg-gray-100');
    expect(badge.className).toContain('text-gray-800');
  });

  it('auto-scrolls container when lines change', () => {
    const lines: TranscriptLine[] = [
      { speaker: 'rep', text: 'Line 1' },
    ];
    const { rerender } = render(<TranscriptPanel lines={lines} />);

    const updatedLines: TranscriptLine[] = [
      ...lines,
      { speaker: 'prospect', text: 'Line 2' },
    ];
    rerender(<TranscriptPanel lines={updatedLines} />);

    expect(screen.getByText('Line 2')).toBeInTheDocument();
  });
});
