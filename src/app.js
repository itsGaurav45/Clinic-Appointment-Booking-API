import express from 'express';
import cors from 'cors';
import { getDb } from './config/db.js';
import slotRoutes from './routes/slotRoutes.js';
import bookingRoutes from './routes/bookingRoutes.js';
import errorHandler from './middlewares/errorHandler.js';

export default function createApp(options = {}) {
  const app = express();
  const db = options.db || getDb();

  app.locals.db = db;

  app.use(cors());
  app.use(express.json());

  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.use('/api/slots', slotRoutes);
  app.use('/api/bookings', bookingRoutes);

  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: `Route ${req.method} ${req.originalUrl} not found`,
    });
  });

  app.use(errorHandler);

  return app;
}
