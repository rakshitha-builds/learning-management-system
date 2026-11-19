# Tests

* `e2e-smoke.js` — end-to-end API smoke test (22 checks) against a **running, seeded** backend: `node tests/e2e-smoke.js`
* Backend unit/integration tests live in `backend/tests/` (Jest + Supertest). Frontend integration tests live in `frontend/src/tests/` (Vitest).
* Run everything: `./scripts/run-all-tests.sh`. Details: [docs/TESTING.md](../docs/TESTING.md).
