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

Base path: `/api/v1`. Only these operations exist; do not add others:

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/resources?type=&isAvailable=` | 200 | 400, 500 |
| POST | `/reservations` | 201 | 400, 404, 409, 500 |
| GET | `/reservations/user/{userId}` | 200 | 400, 500 |
| PATCH | `/reservations/{id}/cancel` | 200 | 400, 404, 500 |
| PATCH | `/reservations/{id}/confirm` | 200 | 400, 404, 409, 500 |

- Error body is exactly `{ "code": string, "message": string }` with no extra fields. Codes: `VALIDATION_ERROR`, `INVALID_JSON`, `RESOURCE_NOT_FOUND`, `RESOURCE_UNAVAILABLE`, `DOUBLE_BOOKING`, `RESERVATION_NOT_FOUND`, `INVALID_STATUS_TRANSITION`, `NOT_FOUND`, `INTERNAL_ERROR`.
- Response objects use `additionalProperties: false`. Resource = `id, name, type, location, isAvailable`. Reservation = `id, resourceId, userId, startTime, endTime, status`. Never leak `_id`, `createdAt`, `updatedAt`.
- POST /reservations rejects unknown fields and the readOnly fields `id` and `status` (400).

## Hard rules — never violate

1. Controllers must not import `mongoose` or anything from `src/models/`. They must not call `.find()`, `.create()`, `.findById()`, `.save()`, or similar.
2. Services must not import `express`. They must not accept `req`/`res`/`next` and must not call `res.status()` or reference HTTP status codes.
3. Services return plain DTOs (see `src/types/`), never Mongoose documents.
4. Services signal failure by throwing domain errors from `src/errors/`. Only `src/controllers/controller.utils.ts` maps them to HTTP codes:
   `VALIDATION_ERROR -> 400`, `RESOURCE_NOT_FOUND -> 404`, `RESERVATION_NOT_FOUND -> 404`, `RESOURCE_UNAVAILABLE -> 409`, `DOUBLE_BOOKING -> 409`, `INVALID_STATUS_TRANSITION -> 409`, anything else -> `500 INTERNAL_ERROR`.
5. Mongoose-specific errors (`ValidationError`, `CastError`) are translated into domain errors inside the service layer (`service.utils.ts`).
6. No `any`. Use `unknown` plus validation, or explicit interfaces.
7. No hardcoded connection strings, ports, or secrets. Add new settings to `src/config/index.ts` and `.env-example`.
8. Every model file exports a TypeScript interface alongside its schema.

## Domain rules

- Resource `type` is one of `ROOM`, `EQUIPMENT`, `LAB`. `GET /resources?type=X` with an unknown X returns `[]`, not an error. An empty `type` returns 400.
- `GET /resources?isAvailable=` accepts exactly `true` or `false`; anything else returns 400. It combines with `type` (AND).
- Reservation `status` is one of `PENDING`, `CONFIRMED`, `CANCELLED`. New reservations always start as `PENDING`.
- `startTime`/`endTime` must be RFC 3339 date-times with a timezone, and `endTime` must be later than `startTime` (400).
- `resourceId` is stored as an ObjectId reference to Resource. A `resourceId` that does not exist, including one that is not a valid ObjectId (e.g. `res-999`), returns 404 `RESOURCE_NOT_FOUND`.
- A resource with `isAvailable: false` cannot be reserved (409 `RESOURCE_UNAVAILABLE`).
- A reservation cannot overlap an existing `PENDING` or `CONFIRMED` reservation for the same resource (409 `DOUBLE_BOOKING`). Back-to-back bookings are allowed.
- `GET /reservations/user/{userId}` returns only `PENDING`/`CONFIRMED` reservations, sorted by `startTime`.
- Overlap formula: an existing active reservation overlaps the request when `existing.startTime < new.endTime AND existing.endTime > new.startTime` (strict comparisons on `Date` values, never strings).
- Status transitions: `PENDING -> CONFIRMED`, `PENDING|CONFIRMED -> CANCELLED`. Repeating a transition to the current status is a no-op (200). `CANCELLED -> CONFIRMED` is rejected (409 `INVALID_STATUS_TRANSITION`). A reservation `id` that does not exist, including a non-ObjectId, returns 404 `RESERVATION_NOT_FOUND`.
- A `CANCELLED` reservation immediately frees its slot (the overlap check ignores it).
- Status changes use a single atomic `findOneAndUpdate` with `returnDocument: 'after'` (`new: true` is deprecated in Mongoose 9).

## When changing behavior

1. Update `docs/openapi.yaml` first; the code must never contradict it.
2. Add or extend the model (with its interface) in `src/models/`.
3. Add types in `src/types/` and a parser in `src/validators/`.
4. Add the service function in `src/services/`.
5. Add the controller function in `src/controllers/`.
6. Wire the route in `src/routes/`.
7. Run `npm run typecheck`, then retest the affected endpoints manually.

## Frontend (client/)

The React client lives in `client/` (Vite + React 19 + TypeScript, strict). It talks to the backend only through the contract in `docs/openapi.yaml`.

```
client/src/
  api/types.ts          TS mirrors of the OpenAPI schemas. Never add, rename, or omit fields.
  api/campushubApi.ts   The ONLY place that calls fetch. Turns non-2xx responses into ApiError { status, code, message }.
  hooks/                Custom hooks owning async state (data, isLoading, error) and actions.
  components/           Presentational + interactive components. No fetch calls.
  utils/                Pure helpers (date conversion, error-code -> user message).
