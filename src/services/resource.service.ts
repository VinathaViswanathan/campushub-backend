import { isResourceType } from '../constants/enums';
import { Resource, type ResourceDocument } from '../models/Resource.model';
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
 * Lists resources, optionally filtered by exact type.
 * Per the contract, a type that matches nothing (e.g. "FOO") returns [] rather than an error.
 */
export async function listResources(filter: ResourceFilter = {}): Promise<ResourceDTO[]> {
  if (filter.type === undefined) {
    const docs = await Resource.find({}).sort({ name: 1 });
    return docs.map(toResourceDTO);
  }

  if (!isResourceType(filter.type)) {
    return [];
  }

  const docs = await Resource.find({ type: filter.type }).sort({ name: 1 });
  return docs.map(toResourceDTO);
}
