import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../..');
const readmePath = join(ROOT, 'README.md');
const readme = readFileSync(readmePath, 'utf-8');
const lines = readme.split('\n');

/** Extract lines between a heading and the next heading of same or higher level, skipping code blocks */
function getSection(name: string): string[] {
  const startIdx = lines.findIndex(
    (line) => line.startsWith('#') && line.includes(name)
  );
  if (startIdx === -1) return [];
  const level = lines[startIdx].match(/^#+/)![0].length;
  let inCodeBlock = false;
  let endIdx = -1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    if (lines[i].trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (!inCodeBlock && lines[i].startsWith('#')) {
      const match = lines[i].match(/^#+/);
      if (match && match[0].length <= level) {
        endIdx = i;
        break;
      }
    }
  }
  return lines.slice(startIdx, endIdx === -1 ? lines.length : endIdx);
}

describe('TICKET-015 Test Agent QA: README.md Comprehensive Validation', () => {
  // ── AC1: README exists with all 10 sections ──────────────────────────
  describe('AC1: README.md exists with all 10 sections', () => {
    it('README.md file exists on disk', () => {
      expect(existsSync(readmePath)).toBe(true);
    });

    it('README.md is non-empty', () => {
      expect(readme.trim().length).toBeGreaterThan(100);
    });

    const requiredSections = [
      { name: 'RepReady v0.4', level: 1 },
      { name: 'Tech Stack', level: 2 },
      { name: 'Getting Started', level: 2 },
      { name: 'API Endpoints', level: 2 },
      { name: 'Architecture', level: 2 },
      { name: 'Coaching Rules', level: 2 },
      { name: 'Data Models', level: 2 },
      { name: 'Environment Variables', level: 2 },
      { name: 'Testing', level: 2 },
      { name: 'Docker', level: 2 },
    ];

    it.each(requiredSections)(
      'contains section "$name" as a heading',
      ({ name }) => {
        const heading = lines.find(
          (l) => l.startsWith('#') && l.includes(name)
        );
        expect(heading).toBeDefined();
      }
    );

    it('has exactly 10 required top-level sections in order', () => {
      const indices = requiredSections.map(({ name }) =>
        lines.findIndex((l) => l.startsWith('#') && l.includes(name))
      );
      // All found
      indices.forEach((idx) => expect(idx).toBeGreaterThanOrEqual(0));
      // In order
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1]);
      }
    });
  });

  // ── AC2: API endpoints table ─────────────────────────────────────────
  describe('AC2: API endpoints table lists all 6 routes', () => {
    const apiSection = getSection('API Endpoints');

    it('API Endpoints section has a markdown table', () => {
      const separatorLine = apiSection.find((l) => /^\|[\s:-]+\|/.test(l));
      expect(separatorLine).toBeDefined();
    });

    const routes = [
      { method: 'POST', path: '/api/sessions', descPattern: /create/i },
      { method: 'POST', path: '/api/sessions/:id/start', descPattern: /start|playback/i },
      { method: 'GET', path: '/api/sessions/:id/stream', descPattern: /sse|stream|event/i },
      { method: 'GET', path: '/api/sessions/:id/scorecard', descPattern: /scorecard/i },
      { method: 'GET', path: '/api/fixtures', descPattern: /fixture|list/i },
      { method: 'GET', path: '/api/health', descPattern: /health/i },
    ];

    it.each(routes)(
      'documents $method $path with matching description',
      ({ method, path, descPattern }) => {
        const row = apiSection.find(
          (l) => l.includes(method) && l.includes(path)
        );
        expect(row).toBeDefined();
        expect(row).toMatch(descPattern);
      }
    );

    it('table has exactly 6 data rows', () => {
      const dataRows = apiSection.filter(
        (l) => l.startsWith('|') && l.includes('/api/')
      );
      expect(dataRows).toHaveLength(6);
    });

    it('table has Method, Path, Description columns', () => {
      const header = apiSection.find(
        (l) =>
          l.includes('Method') && l.includes('Path') && l.includes('Description')
      );
      expect(header).toBeDefined();
    });
  });

  // ── AC3: Architecture explains TranscriptService.addLine() ───────────
  describe('AC3: Architecture section explains v0/v1 boundary', () => {
    const archSection = getSection('Architecture');
    const archText = archSection.join(' ');

    it('mentions TranscriptService.addLine()', () => {
      expect(archText).toContain('TranscriptService.addLine()');
    });

    it('explains v0/v1 boundary', () => {
      expect(archText).toMatch(/v0.*v1.*boundary|v0\/v1.*boundary/i);
    });

    it('mentions PlaybackService as v0-only', () => {
      expect(archText).toContain('PlaybackService');
      expect(archText).toMatch(/v0[\s-]*only/i);
    });

    it('mentions Deepgram for v1', () => {
      expect(archText).toMatch(/Deepgram/i);
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
      for (const svc of services) {
        expect(archText).toContain(svc);
      }
    });

    it('documents all 4 SSE event types', () => {
      for (const evt of ['transcript', 'coaching_prompt', 'session_complete', 'heartbeat']) {
        expect(archText).toContain(evt);
      }
    });

    it('SSE events are in a table with Event, Payload, Description columns', () => {
      const sseHeader = archSection.find(
        (l) => l.includes('Event') && l.includes('Payload') && l.includes('Description')
      );
      expect(sseHeader).toBeDefined();
    });
  });

  // ── AC4: All 6 coaching rules with ruleId and cooldown ───────────────
  describe('AC4: Coaching Rules documented with ruleId and cooldown', () => {
    const rulesSection = getSection('Coaching Rules');

    const rules = [
      { ruleId: 'talk-ratio', cooldown: '30s', name: 'Talk Ratio' },
      { ruleId: 'long-monologue', cooldown: '45s', name: 'Long Monologue' },
      { ruleId: 'no-questions', cooldown: '60s', name: 'No Questions' },
      { ruleId: 'filler-words', cooldown: '20s', name: 'Filler Words' },
      { ruleId: 'feature-dump', cooldown: '45s', name: 'Feature Dump' },
      { ruleId: 'no-next-steps', cooldown: '90s', name: 'No Next Steps' },
    ];

    it('has a table with Rule ID and Cooldown columns', () => {
      const header = rulesSection.find(
        (l) => l.includes('Rule ID') && l.includes('Cooldown')
      );
      expect(header).toBeDefined();
    });

    it.each(rules)(
      'rule $ruleId ($name) documented with cooldown $cooldown',
      ({ ruleId, cooldown }) => {
        const row = rulesSection.find((l) => l.includes(ruleId));
        expect(row).toBeDefined();
        expect(row).toContain(cooldown);
      }
    );

    it('exactly 6 rules in the table', () => {
      const dataRows = rulesSection.filter(
        (l) =>
          l.startsWith('|') &&
          !l.includes('Rule ID') &&
          !l.match(/^[\s|:-]+$/)
      );
      expect(dataRows).toHaveLength(6);
    });

    it('mentions rolling 10-line window', () => {
      const text = rulesSection.join(' ');
      expect(text).toMatch(/10.*line/i);
    });
  });

  // ── AC5: Getting started instructions are accurate ───────────────────
  describe('AC5: Getting started instructions are accurate', () => {
    const gsSection = getSection('Getting Started');
    const gsText = gsSection.join('\n');

    it('lists Node.js 20+ as prerequisite', () => {
      expect(gsText).toMatch(/Node\.js\s+20\+/);
    });

    it('lists npm as prerequisite', () => {
      expect(gsText).toContain('npm');
    });

    it('includes git clone step', () => {
      expect(gsText).toContain('git clone');
    });

    it('includes npm install step', () => {
      expect(gsText).toContain('npm install');
    });

    it('includes .env.example copy step', () => {
      expect(gsText).toContain('cp .env.example .env');
    });

    it('mentions ANTHROPIC_API_KEY configuration', () => {
      expect(gsText).toContain('ANTHROPIC_API_KEY');
    });

    it('includes npm run dev command', () => {
      expect(gsText).toContain('npm run dev');
    });

    it('references localhost:3000', () => {
      expect(gsText).toContain('localhost:3000');
    });

    it('.env.example file exists in repo root', () => {
      expect(existsSync(join(ROOT, '.env.example'))).toBe(true);
    });
  });

  // ── AC6: Docker instructions included ────────────────────────────────
  describe('AC6: Docker instructions included', () => {
    const dockerSection = getSection('Docker');

    it('Docker section exists as a heading', () => {
      expect(dockerSection.length).toBeGreaterThan(0);
    });

    it('includes docker compose up command', () => {
      const hasCommand = dockerSection.some((l) =>
        l.includes('docker compose up')
      );
      expect(hasCommand).toBe(true);
    });

    it('mentions .env configuration for Docker', () => {
      const text = dockerSection.join(' ');
      expect(text).toMatch(/\.env/);
    });
  });

  // ── Additional quality checks ────────────────────────────────────────
  describe('Data Models section accuracy', () => {
    const modelsSection = getSection('Data Models');
    const modelsText = modelsSection.join('\n');

    it('documents TranscriptLine interface with speaker union', () => {
      expect(modelsText).toContain('TranscriptLine');
      expect(modelsText).toContain("'rep' | 'prospect'");
    });

    it('documents CoachingPrompt interface fields', () => {
      expect(modelsText).toContain('CoachingPrompt');
      for (const field of ['ruleId', 'ruleName', 'message', 'timestamp']) {
        expect(modelsText).toContain(field);
      }
    });

    it('documents Scorecard interface with overallScore 0-100', () => {
      expect(modelsText).toContain('Scorecard');
      expect(modelsText).toContain('overallScore');
      expect(modelsText).toMatch(/0.*100/);
    });

    it('documents ScorecardEntry interface with assessment union', () => {
      expect(modelsText).toContain('ScorecardEntry');
      expect(modelsText).toContain("'good' | 'needs-work' | 'missed'");
    });
  });

  describe('Environment Variables section', () => {
    const envSection = getSection('Environment Variables');

    it('ANTHROPIC_API_KEY is listed as required', () => {
      const row = envSection.find((l) => l.includes('ANTHROPIC_API_KEY'));
      expect(row).toBeDefined();
      expect(row).toMatch(/Yes/i);
    });

    it('has a table with Variable, Required, Description columns', () => {
      const header = envSection.find(
        (l) => l.includes('Variable') && l.includes('Required')
      );
      expect(header).toBeDefined();
    });
  });

  describe('Testing section', () => {
    const testSection = getSection('Testing');
    const testText = testSection.join(' ');

    it('includes npm test command', () => {
      expect(testText).toContain('npm test');
    });
  });

  describe('Tech Stack section', () => {
    const techSection = getSection('Tech Stack');
    const techText = techSection.join(' ');

    it('mentions Next.js 15', () => {
      expect(techText).toMatch(/Next\.js\s+15/);
    });

    it('mentions TypeScript', () => {
      expect(techText).toContain('TypeScript');
    });

    it('mentions Anthropic Claude API', () => {
      expect(techText).toMatch(/Claude/i);
    });

    it('mentions claude-haiku-4-5-20251001 model', () => {
      expect(techText).toContain('claude-haiku-4-5-20251001');
    });

    it('mentions SSE', () => {
      expect(techText).toMatch(/Server-Sent Events|SSE/);
    });

    it('mentions Tailwind CSS', () => {
      expect(techText).toContain('Tailwind CSS');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────────
  describe('Edge cases and formatting', () => {
    it('README starts with an H1 heading', () => {
      const firstLine = lines.find((l) => l.trim().length > 0);
      expect(firstLine).toMatch(/^# /);
    });

    it('no broken markdown links (unclosed brackets)', () => {
      const brokenLinks = lines.filter(
        (l) => (l.match(/\[/g) || []).length !== (l.match(/\]/g) || []).length
      );
      expect(brokenLinks).toHaveLength(0);
    });

    it('code blocks are properly closed', () => {
      const codeBlockMarkers = lines.filter((l) => l.trim().startsWith('```'));
      expect(codeBlockMarkers.length % 2).toBe(0);
    });

    it('no trailing whitespace on heading lines', () => {
      const headingsWithTrailing = lines.filter(
        (l) => l.startsWith('#') && l !== l.trimEnd()
      );
      expect(headingsWithTrailing).toHaveLength(0);
    });
  });
});
