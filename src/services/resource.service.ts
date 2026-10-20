import { isResourceType } from '../constants/enums';
import { Resource, type IResource, type ResourceDocument } from '../models/Resource.model';
import type { ResourceDTO, ResourceFilter } from '../types/resource.types';

/**
 * Resource business logic + persistence.
 * No Express imports, no req/res, no HTTP status codes.
 */

function toResourceDTO(doc: ResourceDocument): ResourceDTO {
  return {
    id: doc._id.toString(),
    name: doc.name,
    type: doc.type,
    location: doc.location,
    isAvailable: doc.isAvailable,
  };
}

/**
 * Lists resources, optionally filtered by exact type and/or availability (combined with AND).
 * Per the contract, a type that matches nothing (e.g. "FOO") returns [] rather than an error.
 */
export async function listResources(filter: ResourceFilter = {}): Promise<ResourceDTO[]> {
  const query: Partial<Pick<IResource, 'type' | 'isAvailable'>> = {};

  if (filter.type !== undefined) {
    if (!isResourceType(filter.type)) {
      return [];
    }
    query.type = filter.type;
  }

  if (filter.isAvailable !== undefined) {
    query.isAvailable = filter.isAvailable;
  }

  const docs = await Resource.find(query).sort({ name: 1 });
  return docs.map(toResourceDTO);
}
