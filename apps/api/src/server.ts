import http from 'node:http';
import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { resolve } from 'path';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { initSocketServer } from './realtime/socket.js';

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), '.env') });
dotenv.config({ path: resolve(process.cwd(), '../../.env') });

export const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health Check
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: '@hotel-pms/api',
  });
});

// Mount API Routes under /api
app.use('/api', apiRouter);

// Centralized Error Handling Middleware
app.use(errorHandler);

// Create HTTP server and attach Socket.io
export const httpServer = http.createServer(app);
export const io = initSocketServer(httpServer);

if (process.env.NODE_ENV !== 'test') {
  httpServer.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[API Server] Running with Socket.io on http://0.0.0.0:${PORT} (LAN: http://192.168.0.101:${PORT})`);
  });
}

export default app;
