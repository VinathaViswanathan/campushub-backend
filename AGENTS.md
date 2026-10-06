# AGENTS.md — CampusHub Backend Context

Read this file before generating or modifying any code in this repository.

## Project

CampusHub is a campus resource management API (rooms, equipment, labs) and the reservations made against them.

- Stack: TypeScript (strict), Node.js, Express 5, Mongoose 9, MongoDB
- API contract: `docs/openapi.yaml` is the source of truth for paths, parameters, fields, and status codes. Do not add, rename, or omit any of them.

## Architecture (3-tier, strictly enforced)

```
HTTP request
  -> src/routes/        map verb + path to a controller function. Nothing else.
  -> src/controllers/   extract input from req, call ONE service function, set the HTTP status, send res.
  -> src/services/      business rules + all database access through src/models/.
  -> src/models/        Mongoose schemas + exported TypeScript interfaces.
```

Supporting folders:

- `src/validators/` turns untrusted `unknown` input into typed input objects. No Express, no Mongoose.
- `src/errors/` holds domain errors (`ValidationError`, `NotFoundError`, `ConflictError`). These have no HTTP status codes.
- `src/types/` holds DTO and input types shared between controllers and services. No Mongoose types.
- `src/constants/` holds enums (`RESOURCE_TYPES`, `RESERVATION_STATUSES`) used by every layer.
- `src/config/` is the only place that reads `process.env` and the only place that connects to the database.
- `src/middleware/` holds the 404 and last-resort error handlers.

## API contract (docs/openapi.yaml) — summary

Base path: `/api/v1`. Only these three operations exist; do not add others:

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/resources?type=` | 200 | 400, 500 |
| POST | `/reservations` | 201 | 400, 404, 409, 500 |
| GET | `/reservations/user/{userId}` | 200 | 400, 500 |

- Error body is exactly `{ "code": string, "message": string }` with no extra fields. Codes: `VALIDATION_ERROR`, `INVALID_JSON`, `RESOURCE_NOT_FOUND`, `RESOURCE_UNAVAILABLE`, `DOUBLE_BOOKING`, `NOT_FOUND`, `INTERNAL_ERROR`.
- Response objects use `additionalProperties: false`. Resource = `id, name, type, location, isAvailable`. Reservation = `id, resourceId, userId, startTime, endTime, status`. Never leak `_id`, `createdAt`, `updatedAt`.
- POST /reservations rejects unknown fields and the readOnly fields `id` and `status` (400).

## Hard rules — never violate

1. Controllers must not import `mongoose` or anything from `src/models/`. They must not call `.find()`, `.create()`, `.findById()`, `.save()`, or similar.
2. Services must not import `express`. They must not accept `req`/`res`/`next` and must not call `res.status()` or reference HTTP status codes.
3. Services return plain DTOs (see `src/types/`), never Mongoose documents.
4. Services signal failure by throwing domain errors from `src/errors/`. Only `src/controllers/controller.utils.ts` maps them to HTTP codes:
   `VALIDATION_ERROR -> 400`, `RESOURCE_NOT_FOUND -> 404`, `RESOURCE_UNAVAILABLE -> 409`, `DOUBLE_BOOKING -> 409`, anything else -> `500 INTERNAL_ERROR`.
5. Mongoose-specific errors (`ValidationError`, `CastError`) are translated into domain errors inside the service layer (`service.utils.ts`).
6. No `any`. Use `unknown` plus validation, or explicit interfaces.
7. No hardcoded connection strings, ports, or secrets. Add new settings to `src/config/index.ts` and `.env-example`.
8. Every model file exports a TypeScript interface alongside its schema.

## Domain rules

- Resource `type` is one of `ROOM`, `EQUIPMENT`, `LAB`. `GET /resources?type=X` with an unknown X returns `[]`, not an error. An empty `type` returns 400.
- Reservation `status` is one of `PENDING`, `CONFIRMED`, `CANCELLED`. New reservations always start as `PENDING`.
- `startTime`/`endTime` must be RFC 3339 date-times with a timezone, and `endTime` must be later than `startTime` (400).
- `resourceId` is stored as an ObjectId reference to Resource. A `resourceId` that does not exist, including one that is not a valid ObjectId (e.g. `res-999`), returns 404 `RESOURCE_NOT_FOUND`.
- A resource with `isAvailable: false` cannot be reserved (409 `RESOURCE_UNAVAILABLE`).
- A reservation cannot overlap an existing `PENDING` or `CONFIRMED` reservation for the same resource (409 `DOUBLE_BOOKING`). Back-to-back bookings are allowed.
- `GET /reservations/user/{userId}` returns only `PENDING`/`CONFIRMED` reservations, sorted by `startTime`.

## When changing behavior

1. Update `docs/openapi.yaml` first; the code must never contradict it.
2. Add or extend the model (with its interface) in `src/models/`.
3. Add types in `src/types/` and a parser in `src/validators/`.
4. Add the service function in `src/services/`.
5. Add the controller function in `src/controllers/`.
6. Wire the route in `src/routes/`.
7. Run `npm run typecheck`, then retest the affected endpoints manually.
