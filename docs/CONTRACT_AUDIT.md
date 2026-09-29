# Lab 2 — Contract Verification Audit

**Agent used:** _(e.g., Claude Code / Cursor / Copilot)_
**Prompt:** "Using docs/openapi.yaml as an authoritative contract, generate the TypeScript interface definitions in src/types/reservation.ts and the Express router file src/routes/reservation.routes.ts matching the spec."

## 1. Do route paths match the spec exactly?
| Spec path (under /api/v1) | Method | Router path | Match |
|---|---|---|---|
| /resources | GET | /resources | ✅ |
| /reservations | POST | /reservations | ✅ |
| /reservations/user/{userId} | GET | /reservations/user/:userId | ✅ |

## 2. Are status codes correctly typed in the handlers?
Each operation has a response map in `src/types/reservation.ts` (`ListResourcesResponses`, `CreateReservationResponses`, `GetUserReservationsResponses`). Handlers send through a typed `responder<...>()`, so returning a code not listed for that operation (e.g. 409 from GET /resources) is a compile error.

| Operation | Codes in spec | Codes in handler | Match |
|---|---|---|---|
| listResources | 200, 400, 500 | 200, 400, 500 | ✅ |
| createReservation | 201, 400, 404, 409, 500 | 201, 400, 404, 409, 500 | ✅ |
| getUserReservations | 200, 400, 500 | 200, 400, 500 | ✅ |

## 3. Do request body properties match the schema?
POST body = `Reservation` minus readOnly `id`/`status` → `resourceId`, `userId`, `startTime`, `endTime`. Unknown fields and readOnly fields are rejected with 400.

## Issues found in the agent's first draft and how I fixed them
- _(fill in — e.g., agent added a field not in the spec, used 200 instead of 201, didn't validate ISO dates, etc.)_

## Manual test results (`bash scripts/test-api.sh`)
| Test | Expected | Actual |
|---|---|---|
| GET /resources | 200 | |
| GET /resources?type=STUDY_ROOM | 200 | |
| GET /resources?type= | 400 | |
| POST /reservations | 201 | |
| POST duplicate | 409 | |
| GET /reservations/user/user-456 | 200 | |
