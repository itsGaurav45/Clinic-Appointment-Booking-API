require('dotenv').config();
const createApp = require('./app');
const { getDb } = require('./config/db');

const PORT = process.env.PORT || 5000;
const db = getDb();
const app = createApp({ db });

const server = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});

process.on('SIGINT', () => {
  server.close(() => {
    if (db.open) {
      db.close();
    }
    process.exit(0);
  });
});
