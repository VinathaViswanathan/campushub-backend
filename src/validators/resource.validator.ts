import type { ResourceFilter } from '../types/resource.types';
import { asRecord, failValidation } from './common';

/**
 * GET /resources?type=...&isAvailable=...
 *  - type is optional but must be a non-empty string when provided.
 *  - isAvailable is optional but must be exactly "true" or "false" when provided.
 */
export function parseResourceFilter(query: unknown): ResourceFilter {
  const src = asRecord(query, 'Query string');
  const errors: string[] = [];
  const filter: ResourceFilter = {};

  const type = src['type'];
  if (type !== undefined) {
    if (typeof type !== 'string' || type.trim() === '') {
      errors.push('type must be a non-empty string when provided.');
    } else {
      filter.type = type;
    }
  }

  const isAvailable = src['isAvailable'];
  if (isAvailable !== undefined) {
    if (isAvailable === 'true') {
      filter.isAvailable = true;
    } else if (isAvailable === 'false') {
      filter.isAvailable = false;
    } else {
      errors.push('isAvailable must be either true or false when provided.');
    }
  }

  if (errors.length > 0) {
    return failValidation(errors);
  }
  return filter;
}
