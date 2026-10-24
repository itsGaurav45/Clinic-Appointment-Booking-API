import { getDb } from '../config/db.js';
import { NotFoundError, ConflictError, BadRequestError } from '../utils/errors.js';

export default class SlotService {
  static createSlot(data, customDb) {
    const db = customDb || getDb();
    const { clinic_id, doctor_name, start_time, end_time } = data;

    const overlapStmt = db.prepare(`
      SELECT id, start_time, end_time, status 
      FROM slots 
      WHERE clinic_id = ? 
        AND doctor_name = ? 
        AND status != 'CANCELLED'
        AND start_time < ? 
        AND end_time > ?
      LIMIT 1
    `);

    const existingOverlap = overlapStmt.get(clinic_id, doctor_name, end_time, start_time);
    if (existingOverlap) {
      throw new ConflictError(
        `Doctor ${doctor_name} at clinic ${clinic_id} already has an active slot overlapping with this timeframe (${existingOverlap.start_time} - ${existingOverlap.end_time})`,
        { overlappingSlotId: existingOverlap.id }
      );
    }

    const insertStmt = db.prepare(`
      INSERT INTO slots (clinic_id, doctor_name, start_time, end_time, status)
      VALUES (?, ?, ?, ?, 'AVAILABLE')
    `);

    const result = insertStmt.run(clinic_id, doctor_name, start_time, end_time);

    return this.getSlotById(result.lastInsertRowid, db);
  }

  static getSlotById(id, customDb) {
    const db = customDb || getDb();
    const stmt = db.prepare(`
      SELECT 
        s.id,
        s.clinic_id,
        s.doctor_name,
        s.start_time,
        s.end_time,
        s.status,
        s.created_at,
        s.updated_at,
        b.id AS booking_id,
        b.patient_name,
        b.patient_email,
        b.patient_phone,
        b.status AS booking_status
      FROM slots s
      LEFT JOIN bookings b ON b.slot_id = s.id AND b.status = 'CONFIRMED'
      WHERE s.id = ?
    `);

    const row = stmt.get(id);
    if (!row) {
      throw new NotFoundError(`Slot with ID ${id} not found`);
    }

    return this.formatSlotRow(row);
  }

  static listSlots(filters = {}, customDb) {
    const db = customDb || getDb();
    const conditions = [];
    const params = [];

    if (filters.clinic_id) {
      conditions.push('s.clinic_id = ?');
      params.push(filters.clinic_id);
    }

    if (filters.doctor_name) {
      conditions.push('s.doctor_name = ?');
      params.push(filters.doctor_name);
    }

    if (filters.status) {
      conditions.push('s.status = ?');
      params.push(filters.status.toUpperCase());
    }

    if (filters.from_date) {
      conditions.push('s.start_time >= ?');
      params.push(filters.from_date);
    }

    if (filters.to_date) {
      conditions.push('s.end_time <= ?');
      params.push(filters.to_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT 
        s.id,
        s.clinic_id,
        s.doctor_name,
        s.start_time,
        s.end_time,
        s.status,
        s.created_at,
        s.updated_at,
        b.id AS booking_id,
        b.patient_name,
        b.patient_email,
        b.patient_phone,
        b.status AS booking_status
      FROM slots s
      LEFT JOIN bookings b ON b.slot_id = s.id AND b.status = 'CONFIRMED'
      ${whereClause}
      ORDER BY s.start_time ASC
    `;

    const stmt = db.prepare(query);
    const rows = stmt.all(...params);

    return rows.map(this.formatSlotRow);
  }

  static cancelSlot(id, customDb) {
    const db = customDb || getDb();

    const cancelTransaction = db.transaction(() => {
      const slotStmt = db.prepare('SELECT * FROM slots WHERE id = ?');
      const slot = slotStmt.get(id);

      if (!slot) {
        throw new NotFoundError(`Slot with ID ${id} not found`);
      }

      if (slot.status === 'CANCELLED') {
        throw new BadRequestError(`Slot with ID ${id} is already cancelled`);
      }

      let cancelledBookingId = null;
      if (slot.status === 'BOOKED') {
        const updateBookingStmt = db.prepare(`
          UPDATE bookings 
          SET status = 'CANCELLED', updated_at = datetime('now')
          WHERE slot_id = ? AND status = 'CONFIRMED'
        `);
        const bookingResult = updateBookingStmt.run(id);
        if (bookingResult.changes > 0) {
          cancelledBookingId = id;
        }
      }

      const updateSlotStmt = db.prepare(`
        UPDATE slots 
        SET status = 'CANCELLED', updated_at = datetime('now')
        WHERE id = ?
      `);
      updateSlotStmt.run(id);

      return {
        slotId: id,
        cancelledBooking: Boolean(cancelledBookingId),
      };
    });

    const result = cancelTransaction();
    return this.getSlotById(result.slotId, db);
  }

  static formatSlotRow(row) {
    const slot = {
      id: row.id,
      clinic_id: row.clinic_id,
      doctor_name: row.doctor_name,
      start_time: row.start_time,
      end_time: row.end_time,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      booking: null,
    };

    if (row.booking_id) {
      slot.booking = {
        id: row.booking_id,
        patient_name: row.patient_name,
        patient_email: row.patient_email,
        patient_phone: row.patient_phone,
        status: row.booking_status,
      };
    }

    return slot;
  }
}
