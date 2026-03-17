# Deployment Guide — RepReady on Vercel

RepReady is deployed on [Vercel](https://vercel.com) via CLI. No Git repository is linked — code is deployed directly from local machine and source code stays private.

**Production URL:** https://repready-v0-4.vercel.app

## Prerequisites

1. **Create a Vercel account** at https://vercel.com (no credit card needed — sign up with GitHub, GitLab, or email)
2. **Node.js 22+** installed

## Setup — Step by Step

### 1. Install Vercel CLI

```bash
npm install -g vercel
```

### 2. Login to Vercel

```bash
npx vercel login
```

This opens your browser for OAuth authentication. Once you see "Congratulations! You are now signed in." you're good to go.

Verify login:
```bash
npx vercel whoami
```

### 3. First-time Deploy

From the project directory:

```bash
cd repready-v0-4
npx vercel --yes
```

- The `--yes` flag auto-accepts default project settings (Next.js auto-detected)
- This creates the project on Vercel, uploads code, builds, and deploys
- A `.vercel/` directory is created locally to link the project (already in `.gitignore`)
- First deploy goes to production automatically

### 4. Set Environment Variables

Set the Anthropic API key (required for API routes):

```bash
npx vercel env add ANTHROPIC_API_KEY
```

- When prompted, select all environments: **Production**, **Preview**, **Development**
- Paste your API key value when prompted
- Keys are stored encrypted on Vercel and never exposed

Add any other environment variables the same way:

```bash
npx vercel env add VARIABLE_NAME
```

### 5. Redeploy with Environment Variables

After setting env vars, redeploy so they take effect:

```bash
npx vercel --prod
```

## Subsequent Deploys

After making code changes locally:

```bash
npx vercel --prod
```

This uploads, builds, and deploys to production in one command.

## Useful Commands

| Command | Description |
|---------|-------------|
| `npx vercel` | Preview deployment (staging URL) |
| `npx vercel --prod` | Production deployment |
| `npx vercel whoami` | Check logged-in user |
| `npx vercel env ls` | List environment variables |
| `npx vercel env add KEY` | Add an environment variable |
| `npx vercel env rm KEY` | Remove an environment variable |
| `npx vercel logs <url>` | View deployment logs |
| `npx vercel ls` | List all deployments |
| `npx vercel inspect <url>` | View deployment details |
| `npx vercel --prod --force` | Force a fresh build (no cache) |

## Free Tier (Hobby Plan)

- Unlimited deployments
- 100GB bandwidth/month
- Serverless function execution: 100GB-hours/month
- No cold starts
- Custom domains supported
- HTTPS included
- No credit card required

## Architecture

- **No Dockerfile needed** — Vercel natively builds and serves Next.js
- **No repo link** — deployed via CLI only, source code stays private
- **Serverless** — API routes run as serverless functions automatically
- **Edge network** — static assets served from CDN globally

## Environment Variables

Sensitive keys (like `ANTHROPIC_API_KEY`) are stored as encrypted environment variables on Vercel. They are never committed to the repository.

To list current variables:
```bash
npx vercel env ls
```

## Troubleshooting

- **Build fails**: Run `npm run build` locally first to check for errors
- **API key issues**: Verify with `npx vercel env ls` that `ANTHROPIC_API_KEY` is set, then redeploy with `npx vercel --prod`
- **Function timeout**: Vercel hobby plan has 60s max for serverless functions
- **Stale deploy**: Run `npx vercel --prod --force` to force a fresh build with no cache
- **Login expired**: Run `npx vercel login` again to re-authenticate
