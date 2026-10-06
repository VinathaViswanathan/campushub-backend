import mongoose from 'mongoose';
import { config } from './index';

/**
 * Database connection shell. The URI always comes from config, never a hardcoded string.
 */

export async function connectDatabase(uri: string = config.mongoUri): Promise<void> {
  mongoose.connection.on('error', (err: unknown) => {
    console.error('[db] Connection error:', err);
  });
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] Disconnected from MongoDB');
  });

  // Fail fast (5s) instead of hanging when MongoDB is not running.
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
  console.log(`[db] Connected to MongoDB at ${mongoose.connection.host}/${mongoose.connection.name}`);
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
