# Testing

Everything below was **actually executed** during development (not just written). Environment used for the numbers:
Ubuntu 24.04 sandbox, **1 vCPU / 4 GB RAM**, Node 22, PostgreSQL 16, Redis 7, headless Chromium. A normal laptop is considerably faster.

## 1. Automated backend tests – `npm test` (Vitest)
Real PostgreSQL + real Redis, real HTTP and WebSocket traffic, using the same `y-websocket` client the browser uses.
The suite creates a separate `<db>_test` database and applies the SQL migrations from `prisma/migrations` to it (so it also validates the migration files); Redis logical DB 1 is used.

**Result: 24 / 24 passed** (≈ 31 s). With Redis disabled (`REDIS_URL=`): 22 passed, the 2 Redis-only scaling tests are skipped by design.

| File | Covers |
|---|---|
| `tests/api.test.ts` (12) | Registration (bcrypt hash stored, no hash in responses), duplicate/invalid input, login/logout, case-insensitive email, protected routes without session, profile update & password change, workspace lifecycle, invitations (existing user, unknown email → joins at sign-up), role changes, member removal/leave, per-document permission overrides, comments (create/reply/nesting rule/resolve/delete authorization), image upload (PNG ok; HTML & SVG rejected), error format for unknown route / malformed JSON, health |
| `tests/collab.test.ts` (10) | Two-client live sync · **concurrent edits merge (25 interleaved edits each, same paragraph + new paragraphs, no loss)** · presence/awareness incl. late joiner and leave · **persistence after all clients disconnect (refresh)** + compaction · **viewer & commenter updates are dropped by the server** · unauthenticated / non-member / forged / session-token-as-ws-token rejected · live permission demotion (socket closed 4403 → reconnects read-only) and removal · version snapshot → preview → restore propagates to all connected clients + "Before restore" safety copy + persisted · rich-format fidelity on restore (numeric attrs, marks) · push events delivery & authorization |
| `tests/scaling.test.ts` (2) | **Two backend instances + Redis**: both healthy with different instance ids · edits flow both ways · concurrent edits on different instances converge · presence crosses instances · no duplicate/missing persisted updates · snapshot/restore via instance 1 reaches a client on instance 2 |

## 2. Real-browser end-to-end – `npm run test:e2e`
Two **isolated browser contexts (two users)** drive the production build through the real UI (Playwright + Chromium). **17 / 17 steps passed:**

1. Route guard redirects anonymous users · 2. Alice registers · 3. Bob registers (separate session) · 4. Alice creates a workspace ·
5. Alice invites Bob (editor) · 6. Alice creates a page and types · 7. Bob opens it and sees Alice's text live ·
8. Bob's edits appear on Alice's screen and vice-versa · 9. **Both type simultaneously → identical documents, nothing lost** ·
10. **Bob's coloured cursor label + avatar visible to Alice** · 11. Heading / bold-list formatting syncs · 12. Comment + reply appear live on the other screen ·
13. **Content persists after a hard refresh** · 14. Save snapshot → edit → restore, both screens revert · 15. **Demoting Bob to Viewer makes his editor read-only live; his typing never reaches Alice** ·
16. 390 px phone viewport has no horizontal overflow · 17. Logout re-protects routes.

Screenshots from this run are in `docs/screenshots/`. (In my 1-vCPU sandbox the software-rendered browser made a few steps take 14–23 s; the API itself answered in 6–20 ms – measured separately through the Next.js proxy.)

## 3. Load / performance – `npm run load-test`
N simulated editors on **one document**, spread over **two backend instances linked by Redis**; each client writes an edit every ~150 ms; latency = writer timestamp → arrival at every other client (same machine, so clocks agree).

| Clients | Edits | Deliveries | Edits/s | Latency p50 | p95 | p99 | max | Converged |
|---|---|---|---|---|---|---|---|---|
| 20 | 500 | 9 500 / 9 500 (100 %) | 127 | 2 ms | 8 ms | 17 ms | 43 ms | yes |
| 50 | 1 000 | 49 000 / 49 000 (100 %) | 246 | 44 ms | 193 ms | 244 ms | 302 ms | yes |

