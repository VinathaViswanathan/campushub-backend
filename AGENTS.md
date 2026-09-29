# AGENTS.md — rules for AI coding agents in this repo

## Contract-first rule
- `docs/openapi.yaml` is the **authoritative API contract**. Treat it as read-only unless explicitly asked to change it.
- Do not invent endpoints, query/path parameters, request/response fields, enum values, or status codes that are not in the contract.
- If a requirement is not covered by the contract, stop and ask instead of guessing.

## Where things live
- `src/types/reservation.ts` — TypeScript types mirroring `components/schemas` and per-operation response maps.
- `src/routes/reservation.routes.ts` — Express routes, mounted at `/api/v1` in `src/app.ts`.
- `src/validators/` — request validation at the HTTP boundary (400 `VALIDATION_ERROR`).
- `src/services/` — business logic (in-memory for now; conflict detection returns 409 `DOUBLE_BOOKING`).
- `src/models/` — Mongoose models aligned with the contract schemas.

## Conventions
- All error responses use the `ErrorResponse` shape `{ code, message }`.
- Dates are ISO 8601 strings with timezone (`format: date-time`).
- TypeScript is strict (`noUnusedLocals`, `noUnusedParameters`); prefix unused params with `_`.
- Verify with `npm run build` and `npx @redocly/cli lint docs/openapi.yaml` before finishing.
