import 'dotenv/config';
import express, { type NextFunction, type Request, type Response } from 'express';
import reservationRouter from './routes/reservation.routes';
import type { ErrorResponse } from './types/reservation';

const app = express();

app.use(express.json()); // Parses incoming JSON request bodies

// Mount the router under the base path defined in docs/openapi.yaml (servers[0].url)
app.use('/api/v1', reservationRouter);

// Any route not in the contract -> 404 ErrorResponse
app.use((req: Request, res: Response) => {
  const body: ErrorResponse = {
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.originalUrl} is not defined in the API contract.`,
  };
  res.status(404).json(body);
});

const isJsonParseError = (err: unknown): boolean =>
  typeof err === 'object' && err !== null && (err as { type?: unknown }).type === 'entity.parse.failed';

// Global error handler (4 arguments are required for Express to treat it as one)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (isJsonParseError(err)) {
    const body: ErrorResponse = { code: 'INVALID_JSON', message: 'Request body is not valid JSON.' };
    res.status(400).json(body);
    return;
  }
  console.error(err);
  const body: ErrorResponse = { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred.' };
  res.status(500).json(body);
});

const PORT = Number(process.env.PORT) || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});

export default app;
