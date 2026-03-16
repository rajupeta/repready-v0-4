/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import Home from '@/app/page';

// Mock useSSE hook
const mockUseSSE = jest.fn();
jest.mock('@/hooks/useSSE', () => ({
  useSSE: (...args: unknown[]) => mockUseSSE(...args),
}));

// Mock fetch
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
  mockFetch.mockResolvedValue({
    json: () => Promise.resolve({ sessionId: 'test-session-123' }),
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('TICKET-029: Call type dropdown replaces fixture picker', () => {
  it('shows call type dropdown with all four call types', () => {
    render(<Home />);
    const select = screen.getByLabelText('Select call type');
    expect(select).toBeInTheDocument();

    expect(screen.getByRole('option', { name: 'Discovery Call' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Demo' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Objection Handling' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Follow-up' })).toBeInTheDocument();
  });

  it('does not show fixture filenames', () => {
    render(<Home />);
    expect(screen.queryByText('discovery-call-001')).not.toBeInTheDocument();
    expect(screen.queryByText('objection-handling-001')).not.toBeInTheDocument();
  });

  it('does not fetch /api/fixtures', () => {
    render(<Home />);
    expect(mockFetch).not.toHaveBeenCalledWith('/api/fixtures');
  });

  it('defaults to discovery call type', () => {
    render(<Home />);
    const select = screen.getByLabelText('Select call type') as HTMLSelectElement;
    expect(select.value).toBe('discovery');
  });

  it('allows changing the call type', () => {
    render(<Home />);
    const select = screen.getByLabelText('Select call type');
    fireEvent.change(select, { target: { value: 'objection-handling' } });
    expect((select as HTMLSelectElement).value).toBe('objection-handling');
  });

  it('sends callType (not fixtureId) in POST /api/sessions', async () => {
    render(<Home />);

    const select = screen.getByLabelText('Select call type');
    fireEvent.change(select, { target: { value: 'demo' } });

    const button = screen.getByText('Start Session');
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callType: 'demo' }),
      });
    });
  });

  it('sends discovery callType by default', async () => {
    render(<Home />);

    const button = screen.getByText('Start Session');
    await act(async () => {
      fireEvent.click(button);
    });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callType: 'discovery' }),
      });
    });
  });

  it('disables dropdown during loading and active states', async () => {
    render(<Home />);

    const select = screen.getByLabelText('Select call type');
    const button = screen.getByText('Start Session');

    // Click start — enters loading state
    await act(async () => {
      fireEvent.click(button);
    });

    expect(select).toBeDisabled();
  });

  it('has four options in the dropdown', () => {
    render(<Home />);
    const options = screen.getAllByRole('option');
    expect(options).toHaveLength(4);
  });
});

describe('TICKET-029: call-type-routing resolves fixture from callType', () => {
  // These test the backend routing module directly
  let resolveFixture: typeof import('@/lib/call-type-routing').resolveFixture;
  let VALID_CALL_TYPES: typeof import('@/lib/call-type-routing').VALID_CALL_TYPES;

  beforeAll(async () => {
    const mod = await import('@/lib/call-type-routing');
    resolveFixture = mod.resolveFixture;
    VALID_CALL_TYPES = mod.VALID_CALL_TYPES;
  });

  it('resolves discovery callType to discovery-call-001 fixture', () => {
    const result = resolveFixture('discovery');
    expect(result.fixtureId).toBe('discovery-call-001');
    expect(result.callType).toBe('discovery');
  });

  it('resolves objection-handling callType to objection-handling-001 fixture', () => {
    const result = resolveFixture('objection-handling');
    expect(result.fixtureId).toBe('objection-handling-001');
    expect(result.callType).toBe('objection-handling');
  });

  it('resolves demo callType to a fixture', () => {
    const result = resolveFixture('demo');
    expect(result.fixtureId).toBeDefined();
    expect(result.callType).toBe('demo');
  });

  it('resolves follow-up callType to a fixture', () => {
    const result = resolveFixture('follow-up');
    expect(result.fixtureId).toBeDefined();
    expect(result.callType).toBe('follow-up');
  });

  it('VALID_CALL_TYPES contains all four types', () => {
    expect(VALID_CALL_TYPES).toContain('discovery');
    expect(VALID_CALL_TYPES).toContain('demo');
    expect(VALID_CALL_TYPES).toContain('objection-handling');
    expect(VALID_CALL_TYPES).toContain('follow-up');
    expect(VALID_CALL_TYPES).toHaveLength(4);
  });
});
