import request from 'supertest';
import createApp from '../src/app.js';
import { initDatabase } from '../src/config/db.js';

describe('Booking Rules & API Endpoints', () => {
  let app;
  let db;

  beforeEach(() => {
    db = initDatabase(':memory:');
    app = createApp({ db });
  });

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
  });

  describe('POST /api/bookings - Appointment Booking', () => {
    let availableSlotId;

    beforeEach(async () => {
      const slotRes = await request(app).post('/api/slots').send({
        clinic_id: 'apollo-delhi',
        doctor_name: 'Dr. Rajesh',
        start_time: '2026-11-05T09:00:00.000Z',
        end_time: '2026-11-05T09:30:00.000Z',
      });
      availableSlotId = slotRes.body.data.id;
    });

    test('successfully books an available slot', async () => {
      const payload = {
        slot_id: availableSlotId,
        patient_name: 'Rohit Sharma',
        patient_email: 'rohit@example.com',
        patient_phone: '+919876543210',
      };

      const res = await request(app).post('/api/bookings').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.patient_name).toBe('Rohit Sharma');
      expect(res.body.data.patient_email).toBe('rohit@example.com');
      expect(res.body.data.status).toBe('CONFIRMED');
      expect(res.body.data.slot.status).toBe('BOOKED');

      const slotRes = await request(app).get(`/api/slots/${availableSlotId}`);
      expect(slotRes.body.data.status).toBe('BOOKED');
      expect(slotRes.body.data.booking.patient_name).toBe('Rohit Sharma');
    });

    test('validates input and returns helpful error when patient email is invalid', async () => {
      const payload = {
        slot_id: availableSlotId,
        patient_name: 'Rohit Sharma',
        patient_email: 'invalid-email-address',
      };

      const res = await request(app).post('/api/bookings').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toContain('patient_email is required and must be a valid email address');
    });

    test('returns 404 when attempting to book a non-existent slot', async () => {
      const payload = {
        slot_id: 99999,
        patient_name: 'Rohit Sharma',
        patient_email: 'rohit@example.com',
      };

      const res = await request(app).post('/api/bookings').send(payload);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('does not exist');
    });

    test('returns 409 Conflict when attempting to book an already booked slot', async () => {
      await request(app).post('/api/bookings').send({
        slot_id: availableSlotId,
        patient_name: 'Patient One',
        patient_email: 'patient1@example.com',
      });

      const secondRes = await request(app).post('/api/bookings').send({
        slot_id: availableSlotId,
        patient_name: 'Patient Two',
        patient_email: 'patient2@example.com',
      });

      expect(secondRes.status).toBe(409);
      expect(secondRes.body.success).toBe(false);
      expect(secondRes.body.error).toContain('is already booked');
    });

    test('returns 400 when attempting to book a slot cancelled by the clinic', async () => {
      await request(app).patch(`/api/slots/${availableSlotId}/cancel`);

      const res = await request(app).post('/api/bookings').send({
        slot_id: availableSlotId,
        patient_name: 'Rohit Sharma',
        patient_email: 'rohit@example.com',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('cancelled by the clinic');
    });
  });

  describe('PATCH /api/bookings/:id/cancel - Booking Cancellation', () => {
    let slotId;
    let bookingId;

    beforeEach(async () => {
      const slotRes = await request(app).post('/api/slots').send({
        clinic_id: 'apollo-delhi',
        doctor_name: 'Dr. Rajesh',
        start_time: '2026-11-05T10:00:00.000Z',
        end_time: '2026-11-05T10:30:00.000Z',
      });
      slotId = slotRes.body.data.id;

      const bookRes = await request(app).post('/api/bookings').send({
        slot_id: slotId,
        patient_name: 'Virat Kohli',
        patient_email: 'virat@example.com',
      });
      bookingId = bookRes.body.data.id;
    });

    test('cancelling booking marks booking CANCELLED and frees slot back to AVAILABLE', async () => {
      const cancelRes = await request(app).patch(`/api/bookings/${bookingId}/cancel`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      const slotRes = await request(app).get(`/api/slots/${slotId}`);
      expect(slotRes.body.data.status).toBe('AVAILABLE');
      expect(slotRes.body.data.booking).toBeNull();
    });

    test('allows a new patient to book the slot after previous booking was cancelled', async () => {
      await request(app).patch(`/api/bookings/${bookingId}/cancel`);

      const newBookRes = await request(app).post('/api/bookings').send({
        slot_id: slotId,
        patient_name: 'Jasprit Bumrah',
        patient_email: 'jasprit@example.com',
      });

      expect(newBookRes.status).toBe(201);
      expect(newBookRes.body.data.patient_name).toBe('Jasprit Bumrah');
      expect(newBookRes.body.data.status).toBe('CONFIRMED');

      const slotRes = await request(app).get(`/api/slots/${slotId}`);
      expect(slotRes.body.data.status).toBe('BOOKED');
      expect(slotRes.body.data.booking.patient_name).toBe('Jasprit Bumrah');
    });

    test('returns 400 when trying to cancel an already cancelled booking', async () => {
      await request(app).patch(`/api/bookings/${bookingId}/cancel`);

      const secondCancel = await request(app).patch(`/api/bookings/${bookingId}/cancel`);
      expect(secondCancel.status).toBe(400);
      expect(secondCancel.body.error).toContain('is already cancelled');
    });
  });
});
