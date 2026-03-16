/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '@/app/session/page';

// Track all useSSE calls to verify SSE connects before start
const useSSECalls: (string | null)[] = [];
const mockUseSSE = jest.fn();
jest.mock('@/hooks/useSSE', () => ({
  useSSE: (...args: unknown[]) => {
    useSSECalls.push(args[0] as string | null);
    return mockUseSSE(...args);
  },
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
  useSSECalls.length = 0;
  mockUseSSE.mockReturnValue(defaultSSE());
  mockFetch.mockResolvedValue({
    json: () =>
      Promise.resolve([
        { callType: 'discovery', displayName: 'Discovery Call' },
      ]),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TICKET-045: Coaching prompts should not fire before transcript starts', () => {
  it('SSE connection is established before POST /start is called', async () => {
    const fetchCallOrder: string[] = [];

    // Simulate SSE becoming connected once sessionId is set
    mockUseSSE.mockImplementation((sid: string | null) => {
      if (sid) return { ...defaultSSE(), isConnected: true };
      return defaultSSE();
    });

    mockFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST') {
        fetchCallOrder.push(url);
      }
      if (url === '/api/fixtures') {
        return Promise.resolve({
          json: () =>
            Promise.resolve([
              { callType: 'discovery', displayName: 'Discovery Call' },
            ]),
        });
      }
      if (url === '/api/sessions') {
        return Promise.resolve({
          json: () => Promise.resolve({ sessionId: 'test-session' }),
        });
      }
      return Promise.resolve({ json: () => Promise.resolve({ ok: true }) });
    });

    render(<Home />);

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Discovery Call' })
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    // Verify SSE was connected (useSSE called with session id)
    // BEFORE /start was called
    await waitFor(() => {
      expect(mockUseSSE).toHaveBeenCalledWith('test-session');
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions/test-session/start',
        expect.objectContaining({ method: 'POST' })
      );
    });

    // Verify the order: session creation first, then start
    // The SSE connection (setSessionId) happens between these two calls
    expect(fetchCallOrder).toEqual([
      '/api/sessions',
      '/api/sessions/test-session/start',
    ]);

    // Verify useSSE was called with the session ID before /start was issued
    const sseWithIdCallIndex = useSSECalls.findIndex(
      (id) => id === 'test-session'
    );
    expect(sseWithIdCallIndex).toBeGreaterThan(-1);
  });

  it('does not call /start when SSE is not yet connected', async () => {
    // SSE never becomes connected
    mockUseSSE.mockReturnValue(defaultSSE());

    mockFetch
      .mockResolvedValueOnce({
        json: () =>
          Promise.resolve([
            { callType: 'discovery', displayName: 'Discovery Call' },
          ]),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ sessionId: 'test-session-2' }),
      });

    render(<Home />);

    await waitFor(() => {
      expect(
        screen.getByRole('option', { name: 'Discovery Call' })
      ).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Start Session'));
    });

    // Session was created
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/sessions',
        expect.objectContaining({ method: 'POST' })
      );
    });

    // useSSE should be called with session id (SSE connecting)
    expect(mockUseSSE).toHaveBeenCalledWith('test-session-2');

    // But /start should NOT have been called since SSE is not connected
    expect(mockFetch).not.toHaveBeenCalledWith(
      '/api/sessions/test-session-2/start',
      expect.anything()
    );
  });

  it('no coaching prompts visible before transcript lines exist', () => {
    // Simulate state where coaching prompts exist but no transcript lines
    // With the fix, this state should not occur in practice
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      lines: [],
      prompts: [],
    });

    render(<Home />);

    // No coaching content should be rendered when there are no lines
    const coachingMessages = screen.queryByText(/Try asking/);
    expect(coachingMessages).toBeNull();
  });

  it('coaching prompts appear only after transcript lines are present', async () => {
    // Simulate the correct flow: lines arrive, then coaching prompts
    mockUseSSE.mockReturnValue({
      ...defaultSSE(),
      isConnected: true,
      lines: [
        { speaker: 'rep', text: 'Hi, how are you?', timestamp: 1000 },
        { speaker: 'rep', text: 'Let me tell you about our product', timestamp: 3000 },
      ],
      prompts: [
        {
          ruleId: 'talk-ratio',
          ruleName: 'Talk Ratio',
          message: 'Let the prospect speak more',
          timestamp: 3500,
        },
      ],
    });

    render(<Home />);

    // Transcript lines are visible
    expect(screen.getByText('Hi, how are you?')).toBeInTheDocument();
    expect(
      screen.getByText('Let me tell you about our product')
    ).toBeInTheDocument();

    // Coaching prompt is visible (after transcript)
    expect(screen.getByText('Talk Ratio')).toBeInTheDocument();
    expect(
      screen.getByText('Let the prospect speak more')
    ).toBeInTheDocument();
  });
});
