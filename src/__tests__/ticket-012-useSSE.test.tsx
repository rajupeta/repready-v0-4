/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSSE } from '@/hooks/useSSE';

// Mock EventSource
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

  // Test helpers
  simulateOpen() {
    if (this.onopen) this.onopen();
  }

  simulateEvent(type: string, data: unknown) {
    const handlers = this.listeners[type] || [];
    handlers.forEach((h) => h({ data: JSON.stringify(data) }));
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

// Install global mock
beforeAll(() => {
  (global as Record<string, unknown>).EventSource = MockEventSource;
});

beforeEach(() => {
  MockEventSource.reset();
});

// Test component that exposes useSSE return values
function TestComponent({ sessionId }: { sessionId: string | null }) {
  const { lines, prompts, scorecard, isConnected } = useSSE(sessionId);
  return (
    <div>
      <span data-testid="connected">{String(isConnected)}</span>
      <span data-testid="lines">{JSON.stringify(lines)}</span>
      <span data-testid="prompts">{JSON.stringify(prompts)}</span>
      <span data-testid="scorecard">{JSON.stringify(scorecard)}</span>
    </div>
  );
}

describe('useSSE hook', () => {
  it('does not create EventSource when sessionId is null', () => {
    render(<TestComponent sessionId={null} />);
    expect(MockEventSource.instances).toHaveLength(0);
    expect(screen.getByTestId('connected')).toHaveTextContent('false');
  });

  it('creates EventSource with correct URL when sessionId is provided', () => {
    render(<TestComponent sessionId="abc-123" />);
    expect(MockEventSource.instances).toHaveLength(1);
    expect(MockEventSource.latest().url).toBe('/api/sessions/abc-123/stream');
  });

  it('sets isConnected to true on EventSource open', () => {
    render(<TestComponent sessionId="abc-123" />);
    act(() => {
      MockEventSource.latest().simulateOpen();
    });
    expect(screen.getByTestId('connected')).toHaveTextContent('true');
  });

  it('appends transcript lines on transcript event', () => {
    render(<TestComponent sessionId="abc-123" />);
    act(() => {
      MockEventSource.latest().simulateEvent('transcript', {
        speaker: 'rep',
        text: 'Hello',
        timestamp: 1000,
      });
    });
    const lines = JSON.parse(screen.getByTestId('lines').textContent!);
    expect(lines).toHaveLength(1);
    expect(lines[0].text).toBe('Hello');
  });

  it('appends coaching prompts on coaching_prompt event', () => {
    render(<TestComponent sessionId="abc-123" />);
    act(() => {
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        ruleId: 'r1',
        ruleName: 'Active Listening',
        message: 'Reflect back',
        timestamp: 1000,
      });
    });
    const prompts = JSON.parse(screen.getByTestId('prompts').textContent!);
    expect(prompts).toHaveLength(1);
    expect(prompts[0].ruleName).toBe('Active Listening');
  });

  it('sets scorecard on session_complete event', () => {
    render(<TestComponent sessionId="abc-123" />);
    const scorecardData = {
      overallScore: 75,
      summary: 'Good job',
      entries: [],
    };
    act(() => {
      MockEventSource.latest().simulateEvent('session_complete', scorecardData);
    });
    const scorecard = JSON.parse(screen.getByTestId('scorecard').textContent!);
    expect(scorecard.overallScore).toBe(75);
  });

  it('sets isConnected to false on error', () => {
    render(<TestComponent sessionId="abc-123" />);
    act(() => {
      MockEventSource.latest().simulateOpen();
    });
    expect(screen.getByTestId('connected')).toHaveTextContent('true');
    act(() => {
      MockEventSource.latest().simulateError();
    });
    expect(screen.getByTestId('connected')).toHaveTextContent('false');
  });

  it('closes EventSource on unmount', () => {
    const { unmount } = render(<TestComponent sessionId="abc-123" />);
    const es = MockEventSource.latest();
    expect(es.closed).toBe(false);
    unmount();
    expect(es.closed).toBe(true);
  });

  it('closes old EventSource when sessionId changes', () => {
    const { rerender } = render(<TestComponent sessionId="session-1" />);
    const firstEs = MockEventSource.latest();
    expect(firstEs.closed).toBe(false);

    rerender(<TestComponent sessionId="session-2" />);
    expect(firstEs.closed).toBe(true);
    expect(MockEventSource.latest().url).toBe('/api/sessions/session-2/stream');
  });

  it('resets state when sessionId becomes null', () => {
    const { rerender } = render(<TestComponent sessionId="abc-123" />);
    act(() => {
      MockEventSource.latest().simulateEvent('transcript', {
        speaker: 'rep',
        text: 'Hello',
        timestamp: 1000,
      });
    });
    expect(JSON.parse(screen.getByTestId('lines').textContent!)).toHaveLength(1);

    rerender(<TestComponent sessionId={null} />);
    expect(JSON.parse(screen.getByTestId('lines').textContent!)).toHaveLength(0);
    expect(JSON.parse(screen.getByTestId('prompts').textContent!)).toHaveLength(0);
    expect(screen.getByTestId('scorecard')).toHaveTextContent('null');
  });

  it('handles heartbeat event without error', () => {
    render(<TestComponent sessionId="abc-123" />);
    // Should not throw
    act(() => {
      MockEventSource.latest().simulateEvent('heartbeat', {});
    });
    // State should be unchanged
    expect(JSON.parse(screen.getByTestId('lines').textContent!)).toHaveLength(0);
  });

  it('accumulates multiple transcript lines', () => {
    render(<TestComponent sessionId="abc-123" />);
    act(() => {
      MockEventSource.latest().simulateEvent('transcript', {
        speaker: 'rep',
        text: 'Line 1',
        timestamp: 1000,
      });
      MockEventSource.latest().simulateEvent('transcript', {
        speaker: 'prospect',
        text: 'Line 2',
        timestamp: 2000,
      });
      MockEventSource.latest().simulateEvent('transcript', {
        speaker: 'rep',
        text: 'Line 3',
        timestamp: 3000,
      });
    });
    const lines = JSON.parse(screen.getByTestId('lines').textContent!);
    expect(lines).toHaveLength(3);
    expect(lines[0].text).toBe('Line 1');
    expect(lines[2].text).toBe('Line 3');
  });
});
