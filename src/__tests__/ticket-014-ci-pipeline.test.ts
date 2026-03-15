import * as fs from 'fs';
import * as path from 'path';

describe('TICKET-014: GitHub Actions CI pipeline', () => {
  // Staged in ci-workflow/ because the token lacks `workflow` scope to push to .github/workflows/
  const workflowPath = path.resolve(__dirname, '../../ci-workflow/ci.yml');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(workflowPath, 'utf-8');
  });

  it('ci.yml exists in ci-workflow/ (copy to .github/workflows/ to activate)', () => {
    expect(fs.existsSync(workflowPath)).toBe(true);
  });

  it('workflow name is CI', () => {
    expect(content).toMatch(/^name:\s*CI$/m);
  });

  it('triggers on push to main', () => {
    expect(content).toMatch(/push:/);
    expect(content).toMatch(/branches:\s*\[main\]/);
  });

  it('triggers on pull_request to main', () => {
    expect(content).toMatch(/pull_request:/);
  });

  it('uses actions/checkout@v4', () => {
    expect(content).toMatch(/uses:\s*actions\/checkout@v4/);
  });

  it('uses actions/setup-node@v4 with Node 20 and npm cache', () => {
    expect(content).toMatch(/uses:\s*actions\/setup-node@v4/);
    expect(content).toMatch(/node-version:\s*['"]20['"]/);
    expect(content).toMatch(/cache:\s*['"]npm['"]/);
  });

  it('runs npm ci', () => {
    expect(content).toMatch(/run:\s*npm ci/);
  });

  it('runs npm run lint', () => {
    expect(content).toMatch(/run:\s*npm run lint/);
  });

  it('runs npm test', () => {
    expect(content).toMatch(/run:\s*npm test/);
  });

  it('runs npm run build', () => {
    expect(content).toMatch(/run:\s*npm run build/);
  });

  it('sets ANTHROPIC_API_KEY env var', () => {
    expect(content).toMatch(/ANTHROPIC_API_KEY:\s*test_key_for_ci_build/);
  });

  it('runs on ubuntu-latest', () => {
    expect(content).toMatch(/runs-on:\s*ubuntu-latest/);
  });
});
