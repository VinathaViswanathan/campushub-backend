# AGENTS.md — CampusHub

Rules for AI coding agents in this repo. If a request conflicts with a rule, stop and say so.
`CLAUDE.md` imports this file; edit rules here only.

## Project map

CampusHub books campus rooms, equipment, and labs. TypeScript (strict) everywhere.

| Path | What it is |
|---|---|
| `docs/openapi.yaml` | API contract: source of truth for paths, fields, status codes. |
| `shared/api-types.d.ts` | Contract types used by BOTH backend and client. Types only, no runtime values. |
| `src/` | Express 5 + Mongoose 9 backend. |
| `client/src/` | React 19 + Vite client. |
| `src/**/__tests__/` | Jest tests. `src/test/` holds the in-memory DB setup and factories. |
| `scripts/smoke-test.sh` | Contract smoke test against a running server. |

Skip unless the task needs them: `docs/lab*.md` (past lab logs), lockfiles, `logs/`. See `.cursorignore`.

## Rules for all code

1. No `any`; use `unknown` and narrow. Explicit parameter and return types on exported functions.
2. Do not add dependencies without asking. Backend runtime deps: `express`, `mongoose`, `dotenv`.
3. A contract change updates `docs/openapi.yaml` and `shared/api-types.d.ts` together, before code.
4. Never define an API shape twice. Import contract types from `shared/api-types.d.ts` with `import type`.
5. Keep files under ~150 lines. When a component grows, move state and logic into a hook and repeated markup into a child component.

## Backend (`src/`)

Request flow: `routes/` (verb + path only) → `controllers/` → `services/` → `models/`.

- **Controllers** parse input with `validators/`, call one service function, and send the success status. **No try/catch**: Express 5 forwards thrown and rejected errors to `middleware/errorHandler.ts`.
- **Services** hold business rules and all database access. No `express` imports, no HTTP status codes. Return plain DTOs, never Mongoose documents. Fail by throwing a `DomainError` subclass from `errors/domain.errors.ts`.
- **`middleware/errorHandler.ts`** is the only place errors become HTTP responses (`{ code, message }`). A new error code gets its status there.
- `config/` is the only reader of `process.env`. No hardcoded secrets, ports, or URLs.
- Controllers never import `mongoose` or `models/`.

Domain rules (enforced in `services/`):
- Overlap: an existing PENDING/CONFIRMED reservation conflicts when `existing.start < new.end AND existing.end > new.start` (Date comparisons). Back-to-back is allowed. Conflict → 409 `DOUBLE_BOOKING`.
- New reservations start PENDING. Transitions: PENDING → CONFIRMED; PENDING/CONFIRMED → CANCELLED; repeating the current status is a 200 no-op; CANCELLED → CONFIRMED is 409. CANCELLED frees the slot.
- Unknown or malformed (non-ObjectId) ids → 404. Status changes use one atomic `findOneAndUpdate` with `returnDocument: 'after'`.
- The overlap check and insert run inside `withResourceLock` (`services/resource.lock.ts`); never split them.

## Client (`client/src/`)

- `api/campushubApi.ts` is the only file that calls `fetch`; it turns non-2xx responses into `ApiError`.
- Components render; hooks own state. No API calls in components or JSX.
  - `hooks/useApiQuery.ts`: the one fetch-on-change implementation (loading, error, abort). Build data hooks on it.
  - `hooks/useReservations.ts`: reservation list, cancel, create. `hooks/useBookingForm.ts`: booking form state.
- Every async flow renders `isLoading`/`error`; errors use `ErrorBanner` (`role="alert"`). User-facing error text lives only in `utils/errorMessages.ts`.
- Functional components with an exported `<Name>Props` interface; one component per file with a matching CSS Module.
- Colors only via CSS variables in `index.css`. Northeastern palette: `--brand` red for identity and selection (`--brand-text` when red is text), `--success` green, `--amber` pending, `--error` errors only. No university logo or wordmark.
- Dates: convert local inputs with `combineDateTime(...).toISOString()`; display with `utils/datetime.ts`.

## Testing (Jest + Supertest + mongodb-memory-server)

- Service tests in `src/services/__tests__/`, HTTP tests in `src/routes/__tests__/`. Import Jest APIs from `@jest/globals`.
- Use the real in-memory database from `src/test/setup.ts`; do not mock Mongoose except to simulate an outage.
- Write the failure cases first: boundaries (exact match, ±1 ms), invalid input, missing records, concurrency. A test suite of only happy paths is incomplete.
- Fuzz tests use `seededRandom` from `src/test/factories.ts` so failures are reproducible.
- Coverage gate (`jest.config.ts`): 80% statements and branches for `src/services/` and `src/controllers/`.

## Verify before finishing

```bash
npm run typecheck                         # backend
npm run test:coverage                     # all tests + coverage gate
(cd client && npm run build)              # client type-check + bundle
npm run seed && npm run dev               # then, in another terminal:
npm run test:smoke                        # must print 39 passed
```

## Git

Imperative, scoped messages (`refactor(api): centralize error handling`). Never commit `.env`, `node_modules/`, `dist/`, or `logs/`.
