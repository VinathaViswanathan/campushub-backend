import type { ResourceFilter } from '../types/resource.types';
import { asRecord, failValidation } from './common';

/** GET /resources?type=... : type is optional but must be a non-empty string when provided. */
export function parseResourceFilter(query: unknown): ResourceFilter {
  const src = asRecord(query, 'Query string');
  const type = src['type'];

  if (type === undefined) {
    return {};
  }
  if (typeof type !== 'string' || type.trim() === '') {
    return failValidation(['type must be a non-empty string when provided.']);
  }
  return { type };
}
