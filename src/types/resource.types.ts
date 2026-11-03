/** Response shape comes from the shared contract layer. */
export type { Resource as ResourceDTO } from '../../shared/api-types';

/**
 * GET /resources query parameters (backend-internal). `type` may be any non-empty
 * string per the spec; `isAvailable` is already parsed from "true"/"false".
 */
export interface ResourceFilter {
  type?: string;
  isAvailable?: boolean;
}
