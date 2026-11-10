# Lab 7 — Test Generation & Edge-Case Report

Agent used: Claude (claude.ai, sandboxed shell), working on the Lab 6 commit.

## Part 1 — Test environment

| File | Purpose |
|---|---|
| `jest.config.ts` | ts-jest transform, `src/**/__tests__/**/*.test.ts`, coverage scope and 80% gate for `src/services/` and `src/controllers/` |
| `src/test/setup.ts` | Starts a private `MongoMemoryServer` per test file, connects Mongoose, empties every collection after each test, stops the server afterwards |
| `src/test/factories.ts` | `createResource`, `reservationInput`, `at()`, and a seeded PRNG for reproducible fuzzing |
| `tsconfig.test.json` | Type-checks tests; `tsconfig.json` now excludes them so `npm run build` ships no test code |

Toolchain incident: the project used TypeScript 7 (native compiler), which no longer ships the
JavaScript compiler API (`require('typescript').transpileModule` is undefined). ts-jest compiles
through that API, and Jest loads `jest.config.ts` through ts-node, which needs it too. The backend
is pinned to TypeScript 5.9, the version the client already uses. Backend code compiles unchanged.

## Part 2 — Service tests (`src/services/__tests__/`)

Tests run against the real in-memory MongoDB, not mocks, so the overlap query, ObjectId casting,
and Mongoose validation behave as in production.

| Area | Cases |
|---|---|
| Happy path | create returns exactly the contract fields with status PENDING; same slot on another resource; list, cancel, confirm |
| Time ranges | end before start, zero length, end 1 ms before start (all ValidationError, nothing stored); shortest valid booking (1 ms) |
| Resource lookup | well-formed missing id; five malformed ids (no CastError leaks); unavailable resource |
| Double-booking boundaries vs 10:00–11:00 | exact start/end match; same start; same end; overlap by 1 ms at either edge; contained; containing → all DoubleBookingError. Back-to-back at either edge and 1 ms gaps → allowed. CONFIRMED blocks; CANCELLED does not |
| Boundary fuzzing | 300 seeded random intervals clustered on the edges (exactly on them, ±1 ms, or within 2 h), each checked against the overlap formula |
| Concurrency | 5 simultaneous identical requests → exactly 1 succeeds; simultaneous requests for different slots/resources all succeed |
| Status rules | cancel frees the slot; cancel and confirm are idempotent; CANCELLED cannot be confirmed; unknown and malformed ids → not found |
| Persistence errors | Mongoose ValidationError and CastError become domain ValidationError; anything else is rethrown |

## Part 3 — HTTP integration tests (`src/routes/__tests__/reservation.routes.test.ts`)

Supertest drives the real Express app (routing, validators, controllers, services, error handler):

- `POST /reservations`: 201 with the contract body; 409 on overlap (first booking untouched); 409 on
  exact duplicate and 201 back-to-back; the same instant written in another timezone is the same
  slot; 5 simultaneous requests → one 201 and four 409; 404 unknown/malformed resource; 409
  unavailable; 16 kinds of invalid payload → 400 with nothing stored; malformed JSON → 400
  INVALID_JSON; database outage → 500 INTERNAL_ERROR body.
- Payload fuzzing: 200 seeded random payloads mixing nulls, wrong types, arrays, a Mongo operator
  object (`{ "$gt": "" }`), a 5,000-character string, impossible dates, and out-of-range offsets.
  Assertion: never a 5xx, and every 4xx carries `{ code, message }`.
- `GET /resources`: 200 sorted; filters by type, availability, both, and unknown type → `[]`;
  400 for empty type, `isAvailable=yes`, `isAvailable=TRUE`, and a repeated `type` parameter.
- `GET /reservations/user/:userId`, `PATCH .../cancel`, `PATCH .../confirm`, unknown routes.

## Incident: the concurrency test found a real double-booking bug

- **Initial behavior:** `createReservation` checked for an overlap (`Reservation.exists`) and then
  inserted (`Reservation.create`) as two separate awaits. With five simultaneous identical
  requests, all five passed the check before any insert, and **all five bookings were saved**.
  The test failed with "expected length 1, got 5".
- **Root cause:** check-then-act across two database calls with no serialization. Every earlier
  test sent requests one at a time (happy-path bias), so it never showed up.
- **Remediation prompt:**
  > Make the overlap check and the insert in createReservation atomic per resource, without new
  > dependencies and without requiring a MongoDB replica set (dev uses a standalone mongod).
  > Requests for different resources must still run in parallel. Add unit tests proving the lock
  > runs same-key tasks in order, releases after a task throws, and never blocks different keys.
- **Fix:** `src/services/resource.lock.ts` (`withResourceLock`) queues tasks per resource id;
  `createReservation` runs check + insert inside it. Scope: one server process, which is how
  CampusHub runs; several instances would need a MongoDB transaction instead.
- **Verification:** the 5-request test passes (1 created, 4 DoubleBookingError, 1 row stored);
  the parallel-resources test passes; 3 lock unit tests pass; the 39-check API smoke test still passes.

## Incident: every test failed to connect inside Jest

- **Initial behavior:** the first real `npm test` failed all tests in `beforeAll` with
  `MongooseServerSelectionError: Missing required sub-document 'driver' in the client metadata
  document`. The app itself connected to MongoDB normally, outside Jest.
- **First (wrong) hypothesis:** a MongoDB server version mismatch. Pinning the in-memory server
  to 7.0.14, the same line as development, did not change the error. This ruled out the server.
- **Root cause, found by reproducing it:** a fake MongoDB server captured the handshake. In plain
  Node the driver sent full client metadata; inside a Jest-style `vm` sandbox it sent `{}`.
  Instrumenting the driver showed why: MongoDB driver 7.6 loads Node's `os` module with a dynamic
  `await import('os')`. Jest runs tests as CommonJS in a `vm` context where dynamic `import()` is
  unavailable without `--experimental-vm-modules`. The driver swallows the failure (`squashError`),
  sends empty metadata, and the server rejects the handshake.
- **Remediation prompt:**
  > Do not change server versions or Jest flags. Use the driver's public
  > `MongoClientOptions.runtimeAdapters.os` option in `src/test/setup.ts` to hand the driver Node's
  > `os` module, so it never reaches the dynamic import. Explain the reason in a code comment.
- **Resolution:** `mongoose.connect(uri, { runtimeAdapters: { os } })`. The sandbox reproduction
  then sent the same handshake as plain Node, and the real suite passed (below).

## Results (real `npx jest --coverage` run)

| Suite | Tests |
|---|---|
| `reservation.service.test.ts` | 40 |
| `resource.service.test.ts` | 9 |
| `resource.lock.test.ts` | 3 |
| `service.utils.test.ts` | 12 |
| `reservation.routes.test.ts` | 44 |
| **Total** | **108 passing, 5 of 5 suites** |

Coverage of `src/services/` and `src/controllers/` (the gate in `jest.config.ts` is 80%):

| Metric | Covered |
|---|---|
| Statements | 100% (107/107) |
| Branches | 100% (35/35) |
| Functions | 100% (19/19) |
| Lines | 100% (104/104) |

Every file in both folders is at 100% on all four metrics. The suite runs in about 4 seconds once
the MongoDB binary is cached.