```

### Component architecture
1. Functional components only, each with an exported `<Name>Props` interface. No class components, no `React.FC`.
2. One component per file in `src/components/`, named after the component (`ResourceList.tsx`), with its styles in a matching CSS Module (`ResourceList.module.css`).
3. Lift shared state to the nearest common parent (`App.tsx`) and pass it down as props; children report changes through callback props (`onSelect`, `onBooked`).

### State management
1. Use standard hooks (`useState`, `useEffect`, `useCallback`) and custom hooks in `src/hooks/`. No global state library.
2. Never call the API inline in JSX or directly in a component body. Components call hooks; hooks call `src/api/campushubApi.ts`.
3. Every async workflow exposes explicit `isLoading` (or `isSubmitting`) and `error` state, and both must be rendered. A loading flag must be cleared in `finally`, so a failed request can never leave a spinner hanging.
4. Effects that fetch must pass an `AbortController` signal and abort on cleanup, and must ignore `AbortError`, so a stale response never overwrites newer state.
5. After a mutation (create, cancel), refresh the affected list instead of patching it optimistically.

### Error handling
1. Map API error codes to user-facing messages only in `src/utils/errorMessages.ts`. `409 DOUBLE_BOOKING` must show: "This resource is already reserved for the selected time window."
2. Render errors with `ErrorBanner` (`role="alert"`), with a retry action for failed loads.
3. Validate form input on the client before sending (required fields, end after start, start in the future), but still handle every server error, since the server is the final authority.
4. A 5xx response without an `ErrorResponse` body means the API was unreachable (dev proxy or gateway), so show the "cannot reach the server" message.

### Styling
1. CSS Modules for component styles; global design tokens (colors, radii) are CSS variables in `src/index.css`, with light and dark values. Do not hardcode colors in modules; use the variables.
2. Use semantic HTML and accessible names (`<label htmlFor>`, `aria-pressed` on filter toggles, `role="status"` for loading text).

### Dates
`<input type="datetime-local">` returns local time without a timezone. Convert with `localInputToIso()` (UTC ISO with `Z`) before sending, and format API times for display with `formatDateTime()`.

### Running
The backend runs on port 3000 and the client on 5173. `client/vite.config.ts` proxies `/api` to the backend, so the backend needs no CORS configuration. Run `npm run build` in `client/` (type-check + bundle) after every change.
