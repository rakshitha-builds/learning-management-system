/* Generates docs/API.md from backend/src/routes/index.js so the documentation can never drift from the code.
   Usage: node scripts/gen-api-docs.js */
const fs = require('fs'); const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../backend/src/routes/index.js'), 'utf8').split('\n');
const sections = []; let cur = null;
for (const line of src) {
  const h = line.match(/^\/\/ ---- (.+?) ----/); if (h) { cur = { title: h[1].replace(/\(.*\)/, '').trim(), rows: [] }; sections.push(cur); continue; }
  const m = line.match(/^r\.(get|post|put|patch|delete)\('([^']+)',\s*(.*)\);\s*(?:\/\/.*)?$/); if (!m || !cur) continue;
  const [, method, route, rest] = m;
  const roles = (rest.match(/authorize\(([^)]*)\)/) || [])[1];
  let access = 'Public';
  if (/optionalAuth/.test(rest)) access = 'Optional login';
  else if (/adminOnly/.test(rest)) access = 'Admin';
  else if (/authenticate/.test(rest)) access = roles ? roles.split(',').map((s) => s.trim().toLowerCase()).join(' / ') : 'Any logged-in user';
  const validated = [/body: v\.([\w.]+)/.exec(rest)?.[1], /query: v\.([\w.]+)/.exec(rest)?.[1] && `query:${/query: v\.([\w.]+)/.exec(rest)[1]}`].filter(Boolean).join(', ') || '—';
  const extras = [/uploadVideo/.test(rest) && 'multipart `video`+`lessonId`', /uploadImage/.test(rest) && 'multipart `image`', /authLimiter/.test(rest) && 'rate-limited'].filter(Boolean).join(', ');
  cur.rows.push(`| \`${method.toUpperCase()}\` | \`/api${route.replace(/:(\w+)/g, ':$1')}\` | ${access} | ${validated}${extras ? ` ${extras}` : ''} |`);
}
const total = sections.reduce((n, s) => n + s.rows.length, 0);
const out = `# REST API reference

_Generated from \`backend/src/routes/index.js\` — ${total} endpoints. Regenerate with \`node scripts/gen-api-docs.js\`._

## Conventions

* Base URL: \`http://localhost:5000\`. All JSON endpoints live under \`/api\`.
* **Auth:** \`Authorization: Bearer <JWT>\` (obtained from \`/api/auth/login\` or \`/api/auth/register\`).
* **Success:** \`{ "success": true, "data": ..., "meta"?: { total, page, limit, pages } }\`
* **Error:** \`{ "success": false, "message": "...", "details"?: [{ "field", "message" }] }\`
* **Status codes:** \`200\` OK · \`201\` created · \`202\` accepted (video queued) · \`400\` validation · \`401\` not logged in · \`402\` payment required · \`403\` wrong role / not owner / not enrolled · \`404\` not found · \`409\` conflict (duplicate, wrong state) · \`429\` rate limited · \`503\` integration not configured (LiveKit / payment gateway / queue).
* **Access column:** the roles allowed. The *owner* rule (e.g. an instructor may only change **their own** course) is enforced in the controller on top of the role check.
* **Validation column:** the Zod schema in \`backend/src/validators/index.js\` applied to the request.
* Money is returned in **paise** (\`amount\`, revenue) — divide by 100 for rupees; course \`price\` is in rupees.
* Non-API routes: \`GET /media/:token/*\` (HLS streaming, token-authorised) · \`GET /files/public/*\` (thumbnails) · \`POST /api/payments/webhook\` (Razorpay, raw body + signature).

${sections.map((s) => `## ${s.title}\n\n| Method | Path | Access | Validation / notes |\n|---|---|---|---|\n${s.rows.join('\n')}\n`).join('\n')}
## Example requests

\`\`\`bash
# Register + login
curl -X POST localhost:5000/api/auth/register -H 'Content-Type: application/json' \\
  -d '{"name":"Asha Rao","email":"asha@example.com","password":"Secret123","role":"student"}'

# Browse published courses (search, filter, sort, paginate)
curl 'localhost:5000/api/courses?q=react&level=beginner&price=paid&sort=popular&page=1&limit=9'

# Instructor: create a course, then upload a lesson video (multipart)
curl -X POST localhost:5000/api/courses -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \\
  -d '{"title":"Node.js Masterclass","description":"Build production-grade Node.js services.","category":"Web Development","level":"intermediate","price":999}'
curl -X POST localhost:5000/api/videos/upload -H "Authorization: Bearer $TOKEN" -F lessonId=<id> -F video=@lesson1.mp4

# Student: start + submit a quiz (answers are only revealed in the submit response)
curl -X POST localhost:5000/api/quizzes/<quizId>/attempts -H "Authorization: Bearer $TOKEN"
curl -X POST localhost:5000/api/attempts/<attemptId>/submit -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \\
  -d '{"answers":[{"questionId":"<id>","selectedIndex":1}]}'
\`\`\`

## Socket.IO events (live-class chat)

Connect with \`io(API_URL, { auth: { token } })\`.

| Direction | Event | Payload |
|---|---|---|
| client → server | \`chat:join\` | \`{ liveClassId }\` (ack \`{ ok }\`) — only enrolled students, the host or admins |
| client → server | \`chat:message\` | \`{ liveClassId, message }\` (≤1000 chars; only while the class is \`live\`) |
| server → room | \`chat:message\` | saved \`ChatMessage\` document |
| server → room | \`chat:presence\` | \`{ count }\` |
| server → room | \`live:started\` / \`live:ended\` | \`{ liveClassId }\` |
`;
fs.writeFileSync(path.join(__dirname, '../docs/API.md'), out); console.log(`docs/API.md written (${total} endpoints)`);
