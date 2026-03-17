# Deployment Guide — RepReady on Render

RepReady is deployed on [Render](https://render.com) via Docker image. No Git repository is linked — only the built Docker image is pushed to Docker Hub, then Render pulls and runs it. Source code is never exposed to the hosting platform.

**Production URL:** https://repready.onrender.com
**Docker Image:** docker.io/rajupetap/repready:latest

## Why Render (not Vercel)

RepReady uses in-memory session state for real-time coaching. Vercel's serverless functions are stateless — each API call can run in a different function instance, losing session data. Render runs a single persistent process where in-memory state works correctly.

## Prerequisites

1. **Docker** installed locally (`docker --version` to verify)
2. **Docker Hub account** at https://hub.docker.com (free, for hosting the image)
3. **Render account** at https://render.com (free, no credit card needed)

## Setup — Step by Step

### 1. Login to Docker Hub

```bash
docker login
```

Enter your Docker Hub username and password (or access token).

### 2. Build and Push the Docker Image

```bash
DOCKER_USERNAME=yourusername ./scripts/deploy.sh
```

This builds the production image locally and pushes it to Docker Hub. Your source code is NOT included in the final image — only the compiled Next.js standalone output.

Or manually:

```bash
docker build -t repready .
docker tag repready yourusername/repready:latest
docker push yourusername/repready:latest
```

### 3. Create a Web Service on Render

1. Go to https://dashboard.render.com
2. Click **New** → **Web Service**
3. Select **Deploy an existing image from a registry**
4. Enter image URL: `docker.io/yourusername/repready:latest`
5. Configure:
   - **Name**: `repready`
   - **Region**: Pick the closest to your users
   - **Instance Type**: **Free**
6. Click **Create Web Service**

### 4. Set Environment Variables

In the Render dashboard for your service:

1. Go to **Environment** tab
2. Add:
   - `ANTHROPIC_API_KEY` = your Anthropic API key
3. Click **Save Changes** (triggers a redeploy)

### 5. Verify Deployment

Once deployed, Render gives you a URL like `https://repready.onrender.com`.

Test the health endpoint:
```bash
curl https://repready.onrender.com/api/health
```

## Subsequent Deploys

After making code changes locally:

```bash
DOCKER_USERNAME=yourusername ./scripts/deploy.sh
```

Then in the Render dashboard, click **Manual Deploy** → **Deploy latest image** (or enable auto-deploy from the registry).

## Useful Commands

| Command | Description |
|---------|-------------|
| `docker build -t repready .` | Build image locally |
| `docker run -p 3000:10000 -e ANTHROPIC_API_KEY=sk-... repready` | Test locally |
| `DOCKER_USERNAME=you ./scripts/deploy.sh` | Build + push to Docker Hub |
| `docker images repready` | Check local image size |

## Free Tier Details

- **750 instance-hours/month** (enough for 1 service running 24/7)
- Sleeps after **15 minutes** of inactivity
- ~60 second cold start when waking up
- Custom domains supported
- HTTPS included

## Architecture

```
Local machine                    Docker Hub                 Render
┌──────────────┐   docker push   ┌──────────────┐   pull   ┌──────────────┐
│ Source code   │───────────────→ │ Docker image  │────────→ │ Running app  │
│ + Dockerfile  │                 │ (compiled     │         │ (single      │
│              │                 │  only, no src) │         │  process)    │
└──────────────┘                 └──────────────┘         └──────────────┘
```

- **Dockerfile**: Multi-stage build — final image contains only compiled output, no source
- **next.config.ts**: `output: "standalone"` for minimal production bundle
- **render.yaml**: Render service definition (optional, for Blueprint deploys)
- **scripts/deploy.sh**: One-command build + push
- **Port 10000**: Render's default port for free tier services

## Environment Variables

Sensitive keys (like `ANTHROPIC_API_KEY`) are set in the Render dashboard under the **Environment** tab. They are encrypted and never committed to the repository.

## Testing Locally with Docker

```bash
docker build -t repready .
docker run -p 3000:10000 -e ANTHROPIC_API_KEY=sk-ant-your-key repready
```

Then open http://localhost:3000

## Troubleshooting

- **Build fails**: Run `npm run build` locally first to check for errors
- **App crashes on Render**: Check the **Logs** tab in Render dashboard
- **API key issues**: Verify in Render dashboard → Environment tab
- **Cold start slow**: Free tier sleeps after 15 min; first request takes ~60s to wake
- **Port issues**: Render free tier requires port 10000 (configured in Dockerfile)
- **Image too large**: Multi-stage build keeps it small; check with `docker images repready`
