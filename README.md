# campushub-backend

CS5500 backend service for CampusHub, a campus resource management system. Built with TypeScript, Express 5, and Mongoose under strict AI-agent context boundaries (see `AGENTS.md`). The API contract is `docs/openapi.yaml`.

## Architecture

```
src/
├── app.ts                  # Express app: JSON parsing, mounts routes at /api/v1, connects to DB on startup
├── config/
│   ├── index.ts            # The only file that reads process.env
│   └── database.ts         # connectDatabase / disconnectDatabase
├── routes/                 # verb + path -> controller method
├── controllers/            # req -> service call -> HTTP status + res (no ORM code)
│   └── controller.utils.ts # domain error -> HTTP status mapping
├── services/               # business rules + all DB access (no Express)
├── models/                 # Mongoose schemas + exported TS interfaces
│   ├── Resource.model.ts
│   └── Reservation.model.ts
├── validators/             # unknown input -> typed input objects
├── errors/                 # domain errors carrying ErrorResponse codes
├── types/                  # DTOs matching the OpenAPI schemas
├── constants/              # RESOURCE_TYPES, RESERVATION_STATUSES
├── middleware/             # 404 NOT_FOUND, INVALID_JSON, fallback INTERNAL_ERROR
└── scripts/seed.ts         # resets the DB and inserts sample data
```

## Setup

Prerequisites: Node.js 20+ and a running MongoDB instance (local install, Docker, or MongoDB Atlas).

```bash
npm install
cp .env-example .env          # then edit MONGO_URI if needed

# Start MongoDB locally with Docker (if not installed natively):
docker run -d --name campushub-mongo -p 27017:27017 mongo:7

npm run seed                  # inserts sample resources + reservations and prints their IDs
npm run dev                   # http://localhost:3000/api/v1
```

The server connects to MongoDB before it starts listening. If MongoDB is unreachable, startup fails within about 5 seconds.

The API has no endpoint for creating resources, so `npm run seed` is how resources get into the database.

## Environment variables

| Variable     | Required | Default       | Purpose                            |
|--------------|----------|---------------|------------------------------------|
| `MONGO_URI`  | yes      | (none)        | MongoDB connection string          |
| `PORT`       | no       | `3000`        | HTTP port                          |
| `API_PREFIX` | no       | `/api/v1`     | Base path (matches OpenAPI server) |
| `NODE_ENV`   | no       | `development` | Environment label shown at startup |

## Endpoints

| Method | Path                                 | Success | Errors             |
|--------|--------------------------------------|---------|--------------------|
| GET    | `/api/v1/resources?type=ROOM`        | 200     | 400, 500           |
| POST   | `/api/v1/reservations`               | 201     | 400, 404, 409, 500 |
| GET    | `/api/v1/reservations/user/{userId}` | 200     | 400, 500           |

Error body: `{ "code": "DOUBLE_BOOKING", "message": "Resource is already reserved for this time slot." }`

## Testing

Automated contract check (17 scenarios from `docs/openapi.yaml`):

```bash
npm run seed          # reset data first; the tests create reservations
npm run dev           # in one terminal
npm run test:smoke    # in another
```

### Manual testing

IDs are now real 24-character MongoDB ObjectIds. The spec example `res-101` no longer refers to a real resource, so `POST /reservations` with it returns 404. Use an `id` printed by `npm run seed`.

```bash
BASE=http://localhost:3000/api/v1

curl -i $BASE/resources
curl -i "$BASE/resources?type=LAB"
curl -i "$BASE/resources?type=FOO"          # 200 []
curl -i "$BASE/resources?type="             # 400 VALIDATION_ERROR

RID=<id of "Robotics Lab" from seed output>
curl -i -X POST $BASE/reservations -H "Content-Type: application/json" \
  -d "{\"resourceId\":\"$RID\",\"userId\":\"user-789\",\"startTime\":\"2026-12-01T10:00:00Z\",\"endTime\":\"2026-12-01T11:00:00Z\"}"
# Same request again -> 409 DOUBLE_BOOKING

curl -i $BASE/reservations/user/user-456    # 2 active reservations, sorted by startTime
```
