import type { ResourceType } from '../constants/enums';

/** Matches components.schemas.Resource exactly (additionalProperties: false). */
export interface ResourceDTO {
  id: string;
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
}

/** GET /resources query parameters. `type` may be an arbitrary non-empty string per the spec. */
export interface ResourceFilter {
  type?: string;
}
