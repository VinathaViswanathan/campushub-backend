# Lab 4 — Prompt Steering Log

Agent used: Claude (claude.ai, with a sandboxed shell). Context loaded before generation:
`AGENTS.md`, `docs/openapi.yaml`, `src/models/*.model.ts`, and the existing routes,
controllers, services, validators, and `scripts/smoke-test.sh`.

Features delivered:

- `GET /api/v1/resources` with `type` and `isAvailable` filters (AND-combined).
- `POST /api/v1/reservations` double-booking check (409 `DOUBLE_BOOKING`), unchanged from Lab 3
  and re-verified.
- `GET /api/v1/reservations/user/{userId}` (unchanged, re-verified).
- `PATCH /api/v1/reservations/{id}/cancel` and `PATCH /api/v1/reservations/{id}/confirm`.

Overlap rule used throughout (from Part 1):
an existing `PENDING`/`CONFIRMED` reservation `E` collides with a new request `N` when
`E.startTime < N.endTime AND E.endTime > N.startTime`. Strict `<`/`>` means back-to-back
bookings (E ends exactly when N starts) are allowed.

---

### Incident 1: Context rules forbade the endpoints the lab requires

- **Initial Agent Output:** The loaded context contradicted the task. `AGENTS.md` said
  "Only these three operations exist; do not add others," and `docs/openapi.yaml` says handlers
  "must not add, rename, or omit any path, parameter, field, or status code defined here."
  Following the rules literally means refusing to add `PATCH /reservations/{id}/cancel` and the
  `isAvailable` filter; following the lab literally means adding routes the contract does not
  know about. The second path would also leave the agent context stale, so every later prompt
  would re-inject the "three operations only" rule and pull the agent back toward the old API.
- **Root Cause:** The context files describe the Lab 3 contract as a closed set. They had no
  entry for the new paths, the `isAvailable` parameter, or error codes for "reservation not
  found" and "cannot confirm a cancelled reservation," so the agent had nothing to bind the
  new code to.
- **Remediation Prompt:**
  > Follow the "When changing behavior" section of AGENTS.md in order. Step 1: update
  > docs/openapi.yaml before touching code — add the `isAvailable` boolean query parameter to
  > GET /resources, add PATCH /reservations/{id}/cancel and PATCH /reservations/{id}/confirm, and
  > add the error codes RESERVATION_NOT_FOUND (404) and INVALID_STATUS_TRANSITION (409) to the
  > ErrorResponse enum. Then update the endpoint table, error-code list, and domain rules in
  > AGENTS.md so they match the new contract. Only then implement types → validators → errors →
  > service → controller → route. Do not rename or change any existing path, field, or code.
- **Resolution:** The contract and `AGENTS.md` were updated first; the YAML was parsed to confirm
  it is valid and lists all five paths. The code was then written against the new contract. The
  original 21 Lab 3 smoke checks still pass, including test 17 (`GET /reservations` → 404), which
  shows no unplanned routes were added.

### Incident 2: `npm run typecheck` crashed with a non-code error

- **Initial Agent Output:** The first `npm run typecheck`, run before any edits as a baseline,
  failed with `Unable to resolve @typescript/typescript-linux-x64`. A naive loop here is to treat
  that as a TypeScript error and start editing source files or `tsconfig.json` to "fix" it,
  which changes code that the lab does not ask to change.
- **Root Cause:** The project uses TypeScript 7, which ships a native per-platform binary. The
  uploaded `node_modules` had been installed on macOS (it contains `@esbuild/darwin-arm64`), so
  the Linux binary was missing. The failure was in the environment, not the code.
- **Remediation Prompt:**
  > Stop. Do not edit any source or config file to fix this. That error comes from the
  > toolchain install, not the code. Run the typecheck with a TypeScript compiler that works on
  > this machine (`tsc --noEmit -p .`), confirm the unmodified baseline passes with 0 errors,
  > and only then start making Lab 4 changes. Re-run the same check after every layer you edit.
- **Resolution:** The unmodified baseline type-checked with 0 errors, which proved the failure
  was environmental. After all Lab 4 edits, the same strict typecheck (`strict`,
  `noUnusedLocals`, `noUnusedParameters`) still reports 0 errors. On the student's own Mac,
  `npm run typecheck` uses the correct native binary and works normally.

### Incident 3: Ambiguous "list all bookings" requirement vs. the existing contract

- **Initial Agent Output:** The lab text says GET `/reservations/user/{userId}` should "list all
  bookings associated with a specific student." The existing contract, `AGENTS.md`, and smoke
  test 14 all say this endpoint returns only `PENDING`/`CONFIRMED` reservations. Reading the lab
  literally would mean rewriting the query to include `CANCELLED`, which would break test 14 and
  silently change a Lab 3 behavior that was already graded.
- **Root Cause:** The lab wording and the contract describe the same endpoint differently. The
  agent had no rule for which source wins when they conflict.
- **Remediation Prompt:**
  > docs/openapi.yaml is the source of truth. Keep GET /reservations/user/{userId} returning
  > only PENDING and CONFIRMED reservations, sorted by startTime. Do not modify that query.
  > Verify that after a reservation is cancelled it disappears from this list, and add a smoke
  > test that proves it.
- **Resolution:** The query was left unchanged. New smoke test L10 books a slot, cancels it,
  re-books it, and confirms that the user's list contains only the new active booking.

## Design note: atomic status changes

Cancel and confirm are each a single `Reservation.findOneAndUpdate` with the allowed source
statuses in the filter, rather than read-check-save. With read-check-save, a confirm that read
`PENDING` could overwrite a cancel that committed a moment later, reviving a reservation whose
slot may already have been re-booked. `{ returnDocument: 'after' }` is used because Mongoose
9.10.1's type definitions mark `new: true` as deprecated. Smoke tests L7–L8 and L11–L18 cover
both endpoints.

---

## Verification summary

| Check | Result |
|---|---|
| Strict typecheck, before and after changes | 0 errors |
| Lab 3 regression (`scripts/smoke-test.sh`, original 21 checks) | 21 / 21 pass |
| New Lab 4 checks (L1–L18) | 18 / 18 pass |
| Architecture rules in `AGENTS.md` | Controllers import no models; services import no Express and return DTOs; all HTTP mapping is in `controller.utils.ts` |
