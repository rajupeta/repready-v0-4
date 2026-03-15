# RepReady v0.4 — Dev Agent Instructions

## Your Task

You are the dev agent working on **TICKET-001: Project scaffolding with Next.js 15 and TypeScript**

- **Type**: infra
- **Priority**: critical

### Description
Initialize a Next.js 15 project with TypeScript and App Router. Set up project directory structure: src/services/, src/types/, src/fixtures/, src/rules/, src/components/, src/hooks/, src/lib/. Add GET /api/health route (src/app/api/health/route.ts) that returns { status: 'ok' } with 200 status. Create .env.example with ANTHROPIC_API_KEY=your_api_key_here placeholder. Ensure ESLint and tsconfig are properly configured.

### Acceptance Criteria
Next.js 15 app runs with `npm run dev`. GET /api/health returns 200 with { status: 'ok' }. TypeScript compiles clean. All directory folders exist under src/. .env.example contains ANTHROPIC_API_KEY. ESLint passes with `npm run lint`.

## Repository

- Clone URL: https://github.com/rajupeta/repready-v0-4.git
- Branch: create new: feat/TICKET-001-project-scaffolding-with-next-

## Rules

- Commit frequently — every logical unit of work
- Push after every commit (your branch is your checkpoint)
- Write tests for your implementation
- Follow existing patterns in the codebase
- If stuck, describe the blocker clearly in your output
- Commit format: [project/sprint/ticket] description
