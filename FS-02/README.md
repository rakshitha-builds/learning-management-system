# Real-Time Collaborative Workspace (Notion / Figma style)

A full-stack collaborative workspace: several people edit the same page at once, see each other's cursors,
discuss in comment threads, manage workspaces/roles and roll back to any earlier version — without ever losing changes.

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, TipTap (ProseMirror) |
| Real-time | Yjs (CRDT), custom y-websocket-protocol server on `ws`, awareness (presence/cursors) |
| Backend | Node.js + Express REST API, Zod validation, JWT (httpOnly cookie), bcrypt |
| Data | PostgreSQL + Prisma ORM (v7) |
| Scaling | Redis pub/sub (document updates, presence, events, permission changes) across N backend instances |

> **Repository layout**
> `frontend/` Next.js app · `backend/` API + WebSocket collaboration server · `prisma/` schema & SQL migrations ·
> `tests/` automated tests · `docs/` architecture, API & testing docs · `scripts/` helper scripts · `docker-compose.yml` PostgreSQL + Redis

---

## 1. Requirements

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | **22 LTS** (≥ 20.19) | https://nodejs.org – includes npm |
| **PostgreSQL** | 14+ (16 recommended) | native installer **or** Docker |
| **Redis** | 6+ (7 recommended) | *Optional locally* – see §3. Docker, WSL, or Memurai on Windows |
| Git | any | optional |

## 2. Quick start (Windows / PowerShell, VS Code terminal)

```powershell
# 0. open the extracted folder in VS Code, then open a terminal (Ctrl+`)
cd Real_Time_Collaborative_Workspace

# 1. create .env with freshly generated secrets (never overwrites an existing .env)
npm run setup:env

# 2. start PostgreSQL + Redis (pick ONE of: Docker below, or the manual options in §3)
docker compose up -d

# 3. install all dependencies (frontend + backend, one command) – also generates the Prisma client
npm install

# 4. create the database tables
npm run db:migrate

# 5. run backend (http://localhost:4000) and frontend (http://localhost:3000) together
npm run dev
```

Open **http://localhost:3000**, create an account, create a workspace and a page.
To try collaboration: open a second browser (or a private window), register another user, invite them from
*Workspace → Settings & members*, then open the same page in both windows.

Run the two servers separately if you prefer two terminals: `npm run dev:backend` and `npm run dev:frontend`.

## 3. Setting up the external services

### Option A – Docker Desktop (easiest)
`docker compose up -d` starts PostgreSQL 16 and Redis 7 using the credentials generated into `.env`.
Stop with `docker compose down` (add `-v` to wipe the data).

### Option B – PostgreSQL installed natively (Windows)
1. Install PostgreSQL from https://www.postgresql.org/download/windows/ (remember the `postgres` superuser password).
2. Open **SQL Shell (psql)** or pgAdmin's query tool and run (use the `POSTGRES_PASSWORD` value from your `.env`):
   ```sql
   CREATE USER collab WITH PASSWORD 'PASTE_POSTGRES_PASSWORD_FROM_.env' CREATEDB;
   CREATE DATABASE collab_workspace OWNER collab;
   ```
   (`CREATEDB` lets the test-suite create its own `collab_workspace_test` database.)
3. If you use other names/ports, edit `DATABASE_URL` in `.env` accordingly.

### Option C – Redis without Docker
Redis is used to scale across several backend instances. **For a single backend instance it is optional:**
set `REDIS_URL=` (empty) in `.env` and the server runs in single-instance mode (everything else works identically;
the startup log says `redis: disabled`).
To run Redis natively on Windows use **WSL** (`sudo apt install redis-server && redis-server`) or **Memurai**
(https://www.memurai.com, Redis-compatible), then keep `REDIS_URL=redis://localhost:6379`.

## 4. Environment variables (`.env`)

All configuration is in one root `.env` (see `.env.example`, every variable is documented there).
`npm run setup:env` generates `JWT_SECRET` and the database password for you. **No credentials are hardcoded anywhere.**
Key variables: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `BACKEND_PORT`, `FRONTEND_ORIGIN`, `BACKEND_URL`, `NEXT_PUBLIC_WS_URL`.

## 5. Useful commands

