import { getDb } from '../config/db.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';

export default class BookingService {
  static createBooking(data, customDb) {
    const db = customDb || getDb();
    const { slot_id, patient_name, patient_email, patient_phone } = data;

    const bookTransaction = db.transaction(() => {
      const slot = db.prepare('SELECT * FROM slots WHERE id = ?').get(slot_id);

      if (!slot) {
        throw new NotFoundError(`Slot with ID ${slot_id} does not exist`);
      }

      if (slot.status === 'CANCELLED') {
        throw new BadRequestError(`Cannot book a slot that has been cancelled by the clinic`);
      }

      if (slot.status === 'BOOKED') {
        throw new ConflictError(`Slot ${slot_id} is already booked`);
      }

      const updateResult = db.prepare(`
        UPDATE slots 
        SET status = 'BOOKED', updated_at = datetime('now') 
        WHERE id = ? AND status = 'AVAILABLE'
      `).run(slot_id);

      if (updateResult.changes === 0) {
        throw new ConflictError(`Slot ${slot_id} was just booked by another request`);
      }

      try {
        const insertResult = db.prepare(`
          INSERT INTO bookings (slot_id, patient_name, patient_email, patient_phone, status)
          VALUES (?, ?, ?, ?, 'CONFIRMED')
        `).run(
          slot_id,
          patient_name,
          patient_email,
          patient_phone || null
        );

        return {
          bookingId: insertResult.lastInsertRowid,
        };
      } catch (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || (err.message && err.message.includes('UNIQUE'))) {
          throw new ConflictError(`Slot ${slot_id} already has a confirmed booking`);
        }
        throw err;
      }
    });

    const { bookingId } = bookTransaction();
    return this.getBookingById(bookingId, db);
  }

  static getBookingById(id, customDb) {
    const db = customDb || getDb();
    const stmt = db.prepare(`
      SELECT 
        b.id,
        b.slot_id,
        b.patient_name,
        b.patient_email,
        b.patient_phone,
        b.status AS booking_status,
        b.created_at AS booked_at,
        b.updated_at AS booking_updated_at,
        s.clinic_id,
        s.doctor_name,
        s.start_time,
        s.end_time,
        s.status AS slot_status
      FROM bookings b
      JOIN slots s ON s.id = b.slot_id
      WHERE b.id = ?
    `);

    const row = stmt.get(id);
    if (!row) {
      throw new NotFoundError(`Booking with ID ${id} not found`);
    }

    return this.formatBookingRow(row);
  }

  static listBookings(filters = {}, customDb) {
    const db = customDb || getDb();
    const conditions = [];
    const params = [];

    if (filters.patient_email) {
      conditions.push('b.patient_email = ?');
      params.push(filters.patient_email.toLowerCase());
    }

    if (filters.slot_id) {
      conditions.push('b.slot_id = ?');
      params.push(filters.slot_id);
    }

    if (filters.status) {
      conditions.push('b.status = ?');
      params.push(filters.status.toUpperCase());
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        b.id,
        b.slot_id,
        b.patient_name,
        b.patient_email,
        b.patient_phone,
        b.status AS booking_status,
        b.created_at AS booked_at,
        b.updated_at AS booking_updated_at,
        s.clinic_id,
        s.doctor_name,
        s.start_time,
        s.end_time,
        s.status AS slot_status
      FROM bookings b
      JOIN slots s ON s.id = b.slot_id
      ${whereClause}
      ORDER BY b.id DESC
    `;

    const rows = db.prepare(query).all(...params);
    return rows.map(this.formatBookingRow);
  }

  static cancelBooking(id, customDb) {
    const db = customDb || getDb();

    const cancelTransaction = db.transaction(() => {
      const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(id);

      if (!booking) {
        throw new NotFoundError(`Booking with ID ${id} not found`);
      }

      if (booking.status === 'CANCELLED') {
        throw new BadRequestError(`Booking with ID ${id} is already cancelled`);
      }

      db.prepare(`
        UPDATE bookings 
        SET status = 'CANCELLED', updated_at = datetime('now')
        WHERE id = ?
      `).run(id);

      db.prepare(`
        UPDATE slots 
        SET status = 'AVAILABLE', updated_at = datetime('now') 
        WHERE id = ? AND status = 'BOOKED'
      `).run(booking.slot_id);

      return id;
    });

    const bookingId = cancelTransaction();
    return this.getBookingById(bookingId, db);
  }

  static formatBookingRow(row) {
    return {
      id: row.id,
      slot_id: row.slot_id,
      patient_name: row.patient_name,
      patient_email: row.patient_email,
      patient_phone: row.patient_phone,
      status: row.booking_status,
      created_at: row.booked_at,
      updated_at: row.booking_updated_at,
      slot: {
        clinic_id: row.clinic_id,
        doctor_name: row.doctor_name,
        start_time: row.start_time,
        end_time: row.end_time,
        status: row.slot_status,
      },
    };
  }
}
