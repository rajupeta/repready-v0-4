/**
 * TICKET-030: Move session page from / to /session route
 *
 * Acceptance Criteria:
 * 1. Session page exists at /session (src/app/session/page.tsx)
 * 2. Root / redirects to /session
 * 3. All internal links/imports updated
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

const appDir = resolve(__dirname, '../app');

describe('TICKET-030: Session page at /session route', () => {
  describe('AC1: Session page at /session', () => {
    it('src/app/session/page.tsx exists', () => {
      const sessionPagePath = resolve(appDir, 'session/page.tsx');
      expect(existsSync(sessionPagePath)).toBe(true);
    });

    it('session page contains the Home component', () => {
      const source = readFileSync(resolve(appDir, 'session/page.tsx'), 'utf-8');
      expect(source).toContain('export default function Home');
    });

    it('session page uses the useSSE hook', () => {
      const source = readFileSync(resolve(appDir, 'session/page.tsx'), 'utf-8');
      expect(source).toContain('useSSE');
    });

    it('session page contains session management logic', () => {
      const source = readFileSync(resolve(appDir, 'session/page.tsx'), 'utf-8');
      expect(source).toContain('handleStartSession');
      expect(source).toContain('handleEndCall');
    });

    it('session page is a client component', () => {
      const source = readFileSync(resolve(appDir, 'session/page.tsx'), 'utf-8');
      expect(source).toContain("'use client'");
    });
  });

  describe('AC2: Root / redirects to /session', () => {
    it('src/app/page.tsx exists', () => {
      const rootPagePath = resolve(appDir, 'page.tsx');
      expect(existsSync(rootPagePath)).toBe(true);
    });

    it('root page imports redirect from next/navigation', () => {
      const source = readFileSync(resolve(appDir, 'page.tsx'), 'utf-8');
      expect(source).toContain("from 'next/navigation'");
      expect(source).toContain('redirect');
    });

    it('root page redirects to /session', () => {
      const source = readFileSync(resolve(appDir, 'page.tsx'), 'utf-8');
      expect(source).toContain("redirect('/session')");
    });

    it('root page does NOT contain session logic', () => {
      const source = readFileSync(resolve(appDir, 'page.tsx'), 'utf-8');
      expect(source).not.toContain('useSSE');
      expect(source).not.toContain('handleStartSession');
      expect(source).not.toContain("'use client'");
    });
  });

  describe('AC3: All internal links updated', () => {
    it('test files import Home from @/app/session/page, not @/app/page', () => {
      const testDir = resolve(__dirname);
      const testFiles = [
        'ticket-012-page.test.tsx',
        'ticket-012-edge-cases.test.tsx',
        'ticket-012-qa-validation.test.tsx',
        'ticket-012-test-agent-qa.test.tsx',
        'ticket-017-session-id-fix.test.tsx',
        'ticket-017-qa-validation.test.tsx',
        'ticket-028-end-call-button.test.tsx',
      ];

      for (const file of testFiles) {
        const filePath = resolve(testDir, file);
        if (existsSync(filePath)) {
          const source = readFileSync(filePath, 'utf-8');
          expect(source).toContain("from '@/app/session/page'");
          expect(source).not.toMatch(/from ['"]@\/app\/page['"]/);
        }
      }
    });
  });
});
