import dotenv from 'dotenv';

dotenv.config({ quiet: true });

/**
 * Centralized configuration. No other file reads process.env directly.
 */

export interface AppConfig {
  readonly nodeEnv: string;
  readonly port: number;
  readonly mongoUri: string;
  readonly apiPrefix: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(
      `Missing required environment variable "${name}". Copy .env-example to .env and fill it in.`,
    );
  }
  return value.trim();
}

function parsePort(raw: string | undefined, fallback: number): number {
  if (raw === undefined || raw.trim() === '') {
    return fallback;
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: "${raw}"`);
  }
  return port;
}

export const config: AppConfig = Object.freeze({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parsePort(process.env.PORT, 3000),
  mongoUri: requireEnv('MONGO_URI'),
  apiPrefix: process.env.API_PREFIX ?? '/api/v1',
});
