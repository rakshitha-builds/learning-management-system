# Architecture

## System architecture

```mermaid
flowchart LR
  subgraph Browser
    SPA["React + Vite SPA<br/>Redux Toolkit / RTK Query<br/>hls.js · livekit-client · socket.io-client"]
  end
  subgraph Backend["Node.js backend"]
    API["Express REST API<br/>JWT + RBAC + Zod validation"]
    WS["Socket.IO<br/>live-class chat"]
    WORKER["BullMQ worker<br/>FFmpeg transcoding"]
  end
  MONGO[("MongoDB<br/>15 collections")]
  REDIS[("Redis<br/>BullMQ queue")]
  STORE[["Storage adapter<br/>local disk | AWS S3"]]
  CF["AWS CloudFront<br/>signed URLs"]
  LK["LiveKit server<br/>WebRTC SFU"]
  RZP["Razorpay<br/>test mode"]

  SPA -- "REST /api (JWT)" --> API
  SPA -- "WebSocket" --> WS
  SPA -- "WebRTC audio/video" --> LK
  SPA -- "HLS segments" --> CF
  SPA -. "local dev: /media/:token/*" .-> API
  SPA -- "Checkout (hosted)" --> RZP
  API --> MONGO
  API -- "enqueue job" --> REDIS
  REDIS --> WORKER
  WORKER --> MONGO
  WORKER --> STORE
  API --> STORE
  STORE -. "origin" .-> CF
  API -- "create room / access tokens" --> LK
  RZP -- "webhook (HMAC)" --> API
```

## Folder structure

```
learning-management-system/
├── backend/
│   ├── src/
│   │   ├── config/        env (feature flags), db, redis, logger, constants
│   │   ├── models/        15 Mongoose schemas (+ ActivityLog)
│   │   ├── validators/    Zod request schemas
│   │   ├── middleware/    auth/RBAC, validate, rate-limit, upload, error handler
│   │   ├── controllers/   thin HTTP handlers
│   │   ├── services/      business logic: video, storage adapters, payments, quiz, progress, certificates, LiveKit
│   │   ├── workers/       BullMQ video worker
│   │   ├── routes/        route table
│   │   ├── socket/        Socket.IO chat
│   │   └── utils/         ApiError, token, access helpers, pagination
│   ├── scripts/           seed.js, makeSampleVideo.js
│   └── tests/             Jest + Supertest (real MongoDB, Redis, FFmpeg)
├── frontend/src/
│   ├── app/               Redux store, RTK Query API, slices
│   ├── components/        UI kit, layouts, charts, video player, checkout
│   ├── pages/             public · student · instructor · admin · shared
│   └── tests/             Vitest + Testing Library integration tests
├── docs/  tests/  scripts/  docker-compose.yml
```

Request flow: `route → [authenticate → authorize(role) → validate(zod)] → controller → service → model`.

## Video upload and processing pipeline

```mermaid
sequenceDiagram
  actor I as Instructor
  participant API as Express API
  participant S as Storage adapter
  participant Q as BullMQ (Redis)
  participant W as Worker (FFmpeg)
  participant DB as MongoDB
  I->>API: POST /videos/upload (multipart, XHR progress)
  API->>API: multer type/size check + ffprobe validates real video
  API->>S: store original  uploads/<id>/original.mp4
  API->>DB: VideoAsset(status=queued)
  API->>Q: add job (attempts=3, exponential backoff)
  API-->>I: 202 Accepted
  Q->>W: job
  W->>S: download source
  W->>W: ffprobe metadata → HLS 360p/720p(/1080p) + master.m3u8 + thumbnail
  W->>S: upload videos/<id>/...
  W->>DB: status=ready, progress=100, metadata, lesson.duration
  Note over W,DB: on failure: BullMQ retries; after the last attempt status=failed + notification; instructor can Retry
  I->>API: polls course (status, progress %)
```

**Secure delivery.** `GET /lessons/:id/playback` checks enrolment/ownership, then returns:
* **CloudFront configured** – a wildcard *custom-policy signed URL* for `videos/<asset>/*`; the player appends the signed query to every playlist/segment request.
* **Otherwise** – `/media/<JWT>/master.m3u8`; the JWT is scoped to one asset and expires (default 4 h). Works with local disk or S3 (API proxy, with HTTP Range support).

## Live class flow

