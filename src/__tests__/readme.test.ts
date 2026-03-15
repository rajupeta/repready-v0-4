import { readFileSync } from 'fs';
import { join } from 'path';

describe('README.md', () => {
  const readme = readFileSync(join(__dirname, '../../README.md'), 'utf-8');

  it('exists and has content', () => {
    expect(readme.length).toBeGreaterThan(0);
  });

  describe('has all 10 required sections', () => {
    const requiredSections = [
      'RepReady v0.4',
      'Tech Stack',
      'Getting Started',
      'API Endpoints',
      'Architecture',
      'Coaching Rules',
      'Data Models',
      'Environment Variables',
      'Testing',
      'Docker',
    ];

    it.each(requiredSections)('contains section: %s', (section) => {
      expect(readme).toContain(section);
    });
  });

  describe('API endpoints table lists all 6 routes', () => {
    const routes = [
      { method: 'POST', path: '/api/sessions' },
      { method: 'POST', path: '/api/sessions/:id/start' },
      { method: 'GET', path: '/api/sessions/:id/stream' },
      { method: 'GET', path: '/api/sessions/:id/scorecard' },
      { method: 'GET', path: '/api/fixtures' },
      { method: 'GET', path: '/api/health' },
    ];

    it.each(routes)('lists $method $path', ({ method, path }) => {
      expect(readme).toContain(method);
      expect(readme).toContain(path);
    });
  });

  describe('Architecture section', () => {
    it('explains TranscriptService.addLine() as v0/v1 boundary', () => {
      expect(readme).toContain('TranscriptService.addLine()');
      expect(readme).toMatch(/v0.*v1.*boundary|v0\/v1.*boundary/i);
    });

    it('lists all 7 services', () => {
      const services = [
        'PlaybackService',
        'TranscriptService',
        'RulesEngine',
        'CoachingService',
        'ScorecardService',
        'EventBus',
        'SessionManager',
      ];
      for (const service of services) {
        expect(readme).toContain(service);
      }
    });

    it('documents SSE event types', () => {
      const eventTypes = ['transcript', 'coaching_prompt', 'session_complete', 'heartbeat'];
      for (const event of eventTypes) {
        expect(readme).toContain(event);
      }
    });
  });

  describe('Coaching Rules section', () => {
    const rules = [
      { ruleId: 'talk-ratio', cooldown: '30s' },
      { ruleId: 'long-monologue', cooldown: '45s' },
      { ruleId: 'no-questions', cooldown: '60s' },
      { ruleId: 'filler-words', cooldown: '20s' },
      { ruleId: 'feature-dump', cooldown: '45s' },
      { ruleId: 'no-next-steps', cooldown: '90s' },
    ];

    it.each(rules)('documents rule $ruleId with cooldown $cooldown', ({ ruleId, cooldown }) => {
      expect(readme).toContain(ruleId);
      expect(readme).toContain(cooldown);
    });
  });

  describe('Getting Started section', () => {
    it('includes npm install', () => {
      expect(readme).toContain('npm install');
    });

    it('includes .env.example copy step', () => {
      expect(readme).toContain('cp .env.example .env');
    });

    it('includes npm run dev', () => {
      expect(readme).toContain('npm run dev');
    });

    it('includes localhost:3000', () => {
      expect(readme).toContain('localhost:3000');
    });
  });

  describe('Docker section', () => {
    it('includes docker compose up', () => {
      expect(readme).toContain('docker compose up');
    });
  });

  describe('Data Models section', () => {
    it('documents TranscriptLine type', () => {
      expect(readme).toContain('TranscriptLine');
      expect(readme).toContain("'rep' | 'prospect'");
    });

    it('documents CoachingPrompt type', () => {
      expect(readme).toContain('CoachingPrompt');
      expect(readme).toContain('ruleId');
      expect(readme).toContain('message');
    });

    it('documents Scorecard type', () => {
      expect(readme).toContain('Scorecard');
      expect(readme).toContain('overallScore');
    });

    it('documents ScorecardEntry type', () => {
      expect(readme).toContain('ScorecardEntry');
      expect(readme).toContain("'good' | 'needs-work' | 'missed'");
    });
  });

  describe('Environment Variables section', () => {
    it('documents ANTHROPIC_API_KEY as required', () => {
      expect(readme).toContain('ANTHROPIC_API_KEY');
    });
  });
});
