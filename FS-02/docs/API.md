# API reference

Base URL (via the Next.js proxy): `http://localhost:3000/api` – or the backend directly: `http://localhost:4000/api`.
Authentication: httpOnly cookie `cw_token` (set by register/login) **or** `Authorization: Bearer <session jwt>`.

**Responses**: success → `{ "data": … }` · error → `{ "error": { "code", "message", "details?" } }`.
Common codes: `400 VALIDATION_ERROR`/`BAD_REQUEST`, `401 UNAUTHORIZED`, `403 FORBIDDEN`, `404 NOT_FOUND` (also returned for resources you cannot see, so existence is not leaked), `409 CONFLICT`, `413 TOO_LARGE`, `429 RATE_LIMITED`.

## Auth
| Method & path | Body | Notes |
|---|---|---|
| `POST /auth/register` | `{name, email, password(≥8)}` | 201, sets cookie. Pending invitations for the email become memberships |
| `POST /auth/login` | `{email, password}` | same error for unknown email / wrong password |
| `POST /auth/logout` | – | clears cookie |
| `GET /auth/me` | – | current user |
| `GET /auth/ws-token` | – | 24 h token for WebSocket connections (rejected by REST) |
| `PATCH /users/me` | `{name?, bio?, color?(#rrggbb)}` | profile |
| `POST /users/me/password` | `{currentPassword, newPassword}` | |

## Workspaces
| Method & path | Role | Notes |
|---|---|---|
| `GET /workspaces` | any | the user's workspaces with `role`, `memberCount`, `documentCount` |
| `POST /workspaces` | any | `{name, description?, icon?}` – creator becomes OWNER |
| `GET /workspaces/:id` | member | `{workspace, members[], invites[] (owner only)}` |
| `PATCH /workspaces/:id` | owner | |
| `DELETE /workspaces/:id` | owner | cascades pages, comments, versions |
| `POST /workspaces/:id/members` | owner | `{email, role: EDITOR\|COMMENTER\|VIEWER}` → `status: "added"` (existing user) or `"invited"` |
| `PATCH /workspaces/:id/members/:userId` | owner | `{role}`; live sockets are re-authorized |
| `DELETE /workspaces/:id/members/:userId` | owner, or self (leave) | owner cannot be removed |
| `DELETE /workspaces/:id/invites/:inviteId` | owner | |

## Pages (documents)
| Method & path | Role | Notes |
|---|---|---|
| `GET /workspaces/:wid/documents` | viewer | list with preview text |
| `POST /workspaces/:wid/documents` | editor | `{title?, icon?}` |
| `GET /documents/:id` | viewer | includes your effective `role` |
| `PATCH /documents/:id` | editor | `{title?, icon?}` |
| `DELETE /documents/:id` | owner or creator | |
| `GET /documents/:id/permissions` | owner | members with workspace role, override and effective role |
| `PUT /documents/:id/permissions/:userId` | owner | `{role}` override for this page |
| `DELETE /documents/:id/permissions/:userId` | owner | back to workspace default |

## Comments
| Method & path | Role | Notes |
|---|---|---|
| `GET /documents/:id/comments` | viewer | top-level comments with `replies[]` and `author` |
| `POST /documents/:id/comments` | commenter | `{body, parentId?, quote?}` – replies are one level deep |
| `PATCH /comments/:id` | commenter | `{body?}` (author only) · `{resolved?}` (any commenter) |
| `DELETE /comments/:id` | author or owner | |

## Version history
| Method & path | Role | Notes |
|---|---|---|
| `GET /documents/:id/versions` | viewer | newest first (no snapshot bytes) |
| `POST /documents/:id/versions` | editor | `{label?}` manual snapshot of the live state |
| `GET /versions/:id` | viewer | metadata + plain-text preview |
| `POST /versions/:id/restore` | editor | replaces content for all connected users; saves a "Before restore" version first |

## Uploads & health
| Method & path | Role | Notes |
|---|---|---|
| `POST /uploads` | auth | multipart field `file`; PNG/JPEG/GIF/WebP ≤ `MAX_UPLOAD_MB`; returns `{url}` served from `/uploads/…` |
| `GET /health` | – | `{status, database, redis, instance}` (503 when degraded) |

## WebSockets
Both endpoints are on the backend origin (`ws://localhost:4000`) and require `?token=<ws-token>` (from `GET /auth/ws-token`). The `Origin` header must match `FRONTEND_ORIGIN`.

| Endpoint | Protocol |
|---|---|
| `/collab/:docId` | Binary y-protocols (sync + awareness). Use `y-websocket`'s `WebsocketProvider(url + "/collab", docId, ydoc, { params: { token } })`. Closed with HTTP 401/403 before upgrade when unauthorized; closed with code `4403` when permissions change. Read-only roles can receive but not modify. |
| `/events?topic=doc:<id>` | JSON text frames: `{topic, type: "comments"\|"versions"\|"meta"\|"permissions"\|"deleted"}` |
| `/events?topic=ws:<id>` | `{type: "documents"\|"members"\|"workspace"\|"workspace-deleted"}` |
