/**
 * Mongoose model aligned with components/schemas/User in docs/openapi.yaml.
 * Not connected in Lab 2 (in-memory service is used for testing).
 */
import { Schema, model } from 'mongoose';
import { USER_ROLES, type User } from '../types/reservation';

export type UserDocument = Omit<User, 'id'>;

const userSchema = new Schema<UserDocument>(
  {
    name: { type: String, required: true, trim: true, minlength: 1 },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    role: { type: String, enum: [...USER_ROLES], required: true, default: 'STUDENT' },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } },
);

export const UserModel = model<UserDocument>('User', userSchema);
