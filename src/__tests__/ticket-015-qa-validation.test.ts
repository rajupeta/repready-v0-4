import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../..');
const readme = readFileSync(join(ROOT, 'README.md'), 'utf-8');
const lines = readme.split('\n');

describe('TICKET-015: Comprehensive README.md — QA Validation', () => {
  describe('AC1: README.md exists with all 10 sections in correct order', () => {
    const expectedSections = [
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

    it('contains all 10 sections as headings', () => {
      for (const section of expectedSections) {
        const hasHeading = lines.some(
          (line) => line.startsWith('#') && line.includes(section)
        );
        expect(hasHeading).toBe(true);
      }
    });

    it('sections appear in the specified order', () => {
      const indices = expectedSections.map((section) =>
        lines.findIndex((line) => line.startsWith('#') && line.includes(section))
      );
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1]);
      }
    });
  });

  describe('AC2: API endpoints table lists all 6 routes with method, path, and description', () => {
    const routes = [
      { method: 'POST', path: '/api/sessions', desc: 'Create' },
      { method: 'POST', path: '/api/sessions/:id/start', desc: 'Start' },
      { method: 'GET', path: '/api/sessions/:id/stream', desc: 'SSE' },
      { method: 'GET', path: '/api/sessions/:id/scorecard', desc: 'scorecard' },
      { method: 'GET', path: '/api/fixtures', desc: 'fixture' },
      { method: 'GET', path: '/api/health', desc: 'ealth' },
    ];

    it('has a markdown table with Method, Path, and Description columns', () => {
      const headerLine = lines.find(
        (line) => line.includes('Method') && line.includes('Path') && line.includes('Description')
      );
      expect(headerLine).toBeDefined();
    });

    it.each(routes)(
      'documents $method $path with a description',
      ({ method, path, desc }) => {
        const row = lines.find(
          (line) => line.includes(method) && line.includes(path)
        );
        expect(row).toBeDefined();
        expect(row).toMatch(new RegExp(desc, 'i'));
      }
    );

    it('lists exactly 6 API route rows (excluding header and separator)', () => {
      const apiSection = getSection('API Endpoints');
      const tableRows = apiSection.filter(
        (line) =>
          line.startsWith('|') &&
          line.includes('/api/')
      );
      expect(tableRows).toHaveLength(6);
    });
  });

  describe('AC3: Architecture section explains TranscriptService.addLine() as v0/v1 boundary', () => {
    it('mentions TranscriptService.addLine()', () => {
      const archSection = getSection('Architecture');
      const mentionsAddLine = archSection.some((line) =>
        line.includes('TranscriptService.addLine()')
      );
      expect(mentionsAddLine).toBe(true);
    });

    it('explains the v0/v1 boundary concept', () => {
      const archSection = getSection('Architecture').join(' ');
      expect(archSection).toMatch(/v0.*v1.*boundary|v0\/v1.*boundary/i);
    });

    it('mentions PlaybackService as v0-only', () => {
      const archSection = getSection('Architecture').join(' ');
      expect(archSection).toMatch(/PlaybackService/);
      expect(archSection).toMatch(/v0/);
    });

    it('mentions Deepgram webhook for v1', () => {
      const archSection = getSection('Architecture').join(' ');
      expect(archSection).toMatch(/Deepgram/i);
    });

    it('lists all 7 services', () => {
      const archSection = getSection('Architecture').join(' ');
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
        expect(archSection).toContain(service);
      }
    });

    it('documents all 4 SSE event types', () => {
      const archSection = getSection('Architecture').join(' ');
      for (const event of ['transcript', 'coaching_prompt', 'session_complete', 'heartbeat']) {
        expect(archSection).toContain(event);
      }
    });
  });

  describe('AC4: All 6 coaching rules documented with ruleId and cooldown', () => {
    const rules = [
      { ruleId: 'talk-ratio', cooldown: '30s' },
      { ruleId: 'long-monologue', cooldown: '45s' },
      { ruleId: 'no-questions', cooldown: '60s' },
      { ruleId: 'filler-words', cooldown: '20s' },
      { ruleId: 'feature-dump', cooldown: '45s' },
      { ruleId: 'no-next-steps', cooldown: '90s' },
    ];

    it('has a coaching rules table', () => {
      const rulesSection = getSection('Coaching Rules');
      const headerLine = rulesSection.find(
        (line) => line.includes('Rule ID') && line.includes('Cooldown')
      );
      expect(headerLine).toBeDefined();
    });

    it.each(rules)(
      'documents $ruleId with cooldown $cooldown',
      ({ ruleId, cooldown }) => {
        const rulesSection = getSection('Coaching Rules');
        const row = rulesSection.find((line) => line.includes(ruleId));
        expect(row).toBeDefined();
        expect(row).toContain(cooldown);
      }
    );

    it('documents exactly 6 rules', () => {
      const rulesSection = getSection('Coaching Rules');
      const dataRows = rulesSection.filter(
        (line) =>
          line.startsWith('|') &&
          !line.includes('Rule ID') &&
          !line.match(/^[\s|:-]+$/)
      );
      expect(dataRows).toHaveLength(6);
    });
  });

  describe('AC5: Getting started instructions are accurate', () => {
    it('lists Node.js 20+ as prerequisite', () => {
      expect(readme).toMatch(/Node\.js\s+20\+/);
    });

    it('lists npm as prerequisite', () => {
      const gsSection = getSection('Getting Started').join(' ');
      expect(gsSection).toContain('npm');
    });

    it('includes git clone command', () => {
      expect(readme).toContain('git clone');
    });

    it('includes npm install step', () => {
      expect(readme).toContain('npm install');
    });

    it('includes .env.example copy step', () => {
      expect(readme).toContain('cp .env.example .env');
    });

    it('.env.example actually exists', () => {
      expect(existsSync(join(ROOT, '.env.example'))).toBe(true);
    });

    it('mentions ANTHROPIC_API_KEY in setup', () => {
      // Check the raw README between Getting Started and API Endpoints headings
      const gsStart = readme.indexOf('## Getting Started');
      const gsEnd = readme.indexOf('## API Endpoints');
      const gsContent = readme.slice(gsStart, gsEnd);
      expect(gsContent).toContain('ANTHROPIC_API_KEY');
    });

    it('includes npm run dev command', () => {
      expect(readme).toContain('npm run dev');
    });

    it('references localhost:3000', () => {
      expect(readme).toContain('localhost:3000');
    });
  });

  describe('AC6: Docker instructions included', () => {
    it('has a Docker section', () => {
      const dockerHeading = lines.find(
        (line) => line.startsWith('#') && line.includes('Docker')
      );
      expect(dockerHeading).toBeDefined();
    });

    it('includes docker compose up command', () => {
      const dockerSection = getSection('Docker');
      const hasCommand = dockerSection.some((line) =>
        line.includes('docker compose up')
      );
      expect(hasCommand).toBe(true);
    });
  });

  describe('Data model accuracy — matches src/types/index.ts', () => {
    it('TranscriptLine has correct speaker union type', () => {
      expect(readme).toContain("'rep' | 'prospect'");
    });

    it('ScorecardEntry has correct assessment union type', () => {
      expect(readme).toContain("'good' | 'needs-work' | 'missed'");
    });

    it('Scorecard has overallScore with 0-100 comment', () => {
      expect(readme).toMatch(/overallScore.*0.*100|0.*100.*overallScore/);
    });

    it('CoachingPrompt includes ruleId, ruleName, message, timestamp', () => {
      const modelsSection = getSection('Data Models').join('\n');
      for (const field of ['ruleId', 'ruleName', 'message', 'timestamp']) {
        expect(modelsSection).toContain(field);
      }
    });
  });

  describe('Environment Variables accuracy', () => {
    it('documents ANTHROPIC_API_KEY as required', () => {
      const envSection = getSection('Environment Variables');
      const apiKeyRow = envSection.find((line) =>
        line.includes('ANTHROPIC_API_KEY')
      );
      expect(apiKeyRow).toBeDefined();
      expect(apiKeyRow).toMatch(/Yes/i);
    });
  });
});

/** Extract lines between a heading and the next heading of same or higher level */
function getSection(name: string): string[] {
  const startIdx = lines.findIndex(
    (line) => line.startsWith('#') && line.includes(name)
  );
  if (startIdx === -1) return [];
  const level = lines[startIdx].match(/^#+/)![0].length;
  const endIdx = lines.findIndex(
    (line, i) =>
      i > startIdx &&
      line.startsWith('#') &&
      line.match(/^#+/)![0].length <= level
  );
  return lines.slice(startIdx, endIdx === -1 ? lines.length : endIdx);
}
