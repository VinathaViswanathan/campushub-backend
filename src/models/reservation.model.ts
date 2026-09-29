/**
 * Mongoose model aligned with components/schemas/Reservation in docs/openapi.yaml.
 * startTime/endTime are stored as Date and serialize to ISO 8601 strings in JSON.
 * Not connected in Lab 2 (in-memory service is used for testing).
 */
import { Schema, model } from 'mongoose';
import { RESERVATION_STATUSES, type ReservationStatus } from '../types/reservation';

export interface ReservationDocument {
  resourceId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
}

const reservationSchema = new Schema<ReservationDocument>(
  {
    resourceId: { type: String, required: true, trim: true },
    userId: { type: String, required: true, trim: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    status: { type: String, enum: [...RESERVATION_STATUSES], required: true, default: 'PENDING' },
  },
  { timestamps: true, toJSON: { virtuals: true, versionKey: false } },
);

reservationSchema.pre('validate', function () {
  if (this.startTime && this.endTime && this.endTime <= this.startTime) {
    this.invalidate('endTime', 'endTime must be later than startTime.');
  }
});

// Supports overlap/conflict queries and GET /reservations/user/{userId}
reservationSchema.index({ resourceId: 1, startTime: 1, endTime: 1 });
reservationSchema.index({ userId: 1, status: 1 });

export const ReservationModel = model<ReservationDocument>('Reservation', reservationSchema);
