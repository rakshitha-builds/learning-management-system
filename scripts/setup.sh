#!/usr/bin/env bash
# macOS / Linux local setup (no Docker). Run from the project root: ./scripts/setup.sh
set -euo pipefail
for c in node npm ffmpeg; do command -v $c >/dev/null || { echo "MISSING: $c (see docs/SETUP.md)"; exit 1; }; done
[ -f backend/.env ] || cp backend/.env.example backend/.env
[ -f frontend/.env ] || cp frontend/.env.example frontend/.env
(cd backend && npm install) && (cd frontend && npm install)
echo "Done. Start MongoDB, Redis and LiveKit (docker compose up -d mongo redis livekit), then: cd backend && npm run seed && npm run dev"
