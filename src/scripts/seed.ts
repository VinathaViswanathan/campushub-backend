import { connectDatabase, disconnectDatabase } from '../config/database';
import { Reservation, type IReservation } from '../models/Reservation.model';
import { Resource, type IResource } from '../models/Resource.model';

/**
 * Resets the database and inserts sample data so the Lab 2 manual tests have
 * real records to hit. The API has no "create resource" endpoint, so this
 * script is the only way to get resources into the database.
 *
 * Run with: npm run seed
 */

type SeedResource = Pick<IResource, 'name' | 'type' | 'location' | 'isAvailable'>;
type SeedReservation = Pick<IReservation, 'resourceId' | 'userId' | 'startTime' | 'endTime' | 'status'>;

const SAMPLE_RESOURCES: SeedResource[] = [
  { name: 'Study Room 302', type: 'ROOM', location: 'Library, Floor 3', isAvailable: true },
  { name: 'Conference Room B', type: 'ROOM', location: 'Student Center, Floor 2', isAvailable: true },
  { name: 'Projector #3', type: 'EQUIPMENT', location: 'IT Help Desk', isAvailable: true },
  { name: 'Robotics Lab', type: 'LAB', location: 'Engineering Building, Floor 3', isAvailable: true },
  { name: 'Chemistry Lab 2', type: 'LAB', location: 'Science Hall', isAvailable: false },
];

async function seed(): Promise<void> {
  await connectDatabase();

  await Reservation.deleteMany({});
  await Resource.deleteMany({});

  const resources = await Resource.insertMany(SAMPLE_RESOURCES);
  const [studyRoom, conferenceRoom, projector] = resources;
  if (!studyRoom || !conferenceRoom || !projector) {
    throw new Error('Expected sample resources to be inserted');
  }

  // user-456 gets two active reservations and one cancelled one, so
  // GET /reservations/user/user-456 should return exactly 2 (sorted by startTime).
  const sampleReservations: SeedReservation[] = [
    {
      resourceId: conferenceRoom._id,
      userId: 'user-456',
      startTime: new Date('2026-11-02T14:00:00Z'),
      endTime: new Date('2026-11-02T15:00:00Z'),
      status: 'CONFIRMED',
    },
    {
      resourceId: studyRoom._id,
      userId: 'user-456',
      startTime: new Date('2026-11-01T10:00:00Z'),
      endTime: new Date('2026-11-01T11:00:00Z'),
      status: 'PENDING',
    },
    {
      resourceId: projector._id,
      userId: 'user-456',
      startTime: new Date('2026-11-03T09:00:00Z'),
      endTime: new Date('2026-11-03T10:00:00Z'),
      status: 'CANCELLED',
    },
  ];
  const reservations = await Reservation.insertMany(sampleReservations);

  console.log(`[seed] Inserted ${resources.length} resources:`);
  console.table(
    resources.map((r) => ({
      id: r._id.toString(),
      name: r.name,
      type: r.type,
      isAvailable: r.isAvailable,
    })),
  );
  console.log(`[seed] Inserted ${reservations.length} reservations for user-456:`);
  console.table(
    reservations.map((r) => ({
      id: r._id.toString(),
      resourceId: r.resourceId.toString(),
      startTime: r.startTime.toISOString(),
      status: r.status,
    })),
  );

  await disconnectDatabase();
}

seed().catch(async (err: unknown) => {
  console.error('[seed] Failed:', err);
  await disconnectDatabase();
  process.exit(1);
});
