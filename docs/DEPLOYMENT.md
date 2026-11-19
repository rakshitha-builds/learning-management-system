# Deployment

## Topology

| Component | Suggested host | Notes |
|---|---|---|
| Frontend (static) | Vercel / Netlify / S3+CloudFront / the nginx image | Build arg `VITE_API_URL` = public API URL |
| API + Socket.IO | Render / Railway / Fly.io / EC2 / ECS | Needs WebSocket support and `ffmpeg` (the Dockerfile installs it) |
| Video worker | Same image, command `node src/workers/videoWorker.js` | Scale horizontally; **requires `STORAGE_DRIVER=s3`** when API and worker run on different machines |
| MongoDB | MongoDB Atlas | Set `MONGO_URI` |
| Redis | Upstash / Redis Cloud / ElastiCache | Set `REDIS_URL` (BullMQ needs a persistent Redis) |
| Video storage + CDN | S3 + CloudFront | See SETUP.md |
| Live classes | LiveKit Cloud (or self-hosted) | `LIVEKIT_URL` (wss), key, secret |
| Payments | Razorpay | test keys → live keys later |

## Production checklist
1. `NODE_ENV=production`, strong `JWT_SECRET` (the server refuses to boot with the dev default).
2. `CLIENT_URL` = exact frontend origin(s); `API_BASE_URL` = public API URL (used in media/thumbnail links).
3. HTTPS everywhere (WebRTC camera/mic require a secure context) and `wss://` for LiveKit.
4. `STORAGE_DRIVER=s3` + CloudFront signed delivery; **local disk cannot be shared** between API and worker containers on different hosts.
5. Leave `ALLOW_SIMULATED_PAYMENTS` unset (defaults to off in production) and configure Razorpay keys; register the webhook.
6. Seed only on a throwaway database — `npm run seed` wipes data. Create the first admin through a one-off script / DB insert, never via the public API.
7. Back up MongoDB; set log shipping from the JSON logs (winston outputs JSON in production).

## Docker Compose (single VM)
```bash
cp .env.example .env     # JWT_SECRET, public URLs (API_PUBLIC_URL etc.), Razorpay/S3/CloudFront values
docker compose up --build -d
```
Put a reverse proxy (Caddy/nginx) in front for TLS. Update `API_PUBLIC_URL`, `CLIENT_PUBLIC_URL`, `LIVEKIT_PUBLIC_URL` to the public hostnames and rebuild the frontend (the API URL is baked in at build time).

## Free-tier demo recipe
Atlas M0 + Upstash Redis + Render (API + worker as two services from `backend/`) + Vercel (frontend, env `VITE_API_URL`) + LiveKit Cloud free tier. Use `STORAGE_DRIVER=s3` (or run only one service that hosts both API and worker for a local-disk demo).
