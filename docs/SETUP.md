# Setup guide

Two ways to run the project: **Docker (easiest)** or **manual (Windows/PowerShell, macOS, Linux)**.

## A. Docker Compose

```bash
cp .env.example .env                 # set JWT_SECRET to a long random string
docker compose up --build -d         # mongo, redis, livekit, api, worker, frontend
docker compose --profile seed run --rm seed     # demo data (wipes the DB)
```
Open <http://localhost:5173> · API <http://localhost:5000/api/health> · LiveKit `ws://localhost:7880`.

## B. Manual setup (Windows / PowerShell)

1. **Node.js 18+** — <https://nodejs.org>
2. **MongoDB** — install MongoDB Community, **or** `docker run -d --name mongo -p 27017:27017 mongo:7`
3. **Redis** (BullMQ) — Redis has no native Windows build, so use Docker: `docker run -d --name redis -p 6379:6379 redis:7`  (or WSL2 `sudo apt install redis-server`)
4. **FFmpeg** — `winget install Gyan.FFmpeg`, reopen PowerShell, verify `ffmpeg -version` and `ffprobe -version`. If it is not on PATH set `FFMPEG_PATH` / `FFPROBE_PATH` in `backend/.env`.
5. **LiveKit** — see below.
6. Install and configure:
   ```powershell
   .\scripts\setup.ps1        # creates .env files and runs npm install
   cd backend; npm run seed   # demo data
   ```
7. Run three terminals:
   ```powershell
   cd backend;  npm run dev      # API + Socket.IO  → http://localhost:5000
   cd backend;  npm run worker   # BullMQ/FFmpeg worker (REQUIRED for video processing)
   cd frontend; npm run dev      # React app        → http://localhost:5173
   ```

### Demo accounts (after `npm run seed`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@learnsphere.dev` | `Admin@123` |
| Instructor | `priya@learnsphere.dev` (also `arjun@`, `neha@`) | `Instructor@123` |
| Student | `rakshitha@learnsphere.dev` (also `aarav@`, `diya@`, …) | `Student@123` |

## Database setup
No manual schema step: Mongoose creates collections and indexes on first connect. `npm run seed` **drops the configured database** then loads users, 8 published courses (+1 pending, +1 rejected), curriculum, playable demo HLS videos (generated with FFmpeg), quizzes, enrolments with progress, payments in all three states, instructor revenue, certificates, live classes with chat, and notifications.

## Redis & FFmpeg
Redis holds the BullMQ queue (`video-processing`). The **worker process must be running** or uploads stay `queued` (the API says so honestly). FFmpeg/ffprobe must be on PATH: the API uses ffprobe to validate uploads, the worker uses ffmpeg to transcode.

## LiveKit (live classes)
The app never fakes a class: without LiveKit credentials *Start class* returns `503 LiveKit is not configured`.

* **Local (recommended)** – dev server with fixed keys:
  ```bash
  docker run --rm -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
    -e LIVEKIT_KEYS="devkey: secret-secret-secret-secret-secret-1234" livekit/livekit-server --dev
  ```
  `backend/.env`: `LIVEKIT_URL=ws://localhost:7880`, `LIVEKIT_API_KEY=devkey`, `LIVEKIT_API_SECRET=secret-secret-secret-secret-secret-1234`.
* **LiveKit Cloud** – create a project at <https://cloud.livekit.io>; copy the `wss://…livekit.cloud` URL, API key and secret into `.env`.
* Test with two browsers: instructor *Start class*, student (enrolled) *Join*. Allow mic/camera. `localhost` counts as a secure context; on a LAN/production use HTTPS.

## Razorpay (payment gateway, test mode)
1. Create a free account → <https://dashboard.razorpay.com> → switch to **Test Mode** → *Settings → API Keys → Generate Test Key*.
2. `RAZORPAY_KEY_ID=rzp_test_…`, `RAZORPAY_KEY_SECRET=…` in `backend/.env`; restart the API. `/api/payments/config` now reports `razorpay`.
3. Use Razorpay's test card (e.g. `4111 1111 1111 1111`, any future expiry, any CVV; OTP `1234` where asked) — see Razorpay's *Test cards* docs.
4. Webhook (optional, for deployed API): *Settings → Webhooks* → `https://<api>/api/payments/webhook`, events `payment.captured`, `payment.failed`, set a secret → `RAZORPAY_WEBHOOK_SECRET`. Locally expose with `ngrok http 5000`.
Without keys the app uses the **simulated** gateway (UI shows an amber "Simulated test gateway" panel).

## AWS S3 + CloudFront (optional, for deployment)
Local development does **not** need AWS. To deliver video through CloudFront:

1. **S3 bucket** (private, "Block all public access" ON), same region as `AWS_REGION`.
2. **IAM user/role** with `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket` on the bucket → `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`.
3. **CloudFront distribution**, origin = the bucket with **Origin Access Control (OAC)**; apply the bucket policy CloudFront suggests. Allowed methods GET/HEAD/OPTIONS; add a response-headers policy allowing CORS from your frontend origin.
4. **Signed access:** create a *public key* (`openssl genrsa -out private.pem 2048 && openssl rsa -in private.pem -pubout -out public.pem`), upload `public.pem` in CloudFront → *Key management → Public keys*, create a **Key group**, and set it as *Trusted key group* on the behaviour with **"Restrict viewer access: Yes"**.
5. Environment:
   ```
   STORAGE_DRIVER=s3
   AWS_S3_BUCKET=my-lms-bucket
   CLOUDFRONT_DOMAIN=dxxxxxxxx.cloudfront.net
   CLOUDFRONT_KEY_PAIR_ID=K2XXXXXXXXXXXX        # the public key ID
   CLOUDFRONT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
   ```
6. Check `GET /api/config` → `"cloudfront": true`. Playback descriptors then have `"provider": "cloudfront"`.

> **Honesty note:** the S3 adapter and CloudFront signer are implemented following the AWS SDK documentation but could not be exercised without AWS credentials during development. `/api/config` reports `cloudfront: false` until all CloudFront variables are present, and the app falls back to token-secured API streaming — it never claims CloudFront is active when it is not.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Upload stays **Waiting in the BullMQ queue** | Worker not running (`npm run worker`) or Redis down |
| `Video was uploaded but the processing queue is unavailable` | Start Redis |
| `ffprobe failed` / not a valid video | Install FFmpeg, ensure `ffprobe` on PATH |
| Start class → `LiveKit is not configured` / `Could not reach the LiveKit server` | Start LiveKit and set the three `LIVEKIT_*` variables; restart API |
| Joined but no audio/video | Allow browser permissions; ensure UDP 7882/TCP 7881 reachable |
| `CORS` errors | `CLIENT_URL` must equal the frontend origin exactly |
| Port 5000 busy (macOS AirPlay) | Set `PORT=5001` and `VITE_API_URL=http://localhost:5001` |
