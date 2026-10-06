import { Schema, model, type HydratedDocument, type Model } from 'mongoose';
import { RESOURCE_TYPES, type ResourceType } from '../constants/enums';

/** Strict TypeScript interface for a Resource document (matches the OpenAPI Resource schema). */
export interface IResource {
  name: string;
  type: ResourceType;
  location: string;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type ResourceDocument = HydratedDocument<IResource>;
export type ResourceModel = Model<IResource>;

const resourceSchema = new Schema<IResource, ResourceModel>(
  {
    name: {
      type: String,
      required: [true, 'name is required'],
      trim: true,
      maxlength: [200, 'name must be at most 200 characters'],
    },
    type: {
      type: String,
      enum: {
        values: [...RESOURCE_TYPES],
        message: `type must be one of: ${RESOURCE_TYPES.join(', ')}`,
      },
      required: [true, 'type is required'],
    },
    location: {
      type: String,
      required: [true, 'location is required'],
      trim: true,
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

resourceSchema.index({ type: 1, isAvailable: 1 });

export const Resource = model<IResource, ResourceModel>('Resource', resourceSchema);
