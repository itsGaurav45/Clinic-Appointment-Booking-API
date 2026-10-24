const request = require('supertest');
const createApp = require('../src/app');
const { initDatabase } = require('../src/config/db');

describe('Booking Concurrency & Race Conditions', () => {
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

  test('two requests at the same moment cannot double-book a slot', async () => {
    const slotRes = await request(app).post('/api/slots').send({
      clinic_id: 'clinic-1',
      doctor_name: 'Dr. Sharma',
      start_time: '2026-11-10T10:00:00.000Z',
      end_time: '2026-11-10T10:30:00.000Z',
    });
    const slotId = slotRes.body.data.id;

    // Send two booking requests concurrently
    const req1 = request(app).post('/api/bookings').send({
      slot_id: slotId,
      patient_name: 'Rahul Kumar',
      patient_email: 'rahul@example.com',
    });

    const req2 = request(app).post('/api/bookings').send({
      slot_id: slotId,
      patient_name: 'Priya Singh',
      patient_email: 'priya@example.com',
    });

    const [res1, res2] = await Promise.all([req1, req2]);
    const statuses = [res1.status, res2.status].sort();

    // Exactly one should succeed (201) and one should get a conflict (409)
    expect(statuses).toEqual([201, 409]);

    // Check database has only 1 confirmed booking
    const bookings = db.prepare('SELECT * FROM bookings WHERE slot_id = ?').all(slotId);
    expect(bookings.length).toBe(1);
    expect(bookings[0].status).toBe('CONFIRMED');

    // Slot status must be BOOKED
    const slot = db.prepare('SELECT status FROM slots WHERE id = ?').get(slotId);
    expect(slot.status).toBe('BOOKED');
  });

  test('multiple concurrent requests for the same slot result in only 1 booking', async () => {
    const slotRes = await request(app).post('/api/slots').send({
      clinic_id: 'clinic-2',
      doctor_name: 'Dr. Verma',
      start_time: '2026-11-12T14:00:00.000Z',
      end_time: '2026-11-12T14:30:00.000Z',
    });
    const slotId = slotRes.body.data.id;

    const requestCount = 15;
    const promises = Array.from({ length: requestCount }, (_, i) => {
      return request(app).post('/api/bookings').send({
        slot_id: slotId,
        patient_name: `Patient ${i + 1}`,
        patient_email: `patient_${i + 1}@example.com`,
      });
    });

    const responses = await Promise.all(promises);

    const success = responses.filter((r) => r.status === 201);
    const conflicts = responses.filter((r) => r.status === 409);

    expect(success.length).toBe(1);
    expect(conflicts.length).toBe(requestCount - 1);

    const confirmedInDb = db
      .prepare("SELECT * FROM bookings WHERE slot_id = ? AND status = 'CONFIRMED'")
      .all(slotId);
    expect(confirmedInDb.length).toBe(1);
  });
});
