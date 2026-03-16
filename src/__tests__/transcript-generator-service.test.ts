import { TranscriptGeneratorService } from '@/services/transcript-generator-service';
import { stripCodeFences } from '@/services/claude-service';

// Mock the Anthropic SDK
jest.mock('anthropic-ai/sdk', () => {
  return jest.fn();
}, { virtual: true });

const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: mockCreate,
      },
    })),
  };
});

describe('TranscriptGeneratorService', () => {
  let service: TranscriptGeneratorService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TranscriptGeneratorService();
  });

  describe('generateTranscript', () => {
    it('generates a valid transcript for discovery call type', async () => {
      const mockLines = [
        { speaker: 'rep', text: 'Hi, thanks for taking the time today.' },
        { speaker: 'prospect', text: 'Sure, happy to chat.' },
        { speaker: 'rep', text: 'Can you tell me about your current process?' },
        { speaker: 'prospect', text: 'We use manual outreach mostly.' },
      ];

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockLines) }],
      });

      const result = await service.generateTranscript('discovery');

      expect(result).toEqual(mockLines);
      expect(mockCreate).toHaveBeenCalledTimes(1);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          max_tokens: 4096,
          messages: [{ role: 'user', content: expect.stringContaining('discovery') }],
        }),
      );
    });

    it('generates transcript for objection-handling call type', async () => {
      const mockLines = [
        { speaker: 'rep', text: 'Following up on our proposal.' },
        { speaker: 'prospect', text: 'The price is too high.' },
      ];

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockLines) }],
      });

      const result = await service.generateTranscript('objection-handling');

      expect(result).toEqual(mockLines);
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [{ role: 'user', content: expect.stringContaining('objection') }],
        }),
      );
    });

    it('generates transcript for demo call type', async () => {
      const mockLines = [
        { speaker: 'rep', text: 'Let me show you the dashboard.' },
        { speaker: 'prospect', text: 'Does it integrate with Salesforce?' },
      ];

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockLines) }],
      });

      const result = await service.generateTranscript('demo');

      expect(result).toEqual(mockLines);
    });

    it('generates transcript for follow-up call type', async () => {
      const mockLines = [
        { speaker: 'rep', text: 'Just checking in on the proposal.' },
        { speaker: 'prospect', text: 'We are still evaluating.' },
      ];

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockLines) }],
      });

      const result = await service.generateTranscript('follow-up');

      expect(result).toEqual(mockLines);
    });

    it('handles Claude response wrapped in code fences', async () => {
      const mockLines = [
        { speaker: 'rep', text: 'Hello.' },
        { speaker: 'prospect', text: 'Hi there.' },
      ];

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '```json\n' + JSON.stringify(mockLines) + '\n```' }],
      });

      const result = await service.generateTranscript('discovery');

      expect(result).toEqual(mockLines);
    });

    it('throws error when Claude returns non-text content', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'image', source: {} }],
      });

      await expect(service.generateTranscript('discovery')).rejects.toThrow(
        'Unexpected response format from Claude',
      );
    });

    it('throws error when Claude returns empty array', async () => {
      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: '[]' }],
      });

      await expect(service.generateTranscript('discovery')).rejects.toThrow(
        'Invalid transcript format: expected non-empty array',
      );
    });

    it('throws error when a line has invalid speaker', async () => {
      const badLines = [
        { speaker: 'manager', text: 'This is invalid.' },
      ];

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(badLines) }],
      });

      await expect(service.generateTranscript('discovery')).rejects.toThrow(
        'Invalid transcript line',
      );
    });

    it('throws error when a line is missing text field', async () => {
      const badLines = [
        { speaker: 'rep' },
      ];

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(badLines) }],
      });

      await expect(service.generateTranscript('discovery')).rejects.toThrow(
        'Invalid transcript line',
      );
    });

    it('propagates API errors', async () => {
      mockCreate.mockRejectedValue(new Error('API key invalid'));

      await expect(service.generateTranscript('discovery')).rejects.toThrow(
        'API key invalid',
      );
    });

    it('only returns speaker and text fields (strips extra fields)', async () => {
      const mockLines = [
        { speaker: 'rep', text: 'Hi.', extra: 'field', id: 1 },
        { speaker: 'prospect', text: 'Hello.', timestamp: 12345 },
      ];

      mockCreate.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockLines) }],
      });

      const result = await service.generateTranscript('discovery');

      expect(result).toEqual([
        { speaker: 'rep', text: 'Hi.' },
        { speaker: 'prospect', text: 'Hello.' },
      ]);
    });
  });
});

describe('stripCodeFences', () => {
  it('strips ```json fences', () => {
    expect(stripCodeFences('```json\n[{"a":1}]\n```')).toBe('[{"a":1}]');
  });

  it('strips bare ``` fences', () => {
    expect(stripCodeFences('```\n[{"a":1}]\n```')).toBe('[{"a":1}]');
  });

  it('returns raw JSON unchanged', () => {
    expect(stripCodeFences('[{"a":1}]')).toBe('[{"a":1}]');
  });
});
