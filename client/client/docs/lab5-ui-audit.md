# Lab 5 — State Management & Error Handling Audit

Agent used: Claude (claude.ai, with a sandboxed shell and a headless Chromium browser).
Context loaded: `AGENTS.md` (including the new Frontend section), `docs/openapi.yaml`, and the
Lab 4 backend code.

The audit ran the built client in a real browser against the Lab 4 backend routes, controllers,
services, and validators. The sandbox has no MongoDB, so the Mongoose model calls were backed by an
in-memory store loaded with the same data as `npm run seed`.

## Part 3 test: double-booking through the UI

1. Booked Robotics Lab, Dec 1 2026, 10:00–11:00 → `201`, a confirmation saying the booking shows as
   pending, and "My bookings" refreshed from 2 to 3 items.
2. Booked the same resource for 10:30–11:30 (overlapping) → backend returned `409 DOUBLE_BOOKING`.

Result: the UI shows an explicit alert (`role="alert"`) reading "This resource is already reserved
for the selected time window. Please choose a different time." It does not crash or fail silently.
The submit button returns from "Booking…" to "Book this time", the chosen times stay in the
inputs so the student can adjust them, and "My bookings" is unchanged. Editing a time clears the
alert.

## Async workflows checked for `isLoading` and `error` state

| Workflow | Loading state | Error state | Verified |
|---|---|---|---|
| Load resources (`useResources`) | "Loading resources…" (`role="status"`) | `ErrorBanner` with "Try again" | Slow response shows then clears the indicator; backend 500 and backend down both show a banner and no spinner |
| Create reservation (`useCreateReservation`) | Button shows "Booking…", inputs disabled | `ErrorBanner` with "Dismiss" | 409 shows the double-booking message; client validation blocks empty, reversed, and past times without sending a request |
| Load my bookings (`useUserReservations`) | "Loading your bookings…" | `ErrorBanner` with "Try again" | Backend down shows a banner and no spinner |
| Cancel reservation (`useUserReservations.cancel`) | Inline "Cancel this booking?" confirmation; the button shows "Cancelling…" and other cancel actions are disabled | `ErrorBanner`; the list refreshes afterwards either way | Cancelling removes the booking, and the freed slot can be booked again |

Every loading flag is cleared in a `finally` block, and every fetching effect aborts its request on
cleanup, so switching filters quickly cannot leave stale results or a stuck indicator.

## Incident: backend outage reported as a generic server error

- **Initial Agent Output:** The first version of `campushubApi.ts` reported "Cannot reach the
  CampusHub server" only when `fetch` itself threw. With the backend stopped, the browser test
  expected that message but got "The server ran into a problem. Please try again in a moment."
- **Root Cause:** The browser never talks to the backend directly; it goes through the Vite dev
  proxy. When the backend is down, the proxy answers with an empty 5xx response instead of failing
  the connection, so `fetch` succeeds and the outage looked like an ordinary server error. The
  agent had assumed the browser and the API were directly connected.
- **Remediation Prompt:**
  > The backend always returns an ErrorResponse JSON body, including for 500 INTERNAL_ERROR. In
  > src/api/campushubApi.ts, treat any 5xx response that does not have a valid ErrorResponse body
  > as NETWORK_ERROR, because it came from the Vite proxy or a gateway, not from the API. Keep a
  > 500 that has an ErrorResponse body mapped to the generic server-error message. Add a rule for
  > this to the Frontend section of AGENTS.md.
- **Resolution:** Re-ran the browser test with the backend stopped: both panels show "Cannot reach
  the CampusHub server" with a "Try again" button and no loading text. A separate test that returns
  a real `500 INTERNAL_ERROR` JSON body still shows the generic server-error message.

## Final browser test results

After the visual redesign (directory list, date and time booking panel, day-by-day agenda),
25 of 25 checks passed: directory grouping and filters, disabled rows for unavailable resources,
three client-side validation cases, quick-duration buttons, booking with dashboard refresh,
same-day grouping in the agenda, the 409 alert, "Keep it" and "Cancel booking" in the inline
confirmation, re-booking a cancelled slot, switching student ID, slow loading, backend 500,
backend down and recovery with "Try again", the phone layout bringing the booking panel into
view, and no uncaught JavaScript errors in the console.
