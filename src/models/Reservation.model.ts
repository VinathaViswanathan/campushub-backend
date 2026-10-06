import { Schema, model, type HydratedDocument, type Model, type Types } from 'mongoose';
import { RESERVATION_STATUSES, type ReservationStatus } from '../constants/enums';

/** Strict TypeScript interface for a Reservation document (matches the OpenAPI Reservation schema). */
export interface IReservation {
  resourceId: Types.ObjectId;
  userId: string;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type ReservationDocument = HydratedDocument<IReservation>;
export type ReservationModel = Model<IReservation>;

const reservationSchema = new Schema<IReservation, ReservationModel>(
  {
    resourceId: {
      type: Schema.Types.ObjectId,
      ref: 'Resource',
      required: [true, 'resourceId is required'],
    },
    userId: {
      type: String,
      required: [true, 'userId is required'],
      trim: true,
    },
    startTime: {
      type: Date,
      required: [true, 'startTime is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'endTime is required'],
    },
    status: {
      type: String,
      enum: {
        values: [...RESERVATION_STATUSES],
        message: `status must be one of: ${RESERVATION_STATUSES.join(', ')}`,
      },
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

// Schema-level guard: a reservation must end after it starts.
// (Mongoose 9 middleware no longer takes a `next` callback.)
reservationSchema.pre('validate', function () {
  if (this.startTime && this.endTime && this.endTime.getTime() <= this.startTime.getTime()) {
    this.invalidate('endTime', 'endTime must be later than startTime.');
  }
});

// Supports the overlap query used when creating reservations.
reservationSchema.index({ resourceId: 1, startTime: 1, endTime: 1 });
reservationSchema.index({ userId: 1 });

export const Reservation = model<IReservation, ReservationModel>('Reservation', reservationSchema);
