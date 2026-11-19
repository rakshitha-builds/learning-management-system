#!/usr/bin/env bash
# Runs backend tests, then boots the API against a freshly seeded scratch DB and runs the frontend integration tests.
# Requires MongoDB + Redis + FFmpeg running locally.
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== Backend tests =="; (cd backend && npm test)
echo "== Seeding scratch DB =="; (cd backend && MONGO_URI=${MONGO_URI_E2E:-mongodb://127.0.0.1:27017/learnsphere_e2e} npm run seed)
echo "== Starting API =="; (cd backend && MONGO_URI=${MONGO_URI_E2E:-mongodb://127.0.0.1:27017/learnsphere_e2e} PORT=5000 node src/server.js & echo $! > /tmp/lms-api.pid); sleep 5
trap 'kill $(cat /tmp/lms-api.pid) 2>/dev/null || true' EXIT
echo "== API smoke (tests/e2e-smoke.js) =="; node tests/e2e-smoke.js
echo "== Frontend integration tests =="; (cd frontend && npm test)
