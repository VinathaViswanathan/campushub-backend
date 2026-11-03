# Lab 6 — Refactoring & Context Optimization Audit

Agent used: Claude (claude.ai, with a sandboxed shell and headless Chromium), working on the
Lab 5 commit. Every number below was measured, not estimated by eye.

## Part 1 — Context and ignore optimization

### Context file pruning

`AGENTS.md` went from 128 lines / 9,865 bytes to 65 lines / 4,228 bytes (−57%). `CLAUDE.md` now
imports it (`@AGENTS.md`), so Claude Code and Cursor load one set of rules instead of two.

Removed or fixed:

| Problem in the old file | Why it hurts an agent | Fix |
|---|---|---|
| Named error classes `NotFoundError` and `ConflictError` that do not exist in the code | Invites imports of non-existent classes (hallucination) | Rules point to `errors/domain.errors.ts` instead of listing class names |
| Rule 4 said `controllers/controller.utils.ts` maps errors to HTTP codes | File deleted in this lab; stale rule would recreate it | Rule now names `middleware/errorHandler.ts` |
| Endpoint table, error-code list, and field lists copied from `docs/openapi.yaml` | Two sources of truth that drift; spent tokens on every prompt | Replaced with a pointer to the contract and `shared/api-types.d.ts` |
| Detailed lab-specific instructions (status-code mapping, Lab 4 history, exact error sentences) | Detail already in code, repeated in every prompt | Point to the one file that owns each detail |

An uncommitted local edit had replaced `AGENTS.md` with a Lab 1 version that told agents to wrap
controllers in try/catch, the opposite of this lab's goal. The pruned file starts from the
committed Lab 5 version and keeps the useful Lab 1 rules (no `any`, explicit types, approved
dependencies, commit format).

### Ignore files

- `.cursorignore`: Cursor stops indexing and reading the listed paths.
- `.ignore`: the same patterns for ripgrep-based search (Claude Code search, many CLI agents).
- `.claude/settings.json`: Claude Code `Read` deny rules for dependencies, builds, logs, maps, `.env`.

Excluded: `node_modules/`, lockfiles, `dist/`, `build/`, `coverage/`, `.vite/`, `*.map`,
`*.tsbuildinfo`, `logs/`, `*.log`, `*.jsonl`, past lab logs (`docs/lab*.md`), `.env`, binary assets.
Kept on purpose: `docs/openapi.yaml`, the contract every change depends on.

### Verification

Measured with a script that walks the repo and applies the ignore patterns the way the tools do
(gitignore syntax; approx. 1 token per 4 bytes; binary files skipped):

| | Files | Approx. tokens |
|---|---|---|
| Before: no ignore file, all files | 6,492 | ~25,600,000 |
| Before, excluding `node_modules` | 123 | ~146,000 |
| After: refactored repo with `.cursorignore` | 72 | ~31,700 |

What remains is source: `client/src` (~13.7k), `src` (~8.0k), `shared`, the contract, and config.
In the "before, excluding node_modules" row, the extra ~114k tokens were lockfiles, `logs/`, old
lab logs, and 62 stray files committed by accident under `client/` (copies of the client, docs,
README, and AGENTS.md nested up to three levels deep). Those stray files were deleted.

Agent check to repeat in your own tool: ask "List the files that define reservation error handling."
The answer should name only `src/middleware/errorHandler.ts`, `src/errors/domain.errors.ts`, and
`client/src/api/campushubApi.ts`, with no hits from `node_modules`, `dist`, `logs`, or lockfiles.

## Part 2 — Bloat and redundancy audit

| Anti-pattern | Evidence before | Result |
|---|---|---|
| Duplicate handlers (backend) | 5 identical `try { … } catch (err) { sendError(res, err) }` blocks across 2 controllers, plus a second error path in `controller.utils.ts` beside `middleware/errorHandler.ts` | Fixed (Pass 1) |
| Duplicate async-state logic (client) | `useResources` and `useUserReservations` each re-implemented loading, error mapping, AbortController, and reload | Fixed (Pass 2) |
| Over-verbose components | `BookingForm.tsx` 241 lines (form state, validation, submit, scroll behavior, and markup in one file); `UserReservations.tsx` 151 lines (grouping logic, row markup, confirm flow) | Fixed (Pass 2) |
| Redundant interfaces | Resource, Reservation, ResourceType, ReservationStatus, and error codes defined separately in `src/types`, `src/constants`, `src/errors`, and `client/src/api/types.ts` | Fixed (Pass 3) |
| Repeated error parsing across components | Not present: parsing was already centralized in `client/src/api/campushubApi.ts`, and messages in `utils/errorMessages.ts`. The client uses `fetch`, not Axios. | No change needed |
| Repository bloat | 62 accidentally committed stray files under `client/` | Deleted |

