# RepReady v0.4

Real-time AI coaching web app for SDRs (Sales Development Representatives).

## Prerequisites

- Node.js 20+
- npm 10+

## Install

```bash
npm install
```

## Configure

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Required | Default | Description |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | — | Your Anthropic API key for Claude |
| `CLAUDE_MODEL` | No | `claude-haiku-4-5-20251001` | Claude model to use for coaching |
| `PORT` | No | `3000` | Server port |

## Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Test

```bash
npm test
```

## Lint

```bash
npm run lint
```

## Build

```bash
npm run build
npm start
```

## API

| Endpoint | Method | Response |
|---|---|---|
| `/api/health` | GET | `{ "status": "ok" }` (200) |

## Project Structure

```
src/
├── app/            # Next.js App Router pages and API routes
│   └── api/
│       └── health/ # Health check endpoint
├── components/     # React UI components
├── fixtures/       # Test data and transcript fixtures
├── hooks/          # Custom React hooks
├── lib/            # Shared utilities
├── rules/          # Coaching rules definitions
├── services/       # Business logic services
├── types/          # TypeScript type definitions
└── __tests__/      # Test files
```
