# REST API reference

_Generated from `backend/src/routes/index.js` — 79 endpoints. Regenerate with `node scripts/gen-api-docs.js`._

## Conventions

* Base URL: `http://localhost:5000`. All JSON endpoints live under `/api`.
* **Auth:** `Authorization: Bearer <JWT>` (obtained from `/api/auth/login` or `/api/auth/register`).
* **Success:** `{ "success": true, "data": ..., "meta"?: { total, page, limit, pages } }`
* **Error:** `{ "success": false, "message": "...", "details"?: [{ "field", "message" }] }`
* **Status codes:** `200` OK · `201` created · `202` accepted (video queued) · `400` validation · `401` not logged in · `402` payment required · `403` wrong role / not owner / not enrolled · `404` not found · `409` conflict (duplicate, wrong state) · `429` rate limited · `503` integration not configured (LiveKit / payment gateway / queue).
* **Access column:** the roles allowed. The *owner* rule (e.g. an instructor may only change **their own** course) is enforced in the controller on top of the role check.
* **Validation column:** the Zod schema in `backend/src/validators/index.js` applied to the request.
* Money is returned in **paise** (`amount`, revenue) — divide by 100 for rupees; course `price` is in rupees.
* Non-API routes: `GET /media/:token/*` (HLS streaming, token-authorised) · `GET /files/public/*` (thumbnails) · `POST /api/payments/webhook` (Razorpay, raw body + signature).

## Platform

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `GET` | `/api/health` | Public | — |

## Auth

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | auth.register rate-limited |
| `POST` | `/api/auth/login` | Public | auth.login rate-limited |
| `GET` | `/api/auth/me` | Any logged-in user | — |
| `PATCH` | `/api/auth/me` | Any logged-in user | auth.updateProfile |

## Courses

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `GET` | `/api/categories` | Public | — |
| `GET` | `/api/courses` | Public | query:course.list |
| `GET` | `/api/courses/mine` | instructor | — |
| `POST` | `/api/courses` | instructor | course.create |
| `GET` | `/api/courses/:id` | Optional login | — |
| `PUT` | `/api/courses/:id` | instructor | course.update |
| `DELETE` | `/api/courses/:id` | instructor / admin | — |
| `POST` | `/api/courses/:id/submit` | instructor | — |
| `PATCH` | `/api/courses/:id/publish` | instructor | course.publish |
| `POST` | `/api/courses/:id/thumbnail` | instructor | — multipart `image` |
| `GET` | `/api/courses/:id/students` | instructor / admin | — |

## Modules & lessons

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `POST` | `/api/courses/:courseId/modules` | instructor | curriculum.module |
| `PUT` | `/api/modules/:id` | instructor | curriculum.moduleUpdate |
| `DELETE` | `/api/modules/:id` | instructor | — |
| `POST` | `/api/modules/:moduleId/lessons` | instructor | curriculum.lesson |
| `PUT` | `/api/lessons/:id` | instructor | curriculum.lessonUpdate |
| `DELETE` | `/api/lessons/:id` | instructor | — |
| `GET` | `/api/lessons/:id` | Optional login | — |
| `GET` | `/api/lessons/:id/playback` | Any logged-in user | — |

## Enrollment

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `POST` | `/api/enrollments` | student | payment.checkout |
| `GET` | `/api/enrollments/mine` | student | — |
| `GET` | `/api/enrollments/check/:courseId` | student | — |

## Videos

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `POST` | `/api/videos/upload` | instructor | — multipart `video`+`lessonId` |
| `GET` | `/api/videos/:id` | instructor / admin | — |
| `POST` | `/api/videos/:id/retry` | instructor / admin | — |
| `DELETE` | `/api/videos/:id` | instructor / admin | — |

## Quizzes

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `POST` | `/api/courses/:courseId/quizzes` | instructor | quiz.create |
| `GET` | `/api/courses/:courseId/quizzes` | Any logged-in user | — |
| `GET` | `/api/attempts/mine` | student | — |
| `GET` | `/api/attempts/:attemptId` | Any logged-in user | — |
| `POST` | `/api/attempts/:attemptId/submit` | student | quiz.submit |
| `GET` | `/api/quizzes/:id` | Any logged-in user | — |
| `GET` | `/api/quizzes/:id/manage` | instructor / admin | — |
| `PUT` | `/api/quizzes/:id` | instructor | quiz.create |
| `DELETE` | `/api/quizzes/:id` | instructor / admin | — |
| `POST` | `/api/quizzes/:id/attempts` | student | — |
| `GET` | `/api/quizzes/:id/attempts/mine` | student | — |
| `GET` | `/api/quizzes/:id/attempts` | instructor / admin | — |

