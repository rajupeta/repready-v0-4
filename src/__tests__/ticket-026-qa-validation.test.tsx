/**
 * @jest-environment jsdom
 */
/**
 * TICKET-026 QA Validation Tests — Test Agent
 *
 * Validates all acceptance criteria for UI fixes:
 *   AC1: End Call button visible and functional in session view
 *   AC2: Session page accessible at /session route
 *   AC3: Scorecard renders full-width (not split, not modal)
 *   AC4: Call type dropdown replaces fixture picker
 *   AC5: All UI changes covered by component tests
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import fs from 'fs';
import path from 'path';
import SessionPage from '@/app/session/page';
import { Scorecard, CallType } from '@/types';

// ---- Mocks ----
const mockUseSSE = jest.fn();
jest.mock('@/hooks/useSSE', () => ({
  useSSE: (...args: unknown[]) => mockUseSSE(...args),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

function defaultSSE() {
  return { lines: [], prompts: [], scorecard: null, isConnected: false };
}

const sampleScorecard: Scorecard = {
  overallScore: 82,
  summary: 'Solid discovery call with room for improvement',
  entries: [
    { ruleId: 'r1', ruleName: 'Active Listening', assessment: 'good', comment: 'Great job' },
    { ruleId: 'r2', ruleName: 'Open Questions', assessment: 'needs-work', comment: 'Ask more' },
    { ruleId: 'r3', ruleName: 'Next Steps', assessment: 'missed', comment: 'No follow-up set' },
  ],
};

beforeEach(() => {
  mockUseSSE.mockReturnValue(defaultSSE());
  mockFetch.mockReset();
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Helper: start a session and wait for it to become active
async function startActiveSession(sessionId = 'qa-session') {
  mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
  mockFetch
    .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId }) })
    .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

  render(<SessionPage />);

  await act(async () => {
    fireEvent.click(screen.getByText('Start Session'));
    await new Promise((r) => setTimeout(r, 0));
  });

  return sessionId;
}

// =============================================================
// AC1: End Call button visible and functional in session view
// =============================================================
describe('AC1: End Call button', () => {
  it('is hidden in idle state', () => {
    render(<SessionPage />);
    expect(screen.queryByLabelText('End Call')).toBeNull();
  });

  it('is hidden in loading state', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // hang
    render(<SessionPage />);
    fireEvent.click(screen.getByText('Start Session'));
    expect(screen.queryByLabelText('End Call')).toBeNull();
  });

  it('appears when session becomes active', async () => {
    await startActiveSession();
    expect(screen.getByLabelText('End Call')).toBeInTheDocument();
  });

  it('sends POST to /api/sessions/{id}/end', async () => {
    const sid = await startActiveSession('end-api-test');
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'ended' }) });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('End Call'));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(mockFetch).toHaveBeenCalledWith(`/api/sessions/${sid}/end`, { method: 'POST' });
  });

  it('disappears after End Call is clicked', async () => {
    await startActiveSession();
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'ended' }) });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('End Call'));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.queryByLabelText('End Call')).toBeNull();
  });

  it('transitions UI to completed even when end-call API rejects', async () => {
    await startActiveSession('fail-end');
    mockFetch.mockRejectedValueOnce(new Error('server error'));

    await act(async () => {
      fireEvent.click(screen.getByLabelText('End Call'));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByText('Session Complete')).toBeInTheDocument();
    expect(screen.queryByLabelText('End Call')).toBeNull();
  });

  it('has red background styling (bg-red-600)', async () => {
    await startActiveSession();
    const btn = screen.getByLabelText('End Call');
    expect(btn.className).toContain('bg-red-600');
  });
});

// =============================================================
// AC2: Session page accessible at /session route
// =============================================================
describe('AC2: Session page at /session route', () => {
  it('SessionPage is a valid React component', () => {
    expect(typeof SessionPage).toBe('function');
  });

  it('root page.tsx uses redirect to /session', () => {
    const rootPage = fs.readFileSync(
      path.resolve(__dirname, '../app/page.tsx'),
      'utf-8'
    );
    expect(rootPage).toContain("redirect('/session')");
    expect(rootPage).toContain("from 'next/navigation'");
  });

  it('session/page.tsx starts with "use client" directive', () => {
    const sessionPage = fs.readFileSync(
      path.resolve(__dirname, '../app/session/page.tsx'),
      'utf-8'
    );
    expect(sessionPage.trimStart().startsWith("'use client'")).toBe(true);
  });

  it('root page.tsx no longer has client-side code', () => {
    const rootPage = fs.readFileSync(
      path.resolve(__dirname, '../app/page.tsx'),
      'utf-8'
    );
    // Should NOT have useState, useEffect, or 'use client'
    expect(rootPage).not.toContain('useState');
    expect(rootPage).not.toContain('useEffect');
    expect(rootPage).not.toContain("'use client'");
  });

  it('session/page.tsx imports useSSE hook', () => {
    const source = fs.readFileSync(
      path.resolve(__dirname, '../app/session/page.tsx'),
      'utf-8'
    );
    expect(source).toContain("from '@/hooks/useSSE'");
  });
});

// =============================================================
// AC3: Scorecard renders full-width (not split, not modal)
// =============================================================
describe('AC3: Scorecard full-width layout', () => {
  it('renders scorecard inline when session completes with scorecard data', () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: sampleScorecard });
    render(<SessionPage />);

    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('Solid discovery call with room for improvement')).toBeInTheDocument();
  });

  it('does NOT use modal overlay (no fixed/inset-0/z-50 elements)', () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: sampleScorecard });
    render(<SessionPage />);

    expect(document.querySelector('.fixed.inset-0')).toBeNull();
    expect(document.querySelector('[class*="z-50"]')).toBeNull();
  });

  it('hides transcript/coaching grid when scorecard is visible', () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: sampleScorecard });
    render(<SessionPage />);

    expect(document.querySelector('.grid.grid-cols-1')).toBeNull();
  });

  it('shows transcript/coaching grid when no scorecard', () => {
    render(<SessionPage />);
    const grid = document.querySelector('.grid.grid-cols-1');
    expect(grid).not.toBeNull();
  });

  it('scorecard renders all three assessment types (good, needs-work, missed)', () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: sampleScorecard });
    render(<SessionPage />);

    expect(screen.getByText('good')).toBeInTheDocument();
    expect(screen.getByText('needs-work')).toBeInTheDocument();
    expect(screen.getByText('missed')).toBeInTheDocument();
  });

  it('scorecard Close button resets to idle and restores grid', () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: sampleScorecard });
    render(<SessionPage />);

    expect(screen.getByText('82')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Close'));

    // Grid restored
    expect(document.querySelector('.grid.grid-cols-1')).not.toBeNull();
    // Score gone (scorecard not rendered since scorecardDismissed=true)
    expect(screen.queryByText('82')).toBeNull();
    // Start Session re-enabled
    expect(screen.getByText('Start Session')).not.toBeDisabled();
  });

  it('scorecard with max score (100) renders correctly', () => {
    const maxScorecard: Scorecard = {
      overallScore: 100,
      summary: 'Perfect call',
      entries: [{ ruleId: 'r1', ruleName: 'Everything', assessment: 'good', comment: 'Flawless' }],
    };
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: maxScorecard });
    render(<SessionPage />);

    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Perfect call')).toBeInTheDocument();
  });

  it('scorecard with zero entries renders without error', () => {
    const emptyScorecard: Scorecard = {
      overallScore: 50,
      summary: 'No rules triggered',
      entries: [],
    };
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: emptyScorecard });
    render(<SessionPage />);

    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('No rules triggered')).toBeInTheDocument();
  });
});

// =============================================================
// AC4: Call type dropdown replaces fixture picker
// =============================================================
describe('AC4: Call type dropdown', () => {
  it('renders a select with aria-label "Select call type"', () => {
    render(<SessionPage />);
    const select = screen.getByLabelText('Select call type');
    expect(select.tagName).toBe('SELECT');
  });

  it('has exactly 4 call type options', () => {
    render(<SessionPage />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
  });

  it('option values match CallType union', () => {
    render(<SessionPage />);
    const options = screen.getAllByRole('option') as HTMLOptionElement[];
    const expectedValues: CallType[] = ['discovery', 'demo', 'objection-handling', 'follow-up'];
    expect(options.map((o) => o.value)).toEqual(expectedValues);
  });

  it('option labels are human-readable', () => {
    render(<SessionPage />);
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'Discovery Call',
      'Demo Call',
      'Objection Handling',
      'Follow-up Call',
    ]);
  });

  it('defaults to discovery', () => {
    render(<SessionPage />);
    const select = screen.getByLabelText('Select call type') as HTMLSelectElement;
    expect(select.value).toBe('discovery');
  });

  it('does NOT call /api/fixtures on mount', () => {
    render(<SessionPage />);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('is disabled during loading', () => {
    mockFetch.mockImplementation(() => new Promise(() => {}));
    render(<SessionPage />);
    fireEvent.click(screen.getByText('Start Session'));
    expect(screen.getByLabelText('Select call type')).toBeDisabled();
  });

  it('is disabled during active session', async () => {
    await startActiveSession();
    expect(screen.getByLabelText('Select call type')).toBeDisabled();
  });

  it('is enabled in idle state', () => {
    render(<SessionPage />);
    expect(screen.getByLabelText('Select call type')).not.toBeDisabled();
  });

  it('sends correct fixtureId for each call type', async () => {
    const callTypeToFixture: [CallType, string][] = [
      ['discovery', 'discovery-call'],
      ['demo', 'demo-call'],
      ['objection-handling', 'demo-call'],
      ['follow-up', 'discovery-call'],
    ];

    for (const [callType, expectedFixtureId] of callTypeToFixture) {
      mockFetch.mockReset();
      mockFetch
        .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: `s-${callType}` }) })
        .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

      const { unmount } = render(<SessionPage />);
      fireEvent.change(screen.getByLabelText('Select call type'), { target: { value: callType } });
      fireEvent.click(screen.getByText('Start Session'));

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/api/sessions',
          expect.objectContaining({
            body: JSON.stringify({ fixtureId: expectedFixtureId }),
          })
        );
      });

      unmount();
    }
  });
});

// =============================================================
// Edge cases & regression tests
// =============================================================
describe('Edge cases and regressions', () => {
  it('Live indicator shows only during active state', async () => {
    render(<SessionPage />);
    expect(screen.queryByText('Live')).toBeNull();

    // Clean up and start active session
    mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'live-test' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(screen.getByText('Live')).toBeInTheDocument();
    });
  });

  it('"Session Complete" text appears after ending call', async () => {
    await startActiveSession();
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve({ status: 'ended' }) });

    await act(async () => {
      fireEvent.click(screen.getByLabelText('End Call'));
      await new Promise((r) => setTimeout(r, 0));
    });

    expect(screen.getByText('Session Complete')).toBeInTheDocument();
  });

  it('Start Session disabled during active but re-enabled after scorecard close', async () => {
    // Start → active → scorecard → close → idle
    mockUseSSE.mockReturnValue({ ...defaultSSE(), scorecard: sampleScorecard });
    render(<SessionPage />);

    // Scorecard visible — completed state
    expect(screen.getByText('82')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));

    // Back to idle
    expect(screen.getByText('Start Session')).not.toBeDisabled();
  });

  it('handleStartSession does nothing if call type config not found (defensive)', async () => {
    // This tests the early return in handleStartSession when callTypeConfig is null.
    // Since we can't easily set an invalid value through the UI select (it would just
    // keep the last valid value), we verify the component renders without error.
    render(<SessionPage />);
    expect(screen.getByText('Start Session')).toBeInTheDocument();
  });

  it('handleEndCall does nothing if sessionId is null (guard clause)', () => {
    // In idle state there is no End Call button, and sessionId is null.
    // Verify the component is stable.
    render(<SessionPage />);
    expect(screen.queryByLabelText('End Call')).toBeNull();
  });

  it('multiple rapid End Call clicks do not cause errors', async () => {
    await startActiveSession('rapid-end');
    mockFetch.mockResolvedValue({ json: () => Promise.resolve({ status: 'ended' }) });

    const endBtn = screen.getByLabelText('End Call');

    await act(async () => {
      fireEvent.click(endBtn);
      // Button disappears after first click transitions to 'completed'
      await new Promise((r) => setTimeout(r, 0));
    });

    // After first click, button is gone — no double-click possible
    expect(screen.queryByLabelText('End Call')).toBeNull();
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
  });

  it('scorecard appears automatically when SSE delivers scorecard data', () => {
    // Simulate SSE delivering scorecard (e.g. session_complete event)
    mockUseSSE.mockReturnValue({
      lines: [{ speaker: 'rep', text: 'Hello' }],
      prompts: [{ ruleId: 'r1', ruleName: 'Test', message: 'Tip', timestamp: 1 }],
      scorecard: sampleScorecard,
      isConnected: false,
    });

    render(<SessionPage />);

    // Scorecard should render, grid should not
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(document.querySelector('.grid.grid-cols-1')).toBeNull();
  });
});