`ResourceList.tsx` (130 lines) is under the ~150-line threshold, with its data fetching already
in a hook, so it was left as is.

## Part 3 — Refactoring passes

Each pass was given as a structured prompt with explicit constraints, then verified before moving on.

### Pass 1 — Backend global error handler

> Remove every try/catch from `src/controllers/`. Make `src/middleware/errorHandler.ts` the only
> place errors become HTTP responses: move the DomainError → status map into it, keep the
> malformed-JSON handling, and return 500 INTERNAL_ERROR for anything else. Rely on Express 5
> forwarding rejected async handlers; do not add an asyncHandler wrapper or a dependency. Delete
> `controller.utils.ts`. Response bodies must stay exactly `{ code, message }`.

Result: controllers went from 88 to 53 lines with zero try/catch; `controller.utils.ts` was deleted.
Verified with the 39-check smoke test (every 400/404/409/INVALID_JSON path) and a separate test
forcing an async database rejection and a synchronous throw: both returned
`500 INTERNAL_ERROR` instead of hanging the request.

### Pass 2 — Frontend custom hooks

> Extract all reservation API state from `BookingForm.tsx` and `UserReservations.tsx` into
> `client/src/hooks/useReservations.ts` (list, cancel, create). Put the shared fetch-on-change
> logic (loading, error mapping, abort on change) in one generic hook and build the data hooks on
> it. Move booking form state into `useBookingForm`, validation into a pure function, and repeated
> markup into child components. Keep every label, role, and visible text identical so existing
> tests still pass.

Result:

| File | Before | After |
|---|---|---|
| `components/BookingForm.tsx` | 241 | 97 |
| `components/UserReservations.tsx` | 151 | 88 |
| `hooks/useResources.ts` | 52 | 25 |
| `hooks/useUserReservations.ts` + `hooks/useCreateReservation.ts` | 127 | merged into `hooks/useReservations.ts` (101) |

New: `hooks/useApiQuery.ts` (the single loading/abort implementation), `hooks/useBookingForm.ts`,
`hooks/useRevealOnNarrowScreen.ts`, `components/FormField.tsx`, `components/DurationPicker.tsx`,
`components/ReservationItem.tsx`, `utils/bookingValidation.ts`, `utils/agenda.ts`. The largest
component is now 130 lines. One intended visual change: time-field errors appear under their own
field instead of below the row.

### Pass 3 — Shared interface library

> Create `shared/api-types.d.ts` as the single declaration of the API contract types, mirroring
> `docs/openapi.yaml`. Make backend DTOs, enums, and error codes, and the client's `api/types.ts`,
> import from it with `import type`. It must be declaration-only, so neither side needs build or
> bundler changes. Runtime enum lists must be checked against the shared unions at compile time.

Result: one definition of Resource, Reservation, CreateReservationRequest, ResourceType,
ReservationStatus, ApiErrorCode, and ErrorResponse. `DomainErrorCode` is derived from
`ApiErrorCode`. Runtime lists use `Record<Union, true>` keys, so a missing member fails to compile.

Why `.d.ts`: the backend's `tsconfig` has `rootDir: ./src`. A regular `.ts` file outside `src/`
would break `npm run build`; declaration files are exempt, and `import type` is erased from the
output, so neither the server nor Vite loads the file at runtime. Verified with a real
`tsc` build (no compiled file references `shared/`) and by deliberately passing a number as
`startTime` in the client, which the compiler rejected against the shared type.

## Regression results

| Check | Before refactor | After refactor |
|---|---|---|
| Backend type-check and build | pass | pass |
| Client type-check (real React types) | pass | pass |
| Backend smoke test (`scripts/smoke-test.sh`) | 39 / 39 | 39 / 39 |
| Browser test (booking, validation, 409 alert, cancel, errors, phone layout) | 25 / 25 | 25 / 25 |
