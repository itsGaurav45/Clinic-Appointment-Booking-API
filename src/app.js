const express = require('express');
const cors = require('cors');
const { getDb } = require('./config/db');
const slotRoutes = require('./routes/slotRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const errorHandler = require('./middlewares/errorHandler');

function createApp(options = {}) {
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

module.exports = createApp;
