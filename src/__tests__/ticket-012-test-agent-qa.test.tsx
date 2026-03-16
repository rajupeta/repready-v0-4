/**
 * @jest-environment jsdom
 */
/**
 * TICKET-012 — Test Agent QA validation
 *
 * Final acceptance-criteria gate tests for Main page + useSSE hook.
 * Each test maps to a specific AC from the ticket description.
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '@/app/page';
import { useSSE } from '@/hooks/useSSE';

// ---------- Mock useSSE ----------
const mockUseSSE = jest.fn();
jest.mock('@/hooks/useSSE', () => ({
  useSSE: (...args: unknown[]) => mockUseSSE(...args),
}));

// ---------- Mock fetch ----------
const mockFetch = jest.fn();
global.fetch = mockFetch;

function defaultSSE() {
  return { lines: [], prompts: [], scorecard: null, isConnected: false };
}

// ---------- MockEventSource for hook-level tests ----------
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

// =============================================================
// SECTION A — useSSE hook acceptance tests
// =============================================================
function HookHarness({ sessionId }: { sessionId: string | null }) {
  const result = (jest.requireActual('@/hooks/useSSE') as { useSSE: typeof useSSE }).useSSE(sessionId);
  return (
    <div>
      <span data-testid="conn">{String(result.isConnected)}</span>
      <span data-testid="ln">{JSON.stringify(result.lines)}</span>
      <span data-testid="pr">{JSON.stringify(result.prompts)}</span>
      <span data-testid="sc">{JSON.stringify(result.scorecard)}</span>
    </div>
  );
}

describe('useSSE hook — test-agent acceptance', () => {
  beforeAll(() => {
    (global as Record<string, unknown>).EventSource = MockEventSource;
  });
  beforeEach(() => MockEventSource.reset());

  it('AC: returns { lines: [], prompts: [], scorecard: null, isConnected: false } for null sessionId', () => {
    render(<HookHarness sessionId={null} />);
    expect(screen.getByTestId('conn')).toHaveTextContent('false');
    expect(screen.getByTestId('ln')).toHaveTextContent('[]');
    expect(screen.getByTestId('pr')).toHaveTextContent('[]');
    expect(screen.getByTestId('sc')).toHaveTextContent('null');
    expect(MockEventSource.instances).toHaveLength(0);
  });

  it('AC: creates EventSource to /api/sessions/${sessionId}/stream', () => {
    render(<HookHarness sessionId="qa-session" />);
    expect(MockEventSource.latest().url).toBe('/api/sessions/qa-session/stream');
  });

  it('AC: transcript event appends to lines array', () => {
    render(<HookHarness sessionId="s" />);
    act(() => {
      MockEventSource.latest().simulateEvent('transcript', { speaker: 'rep', text: 'Hey', timestamp: 10 });
    });
    const lines = JSON.parse(screen.getByTestId('ln').textContent!);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toEqual({ speaker: 'rep', text: 'Hey', timestamp: 10 });
  });

  it('AC: coaching_prompt event appends to prompts array', () => {
    render(<HookHarness sessionId="s" />);
    act(() => {
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        ruleId: 'qa-r1', ruleName: 'Test Rule', message: 'Do X', timestamp: 5,
      });
    });
    const prompts = JSON.parse(screen.getByTestId('pr').textContent!);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].ruleId).toBe('qa-r1');
  });

  it('AC: session_complete event sets scorecard', () => {
    render(<HookHarness sessionId="s" />);
    const sc = { overallScore: 95, summary: 'Perfect', entries: [] };
    act(() => {
      MockEventSource.latest().simulateEvent('session_complete', sc);
    });
    expect(JSON.parse(screen.getByTestId('sc').textContent!)).toEqual(sc);
  });

  it('AC: heartbeat is no-op — no state mutation', () => {
    render(<HookHarness sessionId="s" />);
    act(() => MockEventSource.latest().simulateEvent('heartbeat', {}));
    expect(JSON.parse(screen.getByTestId('ln').textContent!)).toEqual([]);
    expect(JSON.parse(screen.getByTestId('pr').textContent!)).toEqual([]);
    expect(screen.getByTestId('sc')).toHaveTextContent('null');
  });

  it('AC: closes EventSource on unmount (cleanup)', () => {
    const { unmount } = render(<HookHarness sessionId="s" />);
    const es = MockEventSource.latest();
    expect(es.closed).toBe(false);
    unmount();
    expect(es.closed).toBe(true);
  });

  it('AC: closes old EventSource and opens new one on sessionId change', () => {
    const { rerender } = render(<HookHarness sessionId="a" />);
    const first = MockEventSource.latest();
    rerender(<HookHarness sessionId="b" />);
    expect(first.closed).toBe(true);
    expect(MockEventSource.latest().url).toBe('/api/sessions/b/stream');
  });

  it('AC: sets isConnected false on onerror', () => {
    render(<HookHarness sessionId="s" />);
    act(() => MockEventSource.latest().simulateOpen());
    expect(screen.getByTestId('conn')).toHaveTextContent('true');
    act(() => MockEventSource.latest().simulateError());
    expect(screen.getByTestId('conn')).toHaveTextContent('false');
  });
});

// =============================================================
// SECTION B — Main page (Home) acceptance tests
// =============================================================
describe('Main page — test-agent acceptance', () => {
  beforeEach(() => {
    mockUseSSE.mockReturnValue(defaultSSE());
    mockFetch.mockResolvedValue({
      json: () => Promise.resolve({ sessionId: 'session-1' }),
    });
  });
  afterEach(() => jest.restoreAllMocks());

  // AC 1: call type dropdown
  it('AC1: renders call type dropdown with all four options', () => {
    render(<Home />);
    const opts = screen.getAllByRole('option');
    expect(opts).toHaveLength(4);
    expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Demo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Objection Handling' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Follow-up' })).toBeInTheDocument();
  });

  // AC 2: Start Session creates and starts session
  it('AC2: Start Session POSTs to /api/sessions with callType then /api/sessions/:id/start', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'qa-sess' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({ ok: true }) });

    render(<Home />);

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ callType: 'discovery' }),
      }));
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions/qa-sess/start', { method: 'POST' });
    });
    expect(mockUseSSE).toHaveBeenCalledWith('qa-sess');
  });

  // AC 3: SSE hook connects
  it('AC3: useSSE called with null initially, then sessionId after session start', async () => {
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 'id1' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({}) });

    render(<Home />);
    expect(mockUseSSE).toHaveBeenCalledWith(null);

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    await waitFor(() => expect(mockUseSSE).toHaveBeenCalledWith('id1'));
  });

  // AC 4: TranscriptPanel updates with streaming lines
  it('AC4: transcript lines render in TranscriptPanel with speaker badges', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      lines: [
        { speaker: 'rep', text: 'Good morning!', timestamp: 1 },
        { speaker: 'prospect', text: 'Hi there', timestamp: 2 },
      ],
    });
    render(<Home />);
    expect(screen.getByText('Good morning!')).toBeInTheDocument();
    expect(screen.getByText('Hi there')).toBeInTheDocument();
    expect(screen.getByText('Rep')).toBeInTheDocument();
    expect(screen.getByText('Prospect')).toBeInTheDocument();
  });

  it('AC4: empty lines shows waiting message', () => {
    render(<Home />);
    expect(screen.getByText('Waiting for call to start...')).toBeInTheDocument();
  });

  // AC 5: CoachingPanel shows prompts
  it('AC5: coaching prompts render with rule name and message', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      prompts: [
        { ruleId: 'r1', ruleName: 'Empathy Check', message: 'Acknowledge their concern', timestamp: 1 },
      ],
    });
    render(<Home />);
    expect(screen.getByText('Empathy Check')).toBeInTheDocument();
    expect(screen.getByText('Acknowledge their concern')).toBeInTheDocument();
  });

  it('AC5: no prompts shows placeholder text', () => {
    render(<Home />);
    expect(screen.getByText('No coaching prompts yet')).toBeInTheDocument();
  });

  // AC 6: ScorecardView overlay on session_complete
  it('AC6: scorecard renders as fixed overlay with backdrop', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: {
        overallScore: 78,
        summary: 'Good session',
        entries: [
          { ruleId: 'r1', ruleName: 'Discovery', assessment: 'good', comment: 'Well done' },
          { ruleId: 'r2', ruleName: 'Closing', assessment: 'needs-work', comment: 'Need improvement' },
        ],
      },
    });
    render(<Home />);

    // Overlay structure
    const overlay = document.querySelector('.fixed.inset-0.z-50');
    expect(overlay).not.toBeNull();
    expect(overlay!.className).toContain('bg-black/50');

    // Score content
    expect(screen.getByText('78')).toBeInTheDocument();
    expect(screen.getByText('Good session')).toBeInTheDocument();
    expect(screen.getByText('Discovery')).toBeInTheDocument();
    expect(screen.getByText('good')).toBeInTheDocument();
    expect(screen.getByText('Closing')).toBeInTheDocument();
    expect(screen.getByText('needs-work')).toBeInTheDocument();
  });

  it('AC6: Close button dismisses scorecard overlay', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: { overallScore: 50, summary: 'OK', entries: [] },
    });
    render(<Home />);
    expect(document.querySelector('.fixed.inset-0.z-50')).not.toBeNull();
    fireEvent.click(screen.getByText('Close'));
    expect(document.querySelector('.fixed.inset-0.z-50')).toBeNull();
  });

  // AC 7: useSSE cleanup on unmount (tested in hook section above)

  // AC 8: Responsive layout
  it('AC8: uses grid-cols-1 and md:grid-cols-2 for responsive two-column layout', () => {
    render(<Home />);
    const grid = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2');
    expect(grid).not.toBeNull();
  });

  it('AC8: controls use flex-col on mobile and sm:flex-row on desktop', () => {
    render(<Home />);
    const controls = document.querySelector('.flex.flex-col.sm\\:flex-row');
    expect(controls).not.toBeNull();
  });

  // ---------- Additional edge-case coverage ----------
  it('header has RepReady title (h1) and AI Sales Coaching subtitle', () => {
    render(<Home />);
    expect(screen.getByText('RepReady').tagName).toBe('H1');
    expect(screen.getByText('AI Sales Coaching').tagName).toBe('P');
    expect(document.querySelector('header')).toBeTruthy();
  });

  it('session creation failure resets to idle — button re-enabled', async () => {
    mockFetch.mockRejectedValueOnce(new Error('500'));

    render(<Home />);

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    await waitFor(() => {
      expect(screen.getByText('Start Session')).not.toBeDisabled();
    });
  });

  it('button text changes to "Starting..." during loading', async () => {
    mockFetch.mockImplementationOnce(() => new Promise(() => {}));

    render(<Home />);

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    expect(screen.getByText('Starting...')).toBeInTheDocument();
  });

  it('dropdown is disabled during active session', async () => {
    mockUseSSE.mockReturnValue({ ...defaultSSE(), isConnected: true });
    mockFetch
      .mockResolvedValueOnce({ json: () => Promise.resolve({ sessionId: 's' }) })
      .mockResolvedValueOnce({ json: () => Promise.resolve({}) });

    render(<Home />);

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Select call type')).toBeDisabled();
    });
  });

  it('renders "Session Complete" when scorecard arrives', () => {
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      scorecard: { overallScore: 60, summary: 'OK', entries: [] },
    });
    render(<Home />);
    expect(screen.getByText('Session Complete')).toBeInTheDocument();
  });

  it('renders both TranscriptPanel and CoachingPanel in the grid', () => {
    render(<Home />);
    expect(screen.getByText('Transcript')).toBeInTheDocument();
    expect(screen.getByText('Coaching')).toBeInTheDocument();
  });
});