## Progress

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `POST` | `/api/progress/lessons/:lessonId` | student | progress.lesson |
| `GET` | `/api/progress/summary` | student | — |
| `GET` | `/api/progress/history` | student | — |
| `GET` | `/api/progress/courses/:courseId` | student | — |

## Certificates

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `GET` | `/api/certificates/verify/:certificateId` | Public | — |
| `GET` | `/api/certificates/mine` | student | — |
| `POST` | `/api/certificates/course/:courseId` | student | — |
| `GET` | `/api/certificates/:id/download` | Any logged-in user | — |

## Live classes

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `POST` | `/api/live` | instructor | live.create |
| `GET` | `/api/live` | Any logged-in user | — |
| `GET` | `/api/live/:id` | Any logged-in user | — |
| `POST` | `/api/live/:id/start` | instructor | — |
| `POST` | `/api/live/:id/end` | instructor | — |
| `POST` | `/api/live/:id/cancel` | instructor / admin | — |
| `POST` | `/api/live/:id/token` | Any logged-in user | — |
| `GET` | `/api/live/:id/messages` | Any logged-in user | — |

## Payments

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `GET` | `/api/payments/config` | Any logged-in user | — |
| `POST` | `/api/payments/checkout` | student | payment.checkout |
| `POST` | `/api/payments/verify` | student | payment.verify |
| `POST` | `/api/payments/:id/fail` | student | payment.fail |
| `POST` | `/api/payments/:id/simulate` | student | payment.simulate |
| `GET` | `/api/payments/mine` | student | — |

## Instructor revenue

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `GET` | `/api/revenue/summary` | instructor | — |
| `GET` | `/api/revenue/transactions` | instructor | — |

## Notifications

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `GET` | `/api/notifications` | Any logged-in user | — |
| `PATCH` | `/api/notifications/read-all` | Any logged-in user | — |
| `PATCH` | `/api/notifications/:id/read` | Any logged-in user | — |

## Admin

| Method | Path | Access | Validation / notes |
|---|---|---|---|
| `GET` | `/api/admin/stats` | Admin | — |
| `GET` | `/api/admin/users` | Admin | query:listQuery |
| `POST` | `/api/admin/users` | Admin | admin.createUser |
| `PATCH` | `/api/admin/users/:id/status` | Admin | admin.userStatus |
| `GET` | `/api/admin/courses` | Admin | query:listQuery |
| `PATCH` | `/api/admin/courses/:id/review` | Admin | admin.review |
| `GET` | `/api/admin/enrollments` | Admin | query:listQuery |
| `GET` | `/api/admin/transactions` | Admin | query:listQuery |
| `GET` | `/api/admin/activity` | Admin | query:listQuery |

## Example requests

```bash
# Register + login
curl -X POST localhost:5000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"name":"Asha Rao","email":"asha@example.com","password":"Secret123","role":"student"}'

# Browse published courses (search, filter, sort, paginate)
curl 'localhost:5000/api/courses?q=react&level=beginner&price=paid&sort=popular&page=1&limit=9'

# Instructor: create a course, then upload a lesson video (multipart)
curl -X POST localhost:5000/api/courses -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Node.js Masterclass","description":"Build production-grade Node.js services.","category":"Web Development","level":"intermediate","price":999}'
curl -X POST localhost:5000/api/videos/upload -H "Authorization: Bearer $TOKEN" -F lessonId=<id> -F video=@lesson1.mp4

# Student: start + submit a quiz (answers are only revealed in the submit response)
curl -X POST localhost:5000/api/quizzes/<quizId>/attempts -H "Authorization: Bearer $TOKEN"
curl -X POST localhost:5000/api/attempts/<attemptId>/submit -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"answers":[{"questionId":"<id>","selectedIndex":1}]}'
```

## Socket.IO events (live-class chat)

Connect with `io(API_URL, { auth: { token } })`.

| Direction | Event | Payload |
|---|---|---|
| client → server | `chat:join` | `{ liveClassId }` (ack `{ ok }`) — only enrolled students, the host or admins |
| client → server | `chat:message` | `{ liveClassId, message }` (≤1000 chars; only while the class is `live`) |
| server → room | `chat:message` | saved `ChatMessage` document |
| server → room | `chat:presence` | `{ count }` |
| server → room | `live:started` / `live:ended` | `{ liveClassId }` |
