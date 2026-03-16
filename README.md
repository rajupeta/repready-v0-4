# RepReady v0.4

Real-time AI coaching web app for SDRs (Sales Development Representatives). Simulates live sales calls, streams transcript via SSE, detects coaching moments with a rules engine + Claude AI, and generates post-call scorecards.

## Tech Stack

- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript 5.7
- **AI:** Anthropic Claude API (`claude-haiku-4-5-20251001`)
- **Streaming:** Server-Sent Events (SSE)
- **Styling:** Tailwind CSS
- **Testing:** Jest + React Testing Library
- **Runtime:** Node.js 20+

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Setup

```bash
# Clone the repository
git clone https://github.com/rajupeta/repready-v0-4.git
cd repready-v0-4

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to use the app.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/sessions` | Create a new coaching session with a fixture ID |
| `POST` | `/api/sessions/:id/start` | Start transcript playback for a session |
| `GET` | `/api/sessions/:id/stream` | SSE event stream for real-time updates |
| `GET` | `/api/sessions/:id/scorecard` | Get the post-call scorecard |
| `GET` | `/api/fixtures` | List available transcript fixtures |
| `GET` | `/api/health` | Health check — returns `{ "status": "ok" }` |

## Architecture

### The v0/v1 Boundary

`TranscriptService.addLine()` is the single integration point between v0 and v1. In v0, `PlaybackService` calls it to simulate a live call from fixture data. In v1, a Deepgram webhook handler will call it with real transcription data. Everything downstream — rules evaluation, coaching prompts, scorecard generation, SSE streaming — remains unchanged between versions.

### Services

| Service | Responsibility |
|---------|---------------|
| **PlaybackService** | Loads fixture transcripts and emits lines on a timer (v0-only) |
| **TranscriptService** | Maintains a rolling 10-line window and full transcript history |
| **RulesEngine** | Evaluates coaching rules against the transcript window with per-rule cooldowns |
| **CoachingService** | Converts triggered rules into coaching prompts via Claude (one batched call per line) |
| **ScorecardService** | Generates a post-call scorecard using the full transcript via Claude |
| **EventBus** | Pub/sub event system for broadcasting session events to SSE clients |
| **SessionManager** | Orchestrates the full session lifecycle (create → start → complete) |

### SSE Event Types

| Event | Payload | Description |
|-------|---------|-------------|
| `transcript` | `{ line: TranscriptLine }` | New transcript line added |
| `coaching_prompt` | `{ prompt: CoachingPrompt }` | Real-time coaching suggestion |
| `session_complete` | `{ scorecard: Scorecard }` | Session ended, scorecard available |
| `heartbeat` | `{}` | Keep-alive signal (every 15s) |

## Coaching Rules

The rules engine evaluates 6 coaching rules against a rolling window of the last 10 transcript lines. Each rule has a cooldown period to prevent duplicate alerts.

| Rule ID | Name | Description | Cooldown |
|---------|------|-------------|----------|
| `talk-ratio` | Talk Ratio | Rep speaks more than 65% of lines in the rolling window | 30s |
| `long-monologue` | Long Monologue | Rep has 4+ consecutive lines without the prospect speaking | 45s |
| `no-questions` | No Questions Asked | Zero rep lines in the window contain a question mark | 60s |
| `filler-words` | Filler Words | Latest rep line contains 3+ filler words (um, uh, like, etc.) | 20s |
| `feature-dump` | Feature Dump | 3+ consecutive rep lines mention product/feature keywords without questions | 45s |
| `no-next-steps` | No Next Steps | Prospect expresses interest but rep doesn't propose a next step | 90s |

## Data Models

### TranscriptLine

```typescript
interface TranscriptLine {
  speaker: 'rep' | 'prospect';
  text: string;
  timestamp?: number;
}
```

### CoachingPrompt

```typescript
interface CoachingPrompt {
  ruleId: string;
  ruleName: string;
  message: string;
  timestamp: number;
}
```

### Scorecard

```typescript
interface Scorecard {
  entries: ScorecardEntry[];
  overallScore: number;  // 0–100
  summary: string;
}
```

### ScorecardEntry

```typescript
interface ScorecardEntry {
  ruleId: string;
  ruleName: string;
  assessment: 'good' | 'needs-work' | 'missed';
  comment: string;
}
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | — | Your Anthropic API key for Claude |
| `CLAUDE_MODEL` | No | `claude-haiku-4-5-20251001` | Claude model to use for coaching |
| `PORT` | No | `3000` | Server port |

## Testing

```bash
npm test
```

Tests use a multi-project Jest setup: Node environment for service tests (`*.test.ts`) and jsdom for component tests (`*.test.tsx`).

## Docker

```bash
docker compose up
```

This builds and starts the app in a container. Make sure your `.env` file is configured before running.
