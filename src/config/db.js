const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

function initDatabase(dbPath) {
  const isTest = process.env.NODE_ENV === 'test';
  const targetPath = dbPath || (isTest ? ':memory:' : path.resolve(__dirname, '../../clinic.db'));

  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  const db = new Database(targetPath);

  if (targetPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');

  createSchema(db);

  return db;
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clinic_id TEXT NOT NULL,
      doctor_name TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BOOKED', 'CANCELLED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_slots_clinic_time ON slots(clinic_id, start_time);
    CREATE INDEX IF NOT EXISTS idx_slots_status ON slots(status);

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_id INTEGER NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
      patient_name TEXT NOT NULL,
      patient_email TEXT NOT NULL,
      patient_phone TEXT,
      status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- Unique constraint ensures only one confirmed booking per slot
    CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking 
      ON bookings(slot_id) WHERE status = 'CONFIRMED';

    CREATE INDEX IF NOT EXISTS idx_bookings_patient_email ON bookings(patient_email);
  `);
}

let defaultDb = null;

function getDb() {
  if (!defaultDb) {
    defaultDb = initDatabase();
  }
  return defaultDb;
}

function setDb(customDb) {
  defaultDb = customDb;
}

module.exports = {
  initDatabase,
  getDb,
  setDb,
};
