/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSSE } from '@/hooks/useSSE';

// Mock EventSource matching the server's SSE data shapes
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

describe('TICKET-033: SSE data shape destructuring', () => {
  describe('transcript events use { line } wrapper', () => {
    it('destructures { line } from transcript event data', () => {
      render(<TestComponent sessionId="test-session" />);
      act(() => {
        // Server emits: { type: 'transcript', data: { line: { speaker, text, timestamp } } }
        MockEventSource.latest().simulateEvent('transcript', {
          line: { speaker: 'rep', text: 'Hi, thanks for taking the call.', timestamp: 1000 },
        });
      });
      const lines = JSON.parse(screen.getByTestId('lines').textContent!);
      expect(lines).toHaveLength(1);
      expect(lines[0]).toEqual({
        speaker: 'rep',
        text: 'Hi, thanks for taking the call.',
        timestamp: 1000,
      });
    });

    it('renders rep speaker correctly', () => {
      render(<TestComponent sessionId="test-session" />);
      act(() => {
        MockEventSource.latest().simulateEvent('transcript', {
          line: { speaker: 'rep', text: 'How can I help?', timestamp: 1000 },
        });
      });
      const lines = JSON.parse(screen.getByTestId('lines').textContent!);
      expect(lines[0].speaker).toBe('rep');
      expect(lines[0].text).toBe('How can I help?');
    });

    it('renders prospect speaker correctly', () => {
      render(<TestComponent sessionId="test-session" />);
      act(() => {
        MockEventSource.latest().simulateEvent('transcript', {
          line: { speaker: 'prospect', text: 'Tell me about pricing.', timestamp: 2000 },
        });
      });
      const lines = JSON.parse(screen.getByTestId('lines').textContent!);
      expect(lines[0].speaker).toBe('prospect');
      expect(lines[0].text).toBe('Tell me about pricing.');
    });

    it('dialogue text is visible (not undefined/empty)', () => {
      render(<TestComponent sessionId="test-session" />);
      act(() => {
        MockEventSource.latest().simulateEvent('transcript', {
          line: { speaker: 'rep', text: 'Let me walk you through that.', timestamp: 3000 },
        });
      });
      const lines = JSON.parse(screen.getByTestId('lines').textContent!);
      expect(lines[0].text).toBeDefined();
      expect(lines[0].text).not.toBe('');
      expect(lines[0].text).toBe('Let me walk you through that.');
    });

    it('accumulates lines from both speakers in order', () => {
      render(<TestComponent sessionId="test-session" />);
      act(() => {
        MockEventSource.latest().simulateEvent('transcript', {
          line: { speaker: 'rep', text: 'Good morning!', timestamp: 1000 },
        });
        MockEventSource.latest().simulateEvent('transcript', {
          line: { speaker: 'prospect', text: 'Morning, what do you have?', timestamp: 2000 },
        });
        MockEventSource.latest().simulateEvent('transcript', {
          line: { speaker: 'rep', text: 'Let me show you our platform.', timestamp: 3000 },
        });
      });
      const lines = JSON.parse(screen.getByTestId('lines').textContent!);
      expect(lines).toHaveLength(3);
      expect(lines[0].speaker).toBe('rep');
      expect(lines[1].speaker).toBe('prospect');
      expect(lines[2].speaker).toBe('rep');
      expect(lines[0].text).toBe('Good morning!');
      expect(lines[1].text).toBe('Morning, what do you have?');
      expect(lines[2].text).toBe('Let me show you our platform.');
    });
  });

  describe('coaching_prompt events use { prompt } wrapper', () => {
    it('destructures { prompt } from coaching_prompt event data', () => {
      render(<TestComponent sessionId="test-session" />);
      act(() => {
        // Server emits: { type: 'coaching_prompt', data: { prompt: { ruleId, ruleName, message, timestamp } } }
        MockEventSource.latest().simulateEvent('coaching_prompt', {
          prompt: {
            ruleId: 'no-questions',
            ruleName: 'No Discovery Questions',
            message: 'Try asking an open-ended question.',
            timestamp: 5000,
          },
        });
      });
      const prompts = JSON.parse(screen.getByTestId('prompts').textContent!);
      expect(prompts).toHaveLength(1);
      expect(prompts[0]).toEqual({
        ruleId: 'no-questions',
        ruleName: 'No Discovery Questions',
        message: 'Try asking an open-ended question.',
        timestamp: 5000,
      });
    });

    it('renders coaching prompt text when triggered', () => {
      render(<TestComponent sessionId="test-session" />);
      act(() => {
        MockEventSource.latest().simulateEvent('coaching_prompt', {
          prompt: {
            ruleId: 'filler-words',
            ruleName: 'Filler Words Detected',
            message: 'Reduce filler words to sound more confident.',
            timestamp: 6000,
          },
        });
      });
      const prompts = JSON.parse(screen.getByTestId('prompts').textContent!);
      expect(prompts[0].message).toBe('Reduce filler words to sound more confident.');
      expect(prompts[0].ruleName).toBe('Filler Words Detected');
    });

    it('accumulates multiple coaching prompts', () => {
      render(<TestComponent sessionId="test-session" />);
      act(() => {
        MockEventSource.latest().simulateEvent('coaching_prompt', {
          prompt: {
            ruleId: 'no-questions',
            ruleName: 'No Discovery Questions',
            message: 'Ask a discovery question.',
            timestamp: 5000,
          },
        });
        MockEventSource.latest().simulateEvent('coaching_prompt', {
          prompt: {
            ruleId: 'long-monologue',
            ruleName: 'Long Monologue',
            message: 'Pause and check in with the prospect.',
            timestamp: 8000,
          },
        });
      });
      const prompts = JSON.parse(screen.getByTestId('prompts').textContent!);
      expect(prompts).toHaveLength(2);
      expect(prompts[0].ruleId).toBe('no-questions');
      expect(prompts[1].ruleId).toBe('long-monologue');
    });
  });

  describe('session_complete events use { scorecard } wrapper', () => {
    it('destructures { scorecard } from session_complete event data', () => {
      render(<TestComponent sessionId="test-session" />);
      act(() => {
        // Server emits: { type: 'session_complete', data: { scorecard: { entries, overallScore, summary } } }
        MockEventSource.latest().simulateEvent('session_complete', {
          scorecard: {
            overallScore: 82,
            summary: 'Strong discovery call with room for improvement.',
            entries: [
              {
                ruleId: 'no-questions',
                ruleName: 'No Discovery Questions',
                assessment: 'good',
                comment: 'Asked several open-ended questions.',
              },
            ],
          },
        });
      });
      const scorecard = JSON.parse(screen.getByTestId('scorecard').textContent!);
      expect(scorecard.overallScore).toBe(82);
      expect(scorecard.summary).toBe('Strong discovery call with room for improvement.');
      expect(scorecard.entries).toHaveLength(1);
      expect(scorecard.entries[0].assessment).toBe('good');
    });
  });

  describe('mixed event flow matches server data shapes', () => {
    it('handles a full session flow with correct data shapes', () => {
      render(<TestComponent sessionId="test-session" />);
      const es = MockEventSource.latest();

      act(() => {
        es.simulateOpen();
      });
      expect(screen.getByTestId('connected')).toHaveTextContent('true');

      // Transcript lines
      act(() => {
        es.simulateEvent('transcript', {
          line: { speaker: 'rep', text: 'Welcome, glad to connect.', timestamp: 1000 },
        });
        es.simulateEvent('transcript', {
          line: { speaker: 'prospect', text: 'Thanks, I have some questions.', timestamp: 2000 },
        });
      });

      // Coaching prompt
      act(() => {
        es.simulateEvent('coaching_prompt', {
          prompt: {
            ruleId: 'long-monologue',
            ruleName: 'Long Monologue',
            message: 'Let the prospect speak more.',
            timestamp: 3000,
          },
        });
      });

      // More transcript
      act(() => {
        es.simulateEvent('transcript', {
          line: { speaker: 'rep', text: 'Of course, what would you like to know?', timestamp: 4000 },
        });
      });

      // Session complete
      act(() => {
        es.simulateEvent('session_complete', {
          scorecard: {
            overallScore: 70,
            summary: 'Decent call.',
            entries: [],
          },
        });
      });

      const lines = JSON.parse(screen.getByTestId('lines').textContent!);
      expect(lines).toHaveLength(3);
      expect(lines[0].text).toBe('Welcome, glad to connect.');
      expect(lines[1].speaker).toBe('prospect');
      expect(lines[2].text).toBe('Of course, what would you like to know?');

      const prompts = JSON.parse(screen.getByTestId('prompts').textContent!);
      expect(prompts).toHaveLength(1);
      expect(prompts[0].message).toBe('Let the prospect speak more.');

      const scorecard = JSON.parse(screen.getByTestId('scorecard').textContent!);
      expect(scorecard.overallScore).toBe(70);
    });
  });
});
