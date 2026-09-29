/**
 * Boundary validation for requests, derived from docs/openapi.yaml.
 * Invalid input is rejected here (400 VALIDATION_ERROR) before it reaches the service layer.
 */
import type { CreateReservationRequest, ErrorResponse, ListResourcesQuery } from '../types/reservation';

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: ErrorResponse };

const fail = (message: string): { ok: false; error: ErrorResponse } => ({
  ok: false,
  error: { code: 'VALIDATION_ERROR', message },
});

// Matches the `pattern` in docs/openapi.yaml: date, 'T', time, optional fraction, required timezone.
const ISO_8601_DATE_TIME =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

/** True only for real ISO 8601 date-times with a timezone (rejects e.g. 2026-02-30 or 25:00). */
export function isIsoDateTime(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const m = ISO_8601_DATE_TIME.exec(value);
  if (!m) return false;

  const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (month < 1 || month > 12 || day < 1 || day > daysInMonth) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;

  if (m[8] !== 'Z') {
    const offsetHours = Number(m[9]);
    const offsetMinutes = Number(m[10]);
    if (offsetHours > 23 || offsetMinutes > 59) return false;
  }
  return !Number.isNaN(Date.parse(value));
}

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** GET /resources — `type` is optional, but must be a single non-empty string when present. */
export function validateListResourcesQuery(query: Record<string, unknown>): ValidationResult<ListResourcesQuery> {
  const { type } = query;
  if (type === undefined) return { ok: true, value: {} };
  if (!isNonEmptyString(type)) return fail('type must be a non-empty string when provided.');
  return { ok: true, value: { type: type.trim() } };
}

/** GET /reservations/user/{userId} — userId must be a non-empty string. */
export function validateUserId(userId: unknown): ValidationResult<string> {
  if (!isNonEmptyString(userId)) return fail('userId must be a non-empty string.');
  return { ok: true, value: userId.trim() };
}

const CREATE_FIELDS = ['resourceId', 'userId', 'startTime', 'endTime'] as const;
const READ_ONLY_FIELDS = ['id', 'status'];

/** POST /reservations — body must match Reservation minus its readOnly fields, with no extra properties. */
export function validateCreateReservation(body: unknown): ValidationResult<CreateReservationRequest> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return fail('Request body must be a JSON object with resourceId, userId, startTime, and endTime.');
  }
  const input = body as Record<string, unknown>;
  const errors: string[] = [];

  const readOnlySent = Object.keys(input).filter((key) => READ_ONLY_FIELDS.includes(key));
  if (readOnlySent.length > 0) {
    errors.push(`${readOnlySent.join(', ')} ${readOnlySent.length > 1 ? 'are' : 'is'} readOnly and assigned by the server.`);
  }
  const unknown = Object.keys(input).filter(
    (key) => !READ_ONLY_FIELDS.includes(key) && !(CREATE_FIELDS as readonly string[]).includes(key),
  );
  if (unknown.length > 0) errors.push(`Unknown field(s): ${unknown.join(', ')}.`);

  for (const field of ['resourceId', 'userId'] as const) {
    if (input[field] === undefined) errors.push(`${field} is required.`);
    else if (!isNonEmptyString(input[field])) errors.push(`${field} must be a non-empty string.`);
  }
  for (const field of ['startTime', 'endTime'] as const) {
    if (input[field] === undefined) errors.push(`${field} is required.`);
    else if (!isIsoDateTime(input[field])) {
      errors.push(`${field} must be an ISO 8601 date-time string with timezone (e.g. 2026-10-01T10:00:00Z).`);
    }
  }

  if (errors.length === 0 && Date.parse(input.endTime as string) <= Date.parse(input.startTime as string)) {
    errors.push('endTime must be later than startTime.');
  }
  if (errors.length > 0) return fail(errors.join(' '));

  return {
    ok: true,
    value: {
      resourceId: (input.resourceId as string).trim(),
      userId: (input.userId as string).trim(),
      startTime: input.startTime as string,
      endTime: input.endTime as string,
    },
  };
}