```mermaid
sequenceDiagram
  actor T as Instructor
  actor S as Student
  participant API
  participant LK as LiveKit
  participant WS as Socket.IO
  T->>API: POST /live (schedule) → students notified
  T->>API: POST /live/:id/start
  API->>LK: createRoom(lms-<id>)
  S->>API: POST /live/:id/token (enrolled? class live?)
  API-->>S: LiveKit JWT (room-scoped grants)
  S->>LK: WebRTC connect (mic/camera, participant list)
  S->>WS: chat:join / chat:message (persisted in ChatMessage)
  T->>API: POST /live/:id/end → room deleted, live:ended broadcast
```

## Payment flow (test mode)

```mermaid
sequenceDiagram
  actor S as Student
  participant API
  participant G as Razorpay Checkout (hosted)
  S->>API: POST /payments/checkout → Payment(pending) + order_id
  S->>G: pays in hosted checkout (no card data touches LMS)
  G-->>S: payment_id + signature
  S->>API: POST /payments/verify
  API->>API: HMAC-SHA256(order|payment, secret) timing-safe compare
  API->>API: atomic pending→success → Enrollment + InstructorRevenue (80/20) + notifications
  G-->>API: webhook payment.captured/failed (raw-body HMAC) — idempotent
```
Without Razorpay keys the API runs a clearly labelled **simulated** gateway (`gateway: "simulated"`), disabled in production unless `ALLOW_SIMULATED_PAYMENTS=true`.

## Database ER diagram

```mermaid
erDiagram
  USER ||--o{ COURSE : teaches
  USER ||--o{ ENROLLMENT : "student enrols"
  COURSE ||--o{ ENROLLMENT : has
  COURSE ||--o{ MODULE : contains
  MODULE ||--o{ LESSON : contains
  LESSON ||--o| VIDEOASSET : "has video"
  COURSE ||--o{ QUIZ : has
  QUIZ ||--o{ QUESTION : has
  QUIZ ||--o{ QUIZATTEMPT : attempted
  USER ||--o{ QUIZATTEMPT : takes
  COURSE ||--o{ LIVECLASS : schedules
  USER ||--o{ LIVECLASS : hosts
  LIVECLASS ||--o{ CHATMESSAGE : has
  USER ||--o{ CHATMESSAGE : sends
  USER ||--o{ CERTIFICATE : earns
  COURSE ||--o{ CERTIFICATE : issues
  USER ||--o{ PAYMENT : pays
  COURSE ||--o{ PAYMENT : "paid for"
  PAYMENT ||--o| INSTRUCTORREVENUE : "splits into"
  USER ||--o{ INSTRUCTORREVENUE : earns
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ ACTIVITYLOG : performs
  ENROLLMENT }o--o| PAYMENT : "paid via"

  USER { string name string email string role string status }
  COURSE { string title string category string level number price string approvalStatus bool isPublished }
  ENROLLMENT { array lessonProgress string status date completedAt }
  VIDEOASSET { string status number progress string hlsKey object metadata array renditions }
  QUIZ { number durationMinutes number passingMarks number totalMarks }
  QUESTION { string text array options number correctIndex number marks }
  QUIZATTEMPT { array answers number score number percentage bool passed }
  LIVECLASS { date scheduledAt string status string roomName }
  CERTIFICATE { string certificateId string studentName string courseTitle }
  PAYMENT { number amount string status string gateway string orderId }
  INSTRUCTORREVENUE { number grossAmount number platformFee number netAmount string month }
```

Key indexes: `Enrollment(student,course)` unique · `Certificate(student,course)` unique · `Certificate.certificateId` unique · `InstructorRevenue.payment` unique (idempotent revenue) · `Course` text index + `(isPublished,approvalStatus,createdAt)` · `QuizAttempt(quiz,student,createdAt)` · `Notification(user,read,createdAt)` · `LiveClass.roomName` unique-sparse.

## Role-based access

| Capability | Student | Instructor | Admin |
|---|:-:|:-:|:-:|
| Browse / enrol / watch / quizzes / progress / certificates | ✔ | – | – |
| Create, edit, delete **own** courses, upload videos, quizzes, schedule & host live classes | – | ✔ | – |
| Revenue dashboard + own transactions | – | ✔ | – |
| Approve / reject courses, manage users, monitor enrolments & transactions, platform stats | – | – | ✔ |

Enforced in three layers: route-level `authorize(...)`, controller-level ownership/enrolment checks, and the React `ProtectedRoute` (UX only — the server is the authority).

## Security measures

bcrypt (cost 12) · JWT with expiry · suspended accounts rejected on every request · Zod validation on every mutating route · helmet · CORS allow-list · rate limiting (stricter on auth) · path-traversal guard on media routes · no card data stored · webhook + checkout HMAC verification with timing-safe compare · quiz answer key never serialised to students · admin role impossible to self-register · secrets only via environment variables.