These were measured with load generator, 2 backends, Postgres, Redis and Node all sharing **one** vCPU, so they are conservative. Not tested: >50 concurrent editors, multi-machine deployments, very large documents. The optional Project Gutenberg / Wikipedia text mentioned in the brief can be used via `SAMPLE_TEXT=path` (not downloaded in the sandbox; synthetic text was used).

## 4. Static checks
`tsc --noEmit` passes for backend and frontend; `next build` (production) succeeds. A Next.js **dev-server** run was also smoke-tested from a freshly extracted copy of the ZIP (see §6).

## 5. How to run
```powershell
npm test                 # backend suites (needs PostgreSQL; Redis optional)
npm run build; npm run start:backend    # terminal 1  (or: npm run dev)
npm run start:frontend                  # terminal 2
npm run test:e2e         # real-browser test; uses your installed Google Chrome (set E2E_BROWSER_PATH to use another)
npm run load-test        # needs a running backend (BACKENDS, CLIENTS, EDITS env vars; see header of tests/load-test.ts)
```

## 6. Verification of the delivered ZIP
The ZIP was extracted into a clean folder, `npm install` was run from scratch, both apps were type-checked and built, and the tests were re-run there (results recorded in the final hand-off message).

## 7. Manual test plan (for demos / the presentation)
1. Register two users in two browsers. 2. Create workspace, invite user 2. 3. Open the same page in both; type simultaneously – watch cursors and the "is editing" indicator. 4. Add and reply to a comment on a quoted selection. 5. Refresh both – content, comments persist. 6. Save a named version, make changes, restore. 7. Change user 2 to *Viewer* (and then to *Commenter*) – their editor locks immediately. 8. Page-level override via **Share**. 9. Stop/restart the backend while editing – the status pill shows *Offline* then reconnects and merges. 10. Start `npm run dev:backend2`, connect one browser's WebSocket to port 4001 (set `NEXT_PUBLIC_WS_URL`) – edits still sync via Redis.

## 8. Known limitations (honest list)
* **Not executed in my sandbox:** `prisma migrate deploy` (Prisma's migration-engine download host is blocked there) and `docker compose up` (no Docker). The initial migration SQL was written to Prisma's conventions and applied to PostgreSQL 16 directly (and via the test setup), and the Prisma client/queries are exercised by all tests, but please run `npm run db:migrate` on your machine as the first check. If a later `prisma migrate dev` reports drift, run `prisma migrate dev --name sync` once.
* Tested in headless Chromium only (not Firefox/Safari). No automated accessibility audit; labels/ARIA were added and one label bug was found and fixed by the E2E run.
* Awareness (cursor name/colour) is supplied by the client and not server-verified – a malicious collaborator could display a misleading name on their *cursor* (it cannot grant access or alter content beyond their role).
* Edits are persisted in batches of ≤ 250 ms; a hard server crash can lose that last sliver. A manual snapshot taken on instance B may miss ≤ 250 ms of edits still queued on instance A.
* Offline edits are kept in memory only (no IndexedDB): refreshing while offline loses unsynced work.
* Invitations are in-app only (no e-mail is sent – there is no SMTP service in scope). Unknown e-mails join automatically after registering with that address.
* `npm audit` reports advisories in transitive dependencies: TipTap 2.x (`mergeAttributes` prototype key – requires attacker-controlled attributes; fix needs the TipTap 3 migration) and the PostCSS copy bundled inside Next.js (build-time only). All Next.js advisories relevant to this app were resolved by using Next 15.5.
* Rate limiting covers the auth endpoints only. No CSRF token is used: cookies are `SameSite=Lax`, mutating calls require JSON bodies, and CORS is restricted to `FRONTEND_ORIGIN`.
