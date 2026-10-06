# Lab 3 — Layer Isolation Audit

## Check 1 — No ORM code in controllers

```bash
grep -rnE "mongoose|models/|\.find\(|\.create\(|findById|\.save\(" src/controllers
```

**Result:** No matches. Controllers import only `express` types, their service module, validators, and `controller.utils.ts`. Mongoose-specific errors (`ValidationError`, `CastError`) are translated into domain errors inside `src/services/service.utils.ts`, so controllers do not even need to know the ORM's error types.

## Check 2 — No HTTP concerns in services

```bash
grep -rnE "express|req\.|res\.|status\(" src/services
```

**Result:** No matches. Services accept typed inputs (`CreateReservationInput`, `ResourceFilter`, `userId: string`), return plain DTOs, and signal failures by throwing domain errors (`ValidationError`, `ResourceNotFoundError`, `ResourceUnavailableError`, `DoubleBookingError`). Only `src/controllers/controller.utils.ts` maps those to 400/404/409/500.

## Check 3 — Configuration lives in src/config/

```bash
grep -rn "process.env" src | grep -v "src/config/"
grep -rn "mongodb://" src
```

**Result:** No matches. `src/config/index.ts` is the only file that reads `process.env` (`MONGO_URI` required, `PORT`, `API_PREFIX`, `NODE_ENV` with defaults). `src/config/database.ts` opens the connection using `config.mongoUri`. The sample connection string exists only in `.env-example`.

## Check 4 — Lab 2 manual tests rerun (no regressions)

### What the new architecture assumes about the environment

In Lab 2 the routes worked without a database. After Lab 3 the services read from and write to MongoDB, so testing requires:

1. **A running MongoDB instance.** The server connects before listening and exits if MongoDB is unreachable.
2. **A `.env` file** copied from `.env-example`, because `MONGO_URI` is required.
3. **Seed data.** The contract has no "create resource" endpoint, so resources can only enter the database through `npm run seed`.
4. **Real ObjectIds.** The spec example `res-101` is not a real ID, so Lab 2 tests that used it must use IDs from the seed output instead. (`res-999` still returns 404 `RESOURCE_NOT_FOUND`, as in the spec example.)

### How to run

```bash
npm run seed        # terminal 1, then:
npm run dev         # terminal 1
npm run test:smoke  # terminal 2
```

### Results

| #  | Request | Expected (per openapi.yaml) | Pass? |
|----|---------|-----------------------------|-------|
| 1  | `GET /resources` | 200, 5 resources, only spec'd fields | |
| 2  | `GET /resources?type=ROOM` | 200, only ROOM resources | |
| 3  | `GET /resources?type=FOO` | 200, `[]` | |
| 4  | `GET /resources?type=` | 400 `VALIDATION_ERROR` | |
| 5  | `POST /reservations` valid | 201, `status: PENDING`, only spec'd fields | |
| 6  | Same slot again / partial overlap | 409 `DOUBLE_BOOKING` | |
| 6c | Back-to-back slot | 201 | |
| 7  | `resourceId: res-999` / unknown ObjectId | 404 `RESOURCE_NOT_FOUND` | |
| 8  | Unavailable resource | 409 `RESOURCE_UNAVAILABLE` | |
| 9  | endTime before startTime | 400 `VALIDATION_ERROR` | |
| 10 | Missing userId | 400 `VALIDATION_ERROR` | |
| 11 | Client sends `status` | 400 `VALIDATION_ERROR` | |
| 12 | startTime without timezone | 400 `VALIDATION_ERROR` | |
| 13 | Malformed JSON | 400 `INVALID_JSON` | |
| 14 | `GET /reservations/user/user-456` | 200, 2 active, sorted, cancelled excluded | |
| 15 | `GET /reservations/user/nobody` | 200, `[]` | |
| 16 | Unknown route | 404 `NOT_FOUND` | |
| 17 | `GET /reservations` (not in spec) | 404 `NOT_FOUND` | |

Smoke test output (paste here):

```
```
