# Testing

Everything below was executed during development; the numbers in the README come from real runs.

| Layer | Tool | Where | Needs |
|---|---|---|---|
| Backend API + services | Jest + Supertest | `backend/tests/*.test.js` | MongoDB, Redis, FFmpeg |
| LiveKit integration (optional) | Jest | `backend/tests/livekit-integration.test.js` | a running LiveKit server (`LIVEKIT_INTEGRATION=1`) |
| API smoke (seeded server) | Node script | `tests/e2e-smoke.js` | running + seeded API |
| Frontend integration | Vitest + Testing Library (jsdom) | `frontend/src/tests/smoke.test.jsx` | running + seeded API |

```bash
cd backend && npm test                  # MONGO_URI_TEST defaults to mongodb://127.0.0.1:27017/learnsphere_test (database is dropped!)
./scripts/run-all-tests.sh              # backend + seeded API smoke + frontend (macOS/Linux)
```
PowerShell: run `npm test` in `backend`, then `npm run seed`, start the API, then `node tests/e2e-smoke.js` and `npm test` in `frontend`.

## What the backend tests cover (mapped to the assignment)

| Requirement | Test file | Highlights |
|---|---|---|
| User registration, login, authentication | `auth.test.js` | bcrypt hash stored, no hash leak, duplicate 409, validation details, no self-registered admins, suspended users blocked |
| Role-based permissions | `rbac.test.js`, `admin.test.js` | 401/403 matrix, ownership checks, invalid ObjectId → 400 |
| Course creation, enrolment | `courses.test.js` | draft/approval/publish workflow, filters+pagination, free vs paid (402), duplicate 409, preview-lesson access, delete rules |
| Video processing jobs | `video.test.js` | real upload → BullMQ → FFmpeg → HLS files on disk; metadata; secure tokenised streaming incl. Range; forged token & traversal refused; failed-job retry + manual retry |
| Quiz grading | `quiz.test.js` | answers never leaked, auto-grading, pass/fail, timed-out submissions, resubmission blocked, history |
| Progress tracking | `progress-certificate.test.js` | 90 % auto-complete, monotonic watch time, completion %, dashboard series |
| Certificate generation | `progress-certificate.test.js` | eligibility rules, unique ID, valid `%PDF-`, ownership, public verification |
| Payment test transactions | `payments.test.js`, `payments-razorpay.test.js` | pending/success/failed, 80/20 split, idempotent double-capture, HMAC verify (valid/forged), webhook signature, no simulate in Razorpay mode |
| Live classes + chat | `live.test.js`, `live-unconfigured.test.js` | scheduling, access control, LiveKit token grants, Socket.IO broadcast+persistence, honest 503 when unconfigured |

### Not covered by automated tests (be upfront in the demo)
* A real browser WebRTC session (needs two browsers + LiveKit; test manually — see SETUP.md).
* Real Razorpay network calls (the SDK call is mocked; signature logic is real).
* AWS S3 / CloudFront (no credentials in CI).
* Visual/responsive layout (verified by build + DOM tests, not screenshots).
