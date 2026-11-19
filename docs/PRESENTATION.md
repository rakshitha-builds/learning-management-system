# 10-minute presentation kit

## Slide outline (≈1 min each)
1. **Problem** — fragmented tools for videos, live classes, quizzes, certificates, payments.
2. **Solution & roles** — LearnSphere: student / instructor / admin (show the three dashboards side by side).
3. **Architecture** — diagram from ARCHITECTURE.md; say *why* each piece exists (Redis/BullMQ = async video jobs, LiveKit = WebRTC SFU, adapter = local vs S3).
4. **Live demo A (instructor)** — create course → add lesson → **upload video** → watch progress/status → quiz → submit for review.
5. **Live demo B (admin)** — approve course; show stats & transactions.
6. **Live demo C (student)** — enrol/pay (test) → watch (resume) → quiz auto-graded → certificate PDF → verify page.
7. **Live demo D** — two browsers: instructor *Start class*, student *Join*, chat, mic/camera, participants. (Have a screen-recorded backup.)
8. **Engineering** — validation, RBAC (3 layers), idempotent payments, secure media tokens, honest integrations.
9. **Testing & results** — 101 backend + 25 frontend + 22 smoke tests; real FFmpeg/LiveKit; what is *not* automated.
10. **Challenges, learnings, next steps.**

## Suggested demo script (5 min)
`docker compose up` → seed → login as instructor (priya) → upload `backend/tmp/sample.mp4` (generate with `node backend/scripts/makeSampleVideo.js`) → watch status go queued → processing → ready → admin approves the pending seeded course → student (rakshitha) completes a lesson & quiz → certificate → `/verify/<id>` → live class.

## Challenges you can talk about (all real in this code)
* HLS segments can't carry a bearer header → path-embedded, asset-scoped JWT (`/media/:token/*`) and CloudFront wildcard signed URLs with the player appending the query to every request.
* Payment idempotency → atomic `pending→success` `findOneAndUpdate` + unique `InstructorRevenue.payment` index; verified with concurrent calls in a test.
* Never leaking quiz answers → separate student/manager serializers; test asserts the JSON never contains `correctIndex`.
* Honest integrations → capability flags (`/api/config`), 503s with setup guidance, a labelled simulator.
* Test race found by running the full suite repeatedly (worker saved `failed` before notifying) → test now waits for the notification.

## Likely interview questions → where to look
| Question | Answer / code |
|---|---|
| How do you prevent a student from accessing another role's data? | `middleware/auth.js` (`authorize`), ownership helpers in `utils/access.js`, tests in `rbac.test.js` |
| What happens if FFmpeg fails? | BullMQ `attempts: 3` + exponential backoff; `videoWorker.js` marks `failed` after the last attempt, notifies instructor; `POST /videos/:id/retry` |
| Why a queue instead of processing in the request? | Transcoding takes minutes; request would time out; queue gives retries, concurrency control, restart safety |
| How is video secured? | Playback endpoint checks enrolment; scoped short-lived JWT or CloudFront signed policy; raw files never public |
| How do live classes work? | API creates a LiveKit room and issues room-scoped JWTs; browser connects via WebRTC to LiveKit SFU; Socket.IO carries chat |
| How is payment verified? | HMAC-SHA256 of `order_id|payment_id` with the secret, timing-safe compare; webhook verified on the raw body |
| Why RTK Query? | Caching, tag invalidation, loading/error states without hand-written thunks |
| What would you improve? | See *Known limitations* / *Future enhancements* in the README |

## Individual reflection (write this yourself — it must be in your own words)
Prompts: *What did I own? What was hardest and how did I debug it? What would I do differently? Which concepts (queues, WebRTC, idempotency, RBAC) do I now understand?*

## Suggested commit history (clean, reviewable)
```
chore: project structure, env config and tooling
feat(db): mongoose models and indexes
feat(auth): registration, login, JWT and role middleware
feat(courses): course/module/lesson APIs and enrolment
feat(video): upload validation, storage adapter, BullMQ worker, FFmpeg HLS
feat(quiz): quizzes, auto-grading and attempts
feat(progress): lesson progress, completion and dashboard summary
feat(cert): PDF certificates with QR and public verification
feat(live): LiveKit rooms/tokens and Socket.IO chat
feat(payments): Razorpay test mode, simulator, revenue split and dashboard
feat(admin): moderation, user management and stats
feat(ui): design system, layouts and student/instructor/admin dashboards
test: backend, API smoke and frontend integration tests
docs: README, architecture, API, setup, deployment
chore(docker): compose stack and Dockerfiles
```
