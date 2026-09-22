import express, { Application } from 'express';
import dotenv from 'dotenv';
import healthRoutes from './routes/health.routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app: Application = express();
const PORT: number = Number(process.env.PORT) || 3000;

app.use(express.json());

// Versioned API namespace -> mounts GET /api/v1/health
app.use('/api/v1', healthRoutes);

// Error-handling middleware must be registered last
app.use(errorHandler);

app.listen(PORT, (): void => {
  console.log(`Server running on http://localhost:${PORT}`);
});

export default app;