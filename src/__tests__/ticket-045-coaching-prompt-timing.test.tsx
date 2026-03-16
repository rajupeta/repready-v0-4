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

  simulateOpen() {
    if (this.onopen) this.onopen();
  }

  simulateEvent(type: string, data: unknown) {
    const handlers = this.listeners[type] || [];
    handlers.forEach((h) => h({ data: JSON.stringify(data) }));
  }

  static reset() {
    MockEventSource.instances = [];
  }

  static latest(): MockEventSource {
    return MockEventSource.instances[MockEventSource.instances.length - 1];
  }
}

beforeAll(() => {
  (global as Record<string, unknown>).EventSource = MockEventSource;
});

beforeEach(() => {
  MockEventSource.reset();
});

// Test component that exposes useSSE values and applies the same filtering as session/page.tsx
function TestComponent({ sessionId }: { sessionId: string | null }) {
  const { lines, prompts } = useSSE(sessionId);

  // Same filtering logic as session/page.tsx
  const visiblePrompts = prompts.filter((p) => p.triggerLineIndex > 0 && p.triggerLineIndex <= lines.length);

  return (
    <div>
      <span data-testid="lines-count">{lines.length}</span>
      <span data-testid="all-prompts">{JSON.stringify(prompts)}</span>
      <span data-testid="visible-prompts">{JSON.stringify(visiblePrompts)}</span>
      <span data-testid="visible-count">{visiblePrompts.length}</span>
    </div>
  );
}

describe('TICKET-045: Coaching prompts appear only after triggering transcript line', () => {
  it('shows no coaching prompts before any transcript lines arrive', () => {
    render(<TestComponent sessionId="sess-1" />);

    // Send a coaching prompt with no transcript lines
    act(() => {
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        prompt: {
          ruleId: 'r1',
          ruleName: 'Filler Words',
          message: 'Avoid filler words',
          timestamp: 1000,
        },
      });
    });

    // Prompt is stored but not visible (triggerLineIndex = 0, lines.length = 0)
    expect(screen.getByTestId('lines-count')).toHaveTextContent('0');
    expect(screen.getByTestId('visible-count')).toHaveTextContent('0');
    const allPrompts = JSON.parse(screen.getByTestId('all-prompts').textContent!);
    expect(allPrompts).toHaveLength(1);
    expect(allPrompts[0].triggerLineIndex).toBe(0);
  });

  it('shows coaching prompt only after its triggering transcript line is visible', () => {
    render(<TestComponent sessionId="sess-1" />);

    // Send transcript line 1, then coaching prompt triggered by line 1
    act(() => {
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'rep', text: 'Hello there', timestamp: 1000 },
      });
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        prompt: {
          ruleId: 'r1',
          ruleName: 'Active Listening',
          message: 'Try reflecting back',
          timestamp: 1100,
        },
      });
    });

    // Line 1 is visible, prompt triggered at line 1 should be visible
    expect(screen.getByTestId('lines-count')).toHaveTextContent('1');
    expect(screen.getByTestId('visible-count')).toHaveTextContent('1');
    const visible = JSON.parse(screen.getByTestId('visible-prompts').textContent!);
    expect(visible[0].ruleName).toBe('Active Listening');
    expect(visible[0].triggerLineIndex).toBe(1);
  });

  it('delays coaching prompt visibility until triggering line is displayed', () => {
    render(<TestComponent sessionId="sess-1" />);

    // Simulate: transcript line 1 arrives, triggers a rule, but Claude responds
    // after line 2 arrives, so coaching prompt has triggerLineIndex=2
    act(() => {
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'rep', text: 'Line 1', timestamp: 1000 },
      });
    });

    // After line 1: no prompts yet
    expect(screen.getByTestId('visible-count')).toHaveTextContent('0');

    act(() => {
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'prospect', text: 'Line 2', timestamp: 2000 },
      });
      // Coaching prompt arrives after line 2
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        prompt: {
          ruleId: 'r1',
          ruleName: 'No Questions',
          message: 'Ask more questions',
          timestamp: 2100,
        },
      });
    });

    // Prompt triggered at line 2, 2 lines visible — should show
    expect(screen.getByTestId('lines-count')).toHaveTextContent('2');
    expect(screen.getByTestId('visible-count')).toHaveTextContent('1');
  });

  it('shows all prompts once transcript is complete', () => {
    render(<TestComponent sessionId="sess-1" />);

    // Send 3 lines with 2 prompts triggered at different points
    act(() => {
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'rep', text: 'Line 1', timestamp: 1000 },
      });
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        prompt: {
          ruleId: 'r1',
          ruleName: 'Filler Words',
          message: 'Avoid filler',
          timestamp: 1100,
        },
      });
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'prospect', text: 'Line 2', timestamp: 2000 },
      });
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'rep', text: 'Line 3', timestamp: 3000 },
      });
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        prompt: {
          ruleId: 'r2',
          ruleName: 'No Next Steps',
          message: 'Propose next steps',
          timestamp: 3100,
        },
      });
    });

    // All 3 lines visible, both prompts should show
    expect(screen.getByTestId('lines-count')).toHaveTextContent('3');
    expect(screen.getByTestId('visible-count')).toHaveTextContent('2');
  });

  it('tags each coaching prompt with the correct triggerLineIndex', () => {
    render(<TestComponent sessionId="sess-1" />);

    act(() => {
      // Line 1
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'rep', text: 'Line 1', timestamp: 1000 },
      });
      // Prompt triggered after line 1
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        prompt: {
          ruleId: 'r1',
          ruleName: 'Rule A',
          message: 'Message A',
          timestamp: 1100,
        },
      });
      // Lines 2 and 3
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'prospect', text: 'Line 2', timestamp: 2000 },
      });
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'rep', text: 'Line 3', timestamp: 3000 },
      });
      // Prompt triggered after line 3
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        prompt: {
          ruleId: 'r2',
          ruleName: 'Rule B',
          message: 'Message B',
          timestamp: 3100,
        },
      });
    });

    const allPrompts = JSON.parse(screen.getByTestId('all-prompts').textContent!);
    expect(allPrompts[0].triggerLineIndex).toBe(1);
    expect(allPrompts[1].triggerLineIndex).toBe(3);
  });

  it('resets triggerLineIndex tracking when session changes', () => {
    const { rerender } = render(<TestComponent sessionId="sess-1" />);

    act(() => {
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'rep', text: 'Line 1', timestamp: 1000 },
      });
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'prospect', text: 'Line 2', timestamp: 2000 },
      });
    });

    // Reset session
    rerender(<TestComponent sessionId={null} />);
    rerender(<TestComponent sessionId="sess-2" />);

    // First prompt in new session should have triggerLineIndex based on new line count
    act(() => {
      MockEventSource.latest().simulateEvent('transcript', {
        line: { speaker: 'rep', text: 'New line 1', timestamp: 5000 },
      });
      MockEventSource.latest().simulateEvent('coaching_prompt', {
        prompt: {
          ruleId: 'r1',
          ruleName: 'Rule A',
          message: 'Message A',
          timestamp: 5100,
        },
      });
    });

    const allPrompts = JSON.parse(screen.getByTestId('all-prompts').textContent!);
    expect(allPrompts).toHaveLength(1);
    // Should be 1 (first line of new session), not 3 (carried over)
    expect(allPrompts[0].triggerLineIndex).toBe(1);
  });
});
