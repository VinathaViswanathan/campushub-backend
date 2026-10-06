import express, { type Express } from 'express';
import { config } from './config';
import { connectDatabase, disconnectDatabase } from './config/database';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import apiRouter from './routes';

/** Builds the Express app without starting it (handy for tests). */
export function createApp(): Express {
  const app = express();

  app.use(express.json());

  // Base path matches the OpenAPI server URL: http://localhost:3000/api/v1
  app.use(config.apiPrefix || '/', apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

async function start(): Promise<void> {
  await connectDatabase(config.mongoUri);

  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(
      `[app] CampusHub API (${config.nodeEnv}) listening on http://localhost:${config.port}${config.apiPrefix}`,
    );
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`[app] ${signal} received, shutting down...`);
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

if (require.main === module) {
  start().catch((err: unknown) => {
    console.error('[app] Failed to start server:', err);
    process.exit(1);
  });
}
