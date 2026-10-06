import { ValidationError } from '../errors/domain.errors';

/**
 * Framework-agnostic input parsing helpers. Inputs are typed as `unknown`
 * and these functions know nothing about Express or Mongoose.
 */

export type UnknownRecord = Record<string, unknown>;

export function asRecord(value: unknown, label = 'Request body'): UnknownRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ValidationError(`${label} must be a JSON object.`);
  }
  return value as UnknownRecord;
}

/** Enforces additionalProperties: false. */
export function rejectUnknownKeys(
  src: UnknownRecord,
  allowed: readonly string[],
  readOnly: readonly string[],
  errors: string[],
): void {
  for (const key of Object.keys(src)) {
    if (readOnly.includes(key)) {
      errors.push(`${key} is read-only and must not be sent.`);
    } else if (!allowed.includes(key)) {
      errors.push(`${key} is not an allowed field.`);
    }
  }
}

export function readNonEmptyString(
  src: UnknownRecord,
  key: string,
  errors: string[],
): string | undefined {
  const value = src[key];
  if (value === undefined || value === null) {
    errors.push(`${key} is required.`);
    return undefined;
  }
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${key} must be a non-empty string.`);
    return undefined;
  }
  return value;
}

// Same pattern as the OpenAPI spec, with capture groups for range checks.
const DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d+)?(Z|[+-](\d{2}):(\d{2}))$/;

function isRealCalendarDateTime(match: RegExpExecArray): boolean {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);

  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return false;
  if (hour > 23 || minute > 59 || second > 59) return false;

  if (match[9] !== undefined && match[10] !== undefined) {
    if (Number(match[9]) > 23 || Number(match[10]) > 59) return false;
  }
  return true;
}

/** Requires an RFC 3339 date-time with a timezone (Z or ±HH:MM) that is a real calendar time. */
export function readDateTime(
  src: UnknownRecord,
  key: string,
  errors: string[],
): Date | undefined {
  const value = src[key];
  if (value === undefined || value === null) {
    errors.push(`${key} is required.`);
    return undefined;
  }
  const message = `${key} must be an ISO 8601 date-time with a timezone (e.g. 2026-10-01T10:00:00Z).`;
  if (typeof value !== 'string') {
    errors.push(message);
    return undefined;
  }
  const match = DATE_TIME_PATTERN.exec(value);
  if (!match || !isRealCalendarDateTime(match)) {
    errors.push(message);
    return undefined;
  }
  return new Date(value);
}

export function failValidation(errors: string[]): never {
  throw new ValidationError(errors.join(' '));
}
