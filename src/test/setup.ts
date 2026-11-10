import { afterAll, afterEach, beforeAll } from '@jest/globals';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import os from 'os';

/**
 * Runs before every test file (jest.config.ts -> setupFilesAfterEnv).
 * Starts a private in-memory MongoDB, connects Mongoose to it, wipes every
 * collection after each test, and shuts everything down after the file.
 */

// src/config requires MONGO_URI when it is imported. Tests never use this value:
// they connect to the in-memory server below. It only has to exist.
process.env.MONGO_URI ??= 'mongodb://127.0.0.1:27017/campushub-test-unused';

// Same MongoDB line as development (Docker mongo:7). Override with MONGOMS_VERSION if needed.
const MONGODB_VERSION = process.env.MONGOMS_VERSION ?? '7.0.14';

let mongo: MongoMemoryServer | undefined;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create({ binary: { version: MONGODB_VERSION } });
  await mongoose.connect(mongo.getUri(), {
    // The MongoDB driver (v7.6+) loads `os` with a dynamic import(), which Jest's CommonJS
    // sandbox does not support. The failure is swallowed, the handshake is sent without
    // client metadata, and the server rejects it ("Missing required sub-document 'driver'").
    // Passing `os` directly skips that import.
    runtimeAdapters: { os },
  });
});

afterEach(async () => {
  // Every test starts from an empty database, so tests never depend on each other.
  await Promise.all(Object.values(mongoose.models).map((model) => model.deleteMany({})));
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
