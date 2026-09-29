/**
 * Mongoose model aligned with components/schemas/Resource in docs/openapi.yaml.
 * Mongo's _id is exposed as the contract's `id` via the `id` virtual in toJSON.
 * Not connected in Lab 2 (in-memory service is used for testing).
 */
import { Schema, model } from 'mongoose';
import { RESOURCE_TYPES, type Resource } from '../types/reservation';

export type ResourceDocument = Omit<Resource, 'id'>;

const resourceSchema = new Schema<ResourceDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 1 },
    type: { type: String, enum: [...RESOURCE_TYPES], required: true },
    location: { type: String, required: true, trim: true, minlength: 1 },
    isAvailable: { type: Boolean, required: true, default: true },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } },
);

resourceSchema.index({ type: 1 }); // supports GET /resources?type=

export const ResourceModel = model<ResourceDocument>('Resource', resourceSchema);