| Command | What it does |
|---|---|
| `npm run dev` | backend + frontend in watch mode |
| `npm run dev:backend2` | a **second** backend on port 4001 (to see Redis scaling – see §7) |
| `npm run db:migrate` | apply SQL migrations (`prisma migrate deploy`) |
| `npm run db:migrate:dev` | create/apply migrations while changing the schema |
| `npm run db:studio` | browse the database in Prisma Studio |
| `npm run build` / `npm run start:backend` / `npm run start:frontend` | production build and run |
| `npm run typecheck` | TypeScript check of both apps |
| `npm test` | backend/API/real-time/scaling test-suite (Vitest, needs PostgreSQL; Redis for the scaling test) |
| `npm run test:e2e` | real-browser two-user end-to-end test (needs the app running + Chrome) |
| `npm run load-test` | concurrency load test, prints latency percentiles |

## 6. Features

* **Auth** – registration, login/logout, bcrypt hashing, JWT in an httpOnly cookie, protected routes (middleware + API), profile page (name, bio, colour, password).
* **Workspaces** – create / edit / delete, invite by email (existing users join instantly; unknown emails join automatically when they register), role management, multiple pages per workspace.
* **Editor** – TipTap with bold / italic / underline / strike / highlight / colour, headings, bullet & numbered lists, quotes, code, links, images (upload or URL), alignment, undo/redo, live "Saved / Syncing / Offline" status. Every keystroke is persisted by the server (no manual save).
* **Real-time collaboration** – Yjs CRDT over WebSockets; concurrent edits merge without overwriting; state persisted in PostgreSQL (incremental updates + compaction).
* **Presence** – online avatars, coloured remote cursors with names, "X is editing" indicator.
* **Comments** – threads, replies, quote-the-selection, resolve/reopen, delete; updates pushed live to everyone.
* **Permissions** – workspace roles **Owner / Editor / Commenter / Viewer** plus per-page overrides. Enforced on the server for REST *and* WebSocket (viewers' document updates are dropped); role changes take effect live.
* **Version history** – manual named snapshots + automatic snapshots, text preview, one-click restore (applied as a normal CRDT edit so all connected users update instantly; the pre-restore state is saved first).
* **Redis** – cross-instance fan-out of document updates, presence, comment/version events and permission changes; shared rate limiting.
* **UI/UX** – landing page, auth pages, dashboard, workspace sidebar, settings, profile, skeleton loaders, empty states, toasts, responsive/mobile layout.

## 7. Seeing Redis scaling locally

```powershell
npm run dev:backend      # instance 1 on :4000   (the frontend talks to this one)
npm run dev:backend2     # instance 2 on :4001
```
Users connected to different instances still see each other's edits and cursors. The automated test `tests/scaling.test.ts`
proves this (two servers, two clients), and `npm run load-test` can spread clients over both instances
(`BACKENDS=http://localhost:4000,http://localhost:4001`). In production put a load balancer in front of N backends sharing the same PostgreSQL and Redis.

## 8. Documentation

* [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) – diagrams, data model, how sync / persistence / scaling / permissions work, design decisions
* [`docs/API.md`](docs/API.md) – REST + WebSocket reference
* [`docs/TESTING.md`](docs/TESTING.md) – test strategy, **actual results**, how to run, manual test plan, known limitations
* `docs/screenshots/` – screenshots captured by the browser E2E test

## 9. Troubleshooting

| Symptom | Fix |
|---|---|
| `Missing required environment variable DATABASE_URL` | run `npm run setup:env` (creates `.env`) |
| `password authentication failed` | the DB user/password in `DATABASE_URL` must match what you created (§3) |
| `Can't reach database server` | PostgreSQL isn't running / wrong port |
| Backend logs `[redis:pub] ECONNREFUSED` | start Redis or set `REDIS_URL=` (empty) for single-instance mode |
| Editor shows "Offline – reconnecting…" | backend not running on `NEXT_PUBLIC_WS_URL` (default `ws://localhost:4000`) |
| Port already in use | change `BACKEND_PORT` (and `BACKEND_URL`/`NEXT_PUBLIC_WS_URL`), or free port 3000 |
| `prisma migrate` can't download engines | Prisma downloads a migration engine on first use – needs internet access to `binaries.prisma.sh` (corporate proxies: set `HTTPS_PROXY`) |

## 10. Security notes

Passwords hashed with bcrypt (cost 12); sessions are JWTs in `httpOnly`, `SameSite=Lax` cookies (set `COOKIE_SECURE=true` behind HTTPS);
WebSocket auth uses a separate short-purpose token (a session token is rejected there); all input validated with Zod; helmet headers;
auth endpoints rate-limited (Redis-backed); uploads restricted to PNG/JPEG/GIF/WebP (SVG deliberately rejected) with size limits.
See *Known limitations* in `docs/TESTING.md`.
