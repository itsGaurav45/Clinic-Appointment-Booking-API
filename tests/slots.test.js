import request from 'supertest';
import createApp from '../src/app.js';
import { initDatabase } from '../src/config/db.js';

describe('Slot Management Rules & API Endpoints', () => {
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

  describe('POST /api/slots - Slot Creation', () => {
    test('successfully creates a valid time slot', async () => {
      const payload = {
        clinic_id: 'clinic-apollo-1',
        doctor_name: 'Dr. Sharma',
        start_time: '2026-11-01T10:00:00.000Z',
        end_time: '2026-11-01T10:30:00.000Z',
      };

      const res = await request(app).post('/api/slots').send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.clinic_id).toBe('clinic-apollo-1');
      expect(res.body.data.doctor_name).toBe('Dr. Sharma');
      expect(res.body.data.status).toBe('AVAILABLE');
      expect(res.body.data.start_time).toBe('2026-11-01T10:00:00.000Z');
      expect(res.body.data.end_time).toBe('2026-11-01T10:30:00.000Z');
    });

    test('validates required fields and returns helpful errors', async () => {
      const res = await request(app).post('/api/slots').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Invalid slot data provided');
      expect(Array.isArray(res.body.details)).toBe(true);
      expect(res.body.details.length).toBeGreaterThanOrEqual(4);
    });

    test('rejects slot where start_time is greater than or equal to end_time', async () => {
      const payload = {
        clinic_id: 'clinic-apollo-1',
        doctor_name: 'Dr. Sharma',
        start_time: '2026-11-01T11:00:00.000Z',
        end_time: '2026-11-01T10:00:00.000Z',
      };

      const res = await request(app).post('/api/slots').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toContain('start_time must be strictly before end_time');
    });

    test('rejects slot with duration less than 5 minutes', async () => {
      const payload = {
        clinic_id: 'clinic-apollo-1',
        doctor_name: 'Dr. Sharma',
        start_time: '2026-11-01T10:00:00.000Z',
        end_time: '2026-11-01T10:02:00.000Z',
      };

      const res = await request(app).post('/api/slots').send(payload);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.details).toContain('Slot duration must be at least 5 minutes');
    });

    test('prevents overlapping time slots for the same clinic and doctor', async () => {
      const baseSlot = {
        clinic_id: 'clinic-apollo-1',
        doctor_name: 'Dr. Sharma',
        start_time: '2026-11-01T10:00:00.000Z',
        end_time: '2026-11-01T11:00:00.000Z',
      };

      const res1 = await request(app).post('/api/slots').send(baseSlot);
      expect(res1.status).toBe(201);

      const overlappingSlot = {
        clinic_id: 'clinic-apollo-1',
        doctor_name: 'Dr. Sharma',
        start_time: '2026-11-01T10:30:00.000Z',
        end_time: '2026-11-01T11:30:00.000Z',
      };

      const res2 = await request(app).post('/api/slots').send(overlappingSlot);
      expect(res2.status).toBe(409);
      expect(res2.body.success).toBe(false);
      expect(res2.body.error).toContain('already has an active slot overlapping');
    });

    test('allows same time slot for a different doctor at the same clinic', async () => {
      await request(app).post('/api/slots').send({
        clinic_id: 'clinic-apollo-1',
        doctor_name: 'Dr. Sharma',
        start_time: '2026-11-01T10:00:00.000Z',
        end_time: '2026-11-01T11:00:00.000Z',
      });

      const res = await request(app).post('/api/slots').send({
        clinic_id: 'clinic-apollo-1',
        doctor_name: 'Dr. Verma',
        start_time: '2026-11-01T10:00:00.000Z',
        end_time: '2026-11-01T11:00:00.000Z',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/slots - Listing & Filtering', () => {
    beforeEach(async () => {
      await request(app).post('/api/slots').send({
        clinic_id: 'clinic-1',
        doctor_name: 'Dr. A',
        start_time: '2026-11-01T09:00:00.000Z',
        end_time: '2026-11-01T09:30:00.000Z',
      });
      await request(app).post('/api/slots').send({
        clinic_id: 'clinic-1',
        doctor_name: 'Dr. B',
        start_time: '2026-11-01T10:00:00.000Z',
        end_time: '2026-11-01T10:30:00.000Z',
      });
      await request(app).post('/api/slots').send({
        clinic_id: 'clinic-2',
        doctor_name: 'Dr. C',
        start_time: '2026-11-01T11:00:00.000Z',
        end_time: '2026-11-01T11:30:00.000Z',
      });
    });

    test('lists all slots', async () => {
      const res = await request(app).get('/api/slots');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(3);
      expect(res.body.data.length).toBe(3);
    });

    test('filters slots by clinic_id', async () => {
      const res = await request(app).get('/api/slots?clinic_id=clinic-1');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(2);
      expect(res.body.data.every((s) => s.clinic_id === 'clinic-1')).toBe(true);
    });

    test('filters slots by doctor_name', async () => {
      const res = await request(app).get('/api/slots?doctor_name=Dr.%20B');
      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.data[0].doctor_name).toBe('Dr. B');
    });
  });

  describe('PATCH /api/slots/:id/cancel - Slot Cancellation', () => {
    test('cancels an available slot', async () => {
      const createRes = await request(app).post('/api/slots').send({
        clinic_id: 'clinic-1',
        doctor_name: 'Dr. Mehta',
        start_time: '2026-11-02T10:00:00.000Z',
        end_time: '2026-11-02T10:30:00.000Z',
      });

      const slotId = createRes.body.data.id;
      const cancelRes = await request(app).patch(`/api/slots/${slotId}/cancel`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');
    });

    test('returns 400 when cancelling an already cancelled slot', async () => {
      const createRes = await request(app).post('/api/slots').send({
        clinic_id: 'clinic-1',
        doctor_name: 'Dr. Mehta',
        start_time: '2026-11-02T10:00:00.000Z',
        end_time: '2026-11-02T10:30:00.000Z',
      });

      const slotId = createRes.body.data.id;
      await request(app).patch(`/api/slots/${slotId}/cancel`);

      const secondCancel = await request(app).patch(`/api/slots/${slotId}/cancel`);
      expect(secondCancel.status).toBe(400);
      expect(secondCancel.body.error).toContain('is already cancelled');
    });

    test('cancelling a booked slot also cancels its active booking', async () => {
      const createSlotRes = await request(app).post('/api/slots').send({
        clinic_id: 'clinic-1',
        doctor_name: 'Dr. Mehta',
        start_time: '2026-11-02T14:00:00.000Z',
        end_time: '2026-11-02T14:30:00.000Z',
      });

      const slotId = createSlotRes.body.data.id;

      const bookRes = await request(app).post('/api/bookings').send({
        slot_id: slotId,
        patient_name: 'Aarav Patel',
        patient_email: 'aarav@example.com',
      });
      expect(bookRes.status).toBe(201);
      const bookingId = bookRes.body.data.id;

      const cancelRes = await request(app).patch(`/api/slots/${slotId}/cancel`);
      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('CANCELLED');

      const checkBookingRes = await request(app).get(`/api/bookings/${bookingId}`);
      expect(checkBookingRes.status).toBe(200);
      expect(checkBookingRes.body.data.status).toBe('CANCELLED');
    });
  });
});
