/**
 * @jest-environment jsdom
 */
/**
 * TICKET-012 QA Validation — Test Agent
 *
 * Validates all acceptance criteria for the Main page with SSE client integration:
 * 1. Page loads with fixture dropdown populated from /api/fixtures
 * 2. Start Session button creates and starts a session
 * 3. SSE hook connects and receives real-time events
 * 4. TranscriptPanel updates with new lines as they stream
 * 5. CoachingPanel shows prompts when triggered
 * 6. ScorecardView appears as overlay when session completes
 * 7. useSSE hook cleans up EventSource on unmount
 * 8. Layout is responsive with Tailwind (stacked mobile, two-column desktop)
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '@/app/session/page';
import { useSSE } from '@/hooks/useSSE';

// ----- Mock useSSE -----
const mockUseSSE = jest.fn();
jest.mock('@/hooks/useSSE', () => ({
  useSSE: (...args: unknown[]) => mockUseSSE(...args),
}));

// ----- Mock fetch -----
const mockFetch = jest.fn();
global.fetch = mockFetch;

function defaultSSE() {
  return { lines: [], prompts: [], scorecard: null, isConnected: false };
}

// ----- Mock EventSource for hook-level tests -----
class MockEventSource {
  static instances: MockEventSource[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  listeners: Record<string, ((event: { data: string }) => void)[]> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: (event: { data: string }) => void) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
  }

  close() {
    this.closed = true;
  }

  simulateOpen() {
    if (this.onopen) this.onopen();
  }

  simulateEvent(type: string, data: unknown) {
    (this.listeners[type] || []).forEach((h) => h({ data: JSON.stringify(data) }));
  }

  simulateError() {
    if (this.onerror) this.onerror();
  }

  static reset() {
    MockEventSource.instances = [];
  }

  static latest(): MockEventSource {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

// =====================================================================
// SECTION 1: useSSE hook direct tests
// =====================================================================

function SSETestHarness({ sessionId }: { sessionId: string | null }) {
  const result = (jest.requireActual('@/hooks/useSSE') as { useSSE: typeof useSSE }).useSSE(sessionId);
  return (
    <div>
      <span data-testid="h-connected">{String(result.isConnected)}</span>
      <span data-testid="h-lines">{JSON.stringify(result.lines)}</span>
      <span data-testid="h-prompts">{JSON.stringify(result.prompts)}</span>
      <span data-testid="h-scorecard">{JSON.stringify(result.scorecard)}</span>
    </div>
  );
}

describe('useSSE hook — QA validation', () => {
  beforeAll(() => {
    (global as Record<string, unknown>).EventSource = MockEventSource;
  });
  beforeEach(() => MockEventSource.reset());

  it('returns correct initial state when sessionId is null', () => {
    render(<SSETestHarness sessionId={null} />);
    expect(screen.getByTestId('h-connected')).toHaveTextContent('false');
    expect(screen.getByTestId('h-lines')).toHaveTextContent('[]');
    expect(screen.getByTestId('h-prompts')).toHaveTextContent('[]');
    expect(screen.getByTestId('h-scorecard')).toHaveTextContent('null');
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('connects to correct SSE endpoint', () => {
    render(<SSETestHarness sessionId="test-session-42" />);
    expect(MockEventSource.latest().url).toBe('/api/sessions/test-session-42/stream');
  });

  it('handles transcript events and accumulates lines in order', () => {
    render(<SSETestHarness sessionId="s1" />);
    act(() => {
      MockEventSource.latest().simulateEvent('transcript', { line: { speaker: 'rep', text: 'Hi', timestamp: 100 } });
      MockEventSource.latest().simulateEvent('transcript', { line: { speaker: 'prospect', text: 'Hello', timestamp: 200 } });
    });
    const lines = JSON.parse(screen.getByTestId('h-lines').textContent!);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatchObject({ speaker: 'rep', text: 'Hi' });
    expect(lines[1]).toMatchObject({ speaker: 'prospect', text: 'Hello' });
  });

  it('handles coaching_prompt events and accumulates prompts', () => {
    render(<SSETestHarness sessionId="s1" />);
    act(() => {
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        prompt: { ruleId: 'r1', ruleName: 'Empathy', message: 'Show empathy', timestamp: 1 },
      });
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        prompt: { ruleId: 'r2', ruleName: 'Open Qs', message: 'Ask open', timestamp: 2 },
      });
    });
    const prompts = JSON.parse(screen.getByTestId('h-prompts').textContent!);
    expect(prompts).toHaveLength(2);
    expect(prompts[0].ruleName).toBe('Empathy');
    expect(prompts[1].ruleName).toBe('Open Qs');
  });

  it('handles session_complete event and sets scorecard', () => {
    render(<SSETestHarness sessionId="s1" />);
    const sc = { overallScore: 88, summary: 'Great', entries: [] };
    act(() => {
      MockEventSource.latest().simulateEvent('session_complete', { scorecard: sc });
    });
    const scorecard = JSON.parse(screen.getByTestId('h-scorecard').textContent!);
    expect(scorecard.overallScore).toBe(88);
    expect(scorecard.summary).toBe('Great');
  });

  it('heartbeat event is a no-op — state unchanged', () => {
    render(<SSETestHarness sessionId="s1" />);
    act(() => MockEventSource.latest().simulateEvent('heartbeat', {}));
    expect(JSON.parse(screen.getByTestId('h-lines').textContent!)).toHaveLength(0);
    expect(JSON.parse(screen.getByTestId('h-prompts').textContent!)).toHaveLength(0);
    expect(screen.getByTestId('h-scorecard')).toHaveTextContent('null');
  });

  it('sets isConnected false on error after being connected', () => {
    render(<SSETestHarness sessionId="s1" />);
    act(() => MockEventSource.latest().simulateOpen());
    expect(screen.getByTestId('h-connected')).toHaveTextContent('true');
    act(() => MockEventSource.latest().simulateError());
    expect(screen.getByTestId('h-connected')).toHaveTextContent('false');
  });

  it('cleans up EventSource on unmount', () => {
    const { unmount } = render(<SSETestHarness sessionId="s1" />);
    const es = MockEventSource.latest();
    expect(es.closed).toBe(false);
    unmount();
    expect(es.closed).toBe(true);
  });

  it('closes old connection and opens new one on sessionId change', () => {
    const { rerender } = render(<SSETestHarness sessionId="s1" />);
    const first = MockEventSource.latest();
    rerender(<SSETestHarness sessionId="s2" />);
    expect(first.closed).toBe(true);
    expect(MockEventSource.latest().url).toBe('/api/sessions/s2/stream');
  });

  it('resets all state when sessionId becomes null', () => {
    const { rerender } = render(<SSETestHarness sessionId="s1" />);
    act(() => {
      MockEventSource.latest().simulateEvent('transcript', { line: { speaker: 'rep', text: 'X', timestamp: 1 } });
      MockEventSource.latest().simulateEvent('coaching_prompt', { prompt: { ruleId: 'r', ruleName: 'R', message: 'M', timestamp: 1 } });
    });
    expect(JSON.parse(screen.getByTestId('h-lines').textContent!)).toHaveLength(1);

    rerender(<SSETestHarness sessionId={null} />);
    expect(JSON.parse(screen.getByTestId('h-lines').textContent!)).toHaveLength(0);
    expect(JSON.parse(screen.getByTestId('h-prompts').textContent!)).toHaveLength(0);
    expect(screen.getByTestId('h-scorecard')).toHaveTextContent('null');
  });
});

// =====================================================================
// SECTION 2: Main page (Home) integration tests
// =====================================================================

describe('Main page — QA validation', () => {
  beforeEach(() => {
    mockUseSSE.mockReturnValue(defaultSSE());
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve(['discovery-call-001', 'objection-handling']),
    });
  });

  afterEach(() => jest.restoreAllMocks());

  // --- AC 1: Page loads with fixture dropdown populated from /api/fixtures ---
  it('AC1: fetches /api/fixtures on mount and renders options in dropdown', async () => {
    render(<Home />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith('/api/fixtures'));
    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('discovery-call-001');
      expect(options[1]).toHaveTextContent('objection-handling');
    });
  });

  it('AC1: auto-selects first fixture', async () => {
    render(<Home />);
    await waitFor(() => {
      const select = screen.getByLabelText('Select fixture') as HTMLSelectElement;
      expect(select.value).toBe('discovery-call-001');
    });
  });

  // --- AC 2: Start Session button creates and starts a session ---
  it('AC2: clicking Start Session calls POST /api/sessions then POST /api/sessions/:id/start', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve(['discovery-call-001']) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sess-99' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<Home />);
    await waitFor(() => expect(screen.getByRole('option')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Start Session'));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ fixtureId: 'discovery-call-001' }),
      }));
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/sess-99/start', { method: 'POST' });
    });

    expect(mockUseSSE).toHaveBeenCalledWith('sess-99');
  });

  // --- AC 3: SSE hook connects and receives real-time events ---
  it('AC3: useSSE is called with null initially, then sessionId after start', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve(['fix1']) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'sid' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({}) });

    render(<Home />);
    expect(mockUseSSE).toHaveBeenCalledWith(null);

    await waitFor(() => expect(screen.getByRole('option')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Start Session'));
    await waitFor(() => expect(mockUseSSE).toHaveBeenCalledWith('sid'));
  });

  // --- AC 4: TranscriptPanel updates with new lines ---
  it('AC4: transcript lines from useSSE render in TranscriptPanel', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      lines: [
        { speaker: 'rep', text: 'Good morning!', timestamp: 1 },
        { speaker: 'prospect', text: 'Morning, how are you?', timestamp: 2 },
      ],
    });
    render(<Home />);
    expect(screen.getByText('Good morning!')).toBeInTheDocument();
    expect(screen.getByText('Morning, how are you?')).toBeInTheDocument();
  });

  it('AC4: empty transcript shows waiting message', () => {
    render(<Home />);
    expect(screen.getByText('Waiting for call to start...')).toBeInTheDocument();
  });

  // --- AC 5: CoachingPanel shows prompts ---
  it('AC5: coaching prompts from useSSE render in CoachingPanel', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      prompts: [
        { ruleId: 'r1', ruleName: 'Active Listening', message: 'Try reflecting back', timestamp: 1 },
      ],
    });
    render(<Home />);
    expect(screen.getByText('Active Listening')).toBeInTheDocument();
    expect(screen.getByText('Try reflecting back')).toBeInTheDocument();
  });

  it('AC5: empty prompts shows no-prompts message', () => {
    render(<Home />);
    expect(screen.getByText('No coaching prompts yet')).toBeInTheDocument();
  });

  // --- AC 6: ScorecardView appears as overlay when session completes ---
  it('AC6: scorecard overlay appears with correct data', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: {
        overallScore: 72,
        summary: 'Solid performance',
        entries: [
          { ruleId: 'r1', ruleName: 'Empathy', assessment: 'good', comment: 'Well done' },
          { ruleId: 'r2', ruleName: 'Discovery', assessment: 'needs-work', comment: 'Ask more questions' },
        ],
      },
    });
    render(<Home />);

    // Overlay structure
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    expect(overlay).not.toBeNull();
    expect(overlay!.className).toContain('bg-black/50');

    // Score and summary
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('Solid performance')).toBeInTheDocument();

    // Entries
    expect(screen.getByText('Empathy')).toBeInTheDocument();
    expect(screen.getByText('good')).toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('needs-work')).toBeInTheDocument();
  });

  it('AC6: Close button hides the scorecard overlay', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: { overallScore: 50, summary: 'OK', entries: [] },
    });
    render(<Home />);
    expect(screen.getByText('50')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Close'));
    expect(screen.queryByText('50')).not.toBeInTheDocument();
  });

  // --- AC 7: useSSE hook cleans up EventSource on unmount (tested in hook section above) ---

  // --- AC 8: Layout is responsive with Tailwind ---
  it('AC8: responsive grid uses grid-cols-1 on mobile and md:grid-cols-2 on desktop', () => {
    render(<Home />);
    const grid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
    expect(grid).toBeTruthy();
  });

  it('AC8: controls stack vertically on mobile via flex-col, side-by-side on sm via sm:flex-row', () => {
    render(<Home />);
    const controls = document.querySelector('.flex.flex-col.sm\\:flex-row');
    expect(controls).toBeTruthy();
  });

  // --- Additional edge-case coverage ---
  it('header renders with correct styling', () => {
    render(<Home />);
    const header = document.querySelector('header');
    expect(header).toBeTruthy();
    expect(screen.getByText('RepReady').tagName).toBe('H1');
    expect(screen.getByText('AI Sales Coaching').tagName).toBe('P');
  });

  it('fixture fetch failure does not crash page', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network down'));
    render(<Home />);
    expect(screen.getByText('RepReady')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryAllByRole('option')).toHaveLength(0));
  });

  it('session creation failure resets to idle', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve(['fix1']) })
      .mockRejectedValueOnce(new Error('500'));

    render(<Home />);
    await waitFor(() => expect(screen.getByRole('option')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Start Session'));
    await waitFor(() => {
      expect(screen.getByText('Start Session')).not.toBeDisabled();
    });
  });

  it('button shows "Starting..." during loading state', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve(['fix1']) })
      .mockImplementationOnce(() => new Promise(() => {})); // never resolves

    render(<Home />);
    await waitFor(() => expect(screen.getByRole('option')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Start Session'));
    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });

  it('dropdown and button are disabled during active session', async () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve(['fix1']) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({}) });

    render(<Home />);
    await waitFor(() => expect(screen.getByRole('option')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Start Session'));
    await waitFor(() => {
      expect(screen.getByLabelText('Select fixture')).toBeDisabled();
    });
  });

  it('"Session Complete" text renders when scorecard arrives', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: { overallScore: 60, summary: 'OK', entries: [] },
    });
    render(<Home />);
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
  });

  it('Start Session disabled when fixture list is empty', async () => {
    mockFetch.mockResolvedValueOnce({ json: () => Promise.resolve([]) });
    render(<Home />);
    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    expect(screen.getByText('Start Session')).toBeDisabled();
  });
});
