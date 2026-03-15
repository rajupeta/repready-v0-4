/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SessionPage from '@/app/session/page';
import { Scorecard } from '@/types';

const mockUseSSE = jest.fn();
jest.mock('@/hooks/useSSE', () => ({
  useSSE: (...args: unknown[]) => mockUseSSE(...args),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

function defaultSSE() {
  return {
    lines: [],
    prompts: [],
    scorecard: null,
    isConnected: false,
  };
}

beforeEach(() => {
  mockUseSSE.mockReturnValue(defaultSSE());
  mockFetch.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// =============================================================
// AC: Call type dropdown replaces fixture picker
// =============================================================
describe('TICKET-026: Call type dropdown replaces fixture picker', () => {
  it('renders call type dropdown with 4 options', () => {
    render(<SessionPage />);
    const select = screen.getByLabelText('Select call type');
    expect(select).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
    expect(options[0]).toHaveTextContent('Discovery Call');
    expect(options[1]).toHaveTextContent('Demo Call');
    expect(options[2]).toHaveTextContent('Objection Handling');
    expect(options[3]).toHaveTextContent('Follow-up Call');
  });

  it('does not fetch /api/fixtures on mount', () => {
    render(<SessionPage />);
    expect(mockFetch).not.toHaveBeenCalledWith('/api/fixtures');
  });

  it('default selected call type is discovery', () => {
    render(<SessionPage />);
    const select = screen.getByLabelText('Select call type') as HTMLSelectElement;
    expect(select.value).toBe('discovery');
  });

  it('maps discovery call type to fixtureId discovery-call', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<SessionPage />);
    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
        body: JSON.stringify({ fixtureId: 'discovery-call' }),
      }));
    });
  });

  it('maps demo call type to fixtureId demo-call', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's2' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<SessionPage />);
    fireEvent.change(screen.getByLabelText('Select call type'), { target: { value: 'demo' } });
    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
        body: JSON.stringify({ fixtureId: 'demo-call' }),
      }));
    });
  });

  it('disables call type dropdown during active session', async () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<SessionPage />);
    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(screen.getByLabelText('Select call type')).toBeDisabled();
    });
  });
});

// =============================================================
// AC: End Call button visible and functional in session view
// =============================================================
describe('TICKET-026: End Call button', () => {
  it('does not show End Call button when idle', () => {
    render(<SessionPage />);
    expect(screen.queryByText('End Call')).not.toBeInTheDocument();
  });

  it('shows End Call button when session is active', async () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<SessionPage />);
    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(screen.getByText('End Call')).toBeInTheDocument();
    });
  });

  it('End Call button has aria-label', async () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<SessionPage />);
    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(screen.getByLabelText('End Call')).toBeInTheDocument();
    });
  });

  it('End Call button calls POST /api/sessions/:id/end', async () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'end-test' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'ended' }) });

    render(<SessionPage />);
    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(screen.getByText('End Call')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('End Call'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/end-test/end', { method: 'POST' });
    });
  });

  it('End Call transitions to completed state', async () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'ended' }) });

    render(<SessionPage />);
    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(screen.getByText('End Call')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('End Call'));

    await waitFor(() => {
      expect(screen.getByText('Session Complete')).toBeInTheDocument();
    });
    expect(screen.queryByText('End Call')).not.toBeInTheDocument();
  });

  it('End Call button has red styling', async () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<SessionPage />);
    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      const endBtn = screen.getByText('End Call');
      expect(endBtn).toHaveClass('bg-red-600');
    });
  });
});

// =============================================================
// AC: Scorecard renders full-width (not split, not modal)
// =============================================================
describe('TICKET-026: Scorecard full-width layout', () => {
  const sampleScorecard: Scorecard = {
    overallScore: 75,
    summary: 'Solid performance',
    entries: [
      { ruleId: 'r1', ruleName: 'Active Listening', assessment: 'good', comment: 'Well done' },
      { ruleId: 'r2', ruleName: 'Discovery', assessment: 'needs-work', comment: 'Dig deeper' },
    ],
  };

  it('shows scorecard inline when session completes', () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: sampleScorecard });
    render(<SessionPage />);

    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('Solid performance')).toBeInTheDocument();
  });

  it('scorecard is NOT a modal overlay (no fixed positioning)', () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: sampleScorecard });
    render(<SessionPage />);

    const overlay = document.querySelector('.fixed.inset-0.z-50');
    expect(overlay).toBeNull();
  });

  it('scorecard replaces the transcript/coaching grid', () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: sampleScorecard });
    render(<SessionPage />);

    // Grid should NOT be visible when scorecard is shown
    const grid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
    expect(grid).toBeNull();

    // Scorecard content should be visible
    expect(screen.getByText('75')).toBeInTheDocument();
  });

  it('shows transcript/coaching grid when no scorecard', () => {
    render(<SessionPage />);
    const grid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
    expect(grid).not.toBeNull();
  });

  it('Close button on scorecard resets to new session state', () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: sampleScorecard });
    render(<SessionPage />);

    expect(screen.getByText('75')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close'));

    // Scorecard should be gone, grid should be back
    expect(screen.queryByText('75')).not.toBeInTheDocument();
    const grid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
    expect(grid).not.toBeNull();
  });

  it('displays all scorecard entries with assessments', () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: sampleScorecard });
    render(<SessionPage />);

    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('good')).toBeInTheDocument();
    expect(screen.getByText('Well done')).toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('needs-work')).toBeInTheDocument();
    expect(screen.getByText('Dig deeper')).toBeInTheDocument();
  });
});

// =============================================================
// AC: Session page accessible at /session route
// =============================================================
describe('TICKET-026: Session page at /session route', () => {
  it('session page file exists and exports a component', () => {
    expect(typeof SessionPage).toBe('function');
  });

  it('root page.tsx redirects to /session', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const pagePath = path.resolve(__dirname, '../app/page.tsx');
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source).toContain("redirect('/session')");
  });

  it('session/page.tsx has "use client" directive', async () => {
    const fs = await import('fs');
    const path = await import('path');
    const pagePath = path.resolve(__dirname, '../app/session/page.tsx');
    const source = fs.readFileSync(pagePath, 'utf-8');

    expect(source.trimStart().startsWith("'use client'")).toBe(true);
  });
});

// =============================================================
// Integration: End-to-end session flow
// =============================================================
describe('TICKET-026: Session flow integration', () => {
  it('full flow: select call type → start → end → scorecard → new session', async () => {
    let sseReturn = defaultSSE();
    mockUseSSE.mockImplementation(() => sseReturn);
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'flow-test' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'ended' }) });

    const { rerender } = render(<SessionPage />);

    // 1. Select call type
    fireEvent.change(screen.getByLabelText('Select call type'), { target: { value: 'demo' } });

    // 2. Start session
    fireEvent.click(screen.getByText('Start Session'));

    // 3. Session becomes active
    sseReturn = { ...defaultSSE(), isConnected: true };
    mockUseSSE.mockImplementation(() => sseReturn);
    rerender(<SessionPage />);

    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
      expect(screen.getByText('End Call')).toBeInTheDocument();
    });

    // 4. End call
    fireEvent.click(screen.getByText('End Call'));

    await waitFor(() => {
      expect(screen.getByText('Session Complete')).toBeInTheDocument();
    });
  });
});
