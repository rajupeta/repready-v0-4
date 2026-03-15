import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const ROOT = join(__dirname, '../..');
const readmePath = join(ROOT, 'README.md');
const readme = readFileSync(readmePath, 'utf-8');
const lines = readme.split('\n');

/** Extract lines between a heading and the next heading of same or higher level */
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

describe('TICKET-015 Final QA: README.md Acceptance Criteria Validation', () => {
  // ── AC1: README.md exists with all 10 sections ──
  describe('AC1: All 10 sections present and ordered', () => {
    it('README.md file exists', () => {
      expect(existsSync(readmePath)).toBe(true);
    });

    it('README.md has substantial content', () => {
      expect(readme.length).toBeGreaterThan(500);
    });

    const sections = [
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

    it.each(sections)('has section: %s', (section) => {
      const found = lines.some(
        (l) => l.startsWith('#') && l.includes(section)
      );
      expect(found).toBe(true);
    });

    it('sections appear in correct order', () => {
      const indices = sections.map((s) =>
        lines.findIndex((l) => l.startsWith('#') && l.includes(s))
      );
      for (let i = 1; i < indices.length; i++) {
        expect(indices[i]).toBeGreaterThan(indices[i - 1]);
      }
    });
  });

  // ── AC2: API endpoints table ──
  describe('AC2: API endpoints table with all 6 routes', () => {
    const apiSection = getSection('API Endpoints');

    const routes = [
      { method: 'POST', path: '/api/sessions', keyword: 'reate' },
      { method: 'POST', path: '/api/sessions/:id/start', keyword: 'tart' },
      { method: 'GET', path: '/api/sessions/:id/stream', keyword: 'stream' },
      { method: 'GET', path: '/api/sessions/:id/scorecard', keyword: 'scorecard' },
      { method: 'GET', path: '/api/fixtures', keyword: 'fixture' },
      { method: 'GET', path: '/api/health', keyword: 'ealth' },
    ];

    it('has table with Method, Path, Description columns', () => {
      const header = apiSection.find(
        (l) => l.includes('Method') && l.includes('Path') && l.includes('Description')
      );
      expect(header).toBeDefined();
    });

    it.each(routes)(
      'documents $method $path',
      ({ method, path, keyword }) => {
        const row = apiSection.find(
          (l) => l.includes(method) && l.includes(path)
        );
        expect(row).toBeDefined();
        expect(row!.toLowerCase()).toContain(keyword.toLowerCase());
      }
    );

    it('has exactly 6 API route rows', () => {
      const rows = apiSection.filter(
        (l) => l.startsWith('|') && l.includes('/api/')
      );
      expect(rows).toHaveLength(6);
    });
  });

  // ── AC3: Architecture explains v0/v1 boundary ──
  describe('AC3: Architecture section with v0/v1 boundary', () => {
    const archSection = getSection('Architecture');
    const archText = archSection.join(' ');

    it('mentions TranscriptService.addLine()', () => {
      expect(archText).toContain('TranscriptService.addLine()');
    });

    it('explains v0/v1 boundary', () => {
      expect(archText).toMatch(/v0.*v1.*boundary|v0\/v1.*boundary/i);
    });

    it('mentions PlaybackService for v0', () => {
      expect(archText).toContain('PlaybackService');
      expect(archText).toMatch(/v0/);
    });

    it('mentions Deepgram for v1', () => {
      expect(archText).toMatch(/Deepgram/i);
    });

    it('lists all 7 services', () => {
      for (const svc of [
        'PlaybackService', 'TranscriptService', 'RulesEngine',
        'CoachingService', 'ScorecardService', 'EventBus', 'SessionManager',
      ]) {
        expect(archText).toContain(svc);
      }
    });

    it('documents 4 SSE event types', () => {
      for (const evt of ['transcript', 'coaching_prompt', 'session_complete', 'heartbeat']) {
        expect(archText).toContain(evt);
      }
    });
  });

  // ── AC4: Coaching rules ──
  describe('AC4: All 6 coaching rules with ruleId and cooldown', () => {
    const rulesSection = getSection('Coaching Rules');

    const rules = [
      { ruleId: 'talk-ratio', cooldown: '30s' },
      { ruleId: 'long-monologue', cooldown: '45s' },
      { ruleId: 'no-questions', cooldown: '60s' },
      { ruleId: 'filler-words', cooldown: '20s' },
      { ruleId: 'feature-dump', cooldown: '45s' },
      { ruleId: 'no-next-steps', cooldown: '90s' },
    ];

    it('has Rule ID and Cooldown columns', () => {
      const header = rulesSection.find(
        (l) => l.includes('Rule ID') && l.includes('Cooldown')
      );
      expect(header).toBeDefined();
    });

    it.each(rules)(
      'rule $ruleId has cooldown $cooldown',
      ({ ruleId, cooldown }) => {
        const row = rulesSection.find((l) => l.includes(ruleId));
        expect(row).toBeDefined();
        expect(row).toContain(cooldown);
      }
    );

    it('has exactly 6 rule rows', () => {
      const dataRows = rulesSection.filter(
        (l) =>
          l.startsWith('|') &&
          !l.includes('Rule ID') &&
          !l.match(/^[\s|:-]+$/)
      );
      expect(dataRows).toHaveLength(6);
    });
  });

  // ── AC5: Getting started accuracy ──
  describe('AC5: Getting started instructions', () => {
    const gsSection = getSection('Getting Started');
    const gsText = gsSection.join('\n');

    it('lists Node.js 20+ prerequisite', () => {
      expect(gsText).toMatch(/Node\.js\s+20\+/);
    });

    it('lists npm prerequisite', () => {
      expect(gsText).toContain('npm');
    });

    it('has git clone step', () => {
      expect(gsText).toContain('git clone');
    });

    it('has npm install step', () => {
      expect(gsText).toContain('npm install');
    });

    it('has .env.example copy step', () => {
      expect(gsText).toContain('cp .env.example .env');
    });

    it('mentions ANTHROPIC_API_KEY', () => {
      expect(gsText).toContain('ANTHROPIC_API_KEY');
    });

    it('has npm run dev step', () => {
      expect(gsText).toContain('npm run dev');
    });

    it('references localhost:3000', () => {
      expect(gsText).toContain('localhost:3000');
    });

    it('.env.example exists on disk', () => {
      expect(existsSync(join(ROOT, '.env.example'))).toBe(true);
    });
  });

  // ── AC6: Docker instructions ──
  describe('AC6: Docker instructions', () => {
    const dockerSection = getSection('Docker');

    it('has Docker section', () => {
      expect(dockerSection.length).toBeGreaterThan(0);
    });

    it('includes docker compose up', () => {
      expect(dockerSection.some((l) => l.includes('docker compose up'))).toBe(true);
    });
  });

  // ── Data models ──
  describe('Data models documented correctly', () => {
    const modelsText = getSection('Data Models').join('\n');

    it('TranscriptLine with speaker union', () => {
      expect(modelsText).toContain('TranscriptLine');
      expect(modelsText).toContain("'rep' | 'prospect'");
    });

    it('CoachingPrompt with required fields', () => {
      expect(modelsText).toContain('CoachingPrompt');
      for (const f of ['ruleId', 'ruleName', 'message', 'timestamp']) {
        expect(modelsText).toContain(f);
      }
    });

    it('Scorecard with overallScore 0-100', () => {
      expect(modelsText).toContain('Scorecard');
      expect(modelsText).toContain('overallScore');
      expect(modelsText).toMatch(/0.*100/);
    });

    it('ScorecardEntry with assessment union', () => {
      expect(modelsText).toContain('ScorecardEntry');
      expect(modelsText).toContain("'good' | 'needs-work' | 'missed'");
    });
  });

  // ── Environment Variables ──
  describe('Environment Variables section', () => {
    it('ANTHROPIC_API_KEY listed as required', () => {
      const envSection = getSection('Environment Variables');
      const row = envSection.find((l) => l.includes('ANTHROPIC_API_KEY'));
      expect(row).toBeDefined();
      expect(row).toMatch(/Yes/i);
    });
  });

  // ── Formatting quality ──
  describe('Markdown formatting quality', () => {
    it('starts with H1', () => {
      const first = lines.find((l) => l.trim().length > 0);
      expect(first).toMatch(/^# /);
    });

    it('balanced code blocks', () => {
      const markers = lines.filter((l) => l.trim().startsWith('```'));
      expect(markers.length % 2).toBe(0);
    });

    it('balanced markdown links', () => {
      const broken = lines.filter(
        (l) => (l.match(/\[/g) || []).length !== (l.match(/\]/g) || []).length
      );
      expect(broken).toHaveLength(0);
    });
  });
});
