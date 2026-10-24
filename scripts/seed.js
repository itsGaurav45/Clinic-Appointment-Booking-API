import { getDb } from '../src/config/db.js';

export function seed() {
  const db = getDb();
  console.log('Seeding database with realistic clinic appointments...');

  db.exec(`
    DELETE FROM bookings;
    DELETE FROM slots;
  `);

  const now = new Date();
  
  const getTime = (daysOffset, hours, minutes = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + daysOffset);
    d.setHours(hours, minutes, 0, 0);
    return d.toISOString();
  };

  const sampleSlots = [
    {
      clinic_id: 'apollo-delhi',
      doctor_name: 'Dr. Rajesh Sharma (Cardiology)',
      start_time: getTime(1, 9, 0),
      end_time: getTime(1, 9, 30),
      status: 'AVAILABLE',
    },
    {
      clinic_id: 'apollo-delhi',
      doctor_name: 'Dr. Rajesh Sharma (Cardiology)',
      start_time: getTime(1, 10, 0),
      end_time: getTime(1, 10, 30),
      status: 'AVAILABLE',
    },
    {
      clinic_id: 'apollo-delhi',
      doctor_name: 'Dr. Rajesh Sharma (Cardiology)',
      start_time: getTime(1, 11, 0),
      end_time: getTime(1, 11, 30),
      status: 'AVAILABLE',
    },
    {
      clinic_id: 'apollo-delhi',
      doctor_name: 'Dr. Neha Gupta (Pediatrics)',
      start_time: getTime(1, 14, 0),
      end_time: getTime(1, 14, 30),
      status: 'AVAILABLE',
    },
    {
      clinic_id: 'apollo-delhi',
      doctor_name: 'Dr. Neha Gupta (Pediatrics)',
      start_time: getTime(1, 15, 0),
      end_time: getTime(1, 15, 30),
      status: 'AVAILABLE',
    },
    {
      clinic_id: 'fortis-noida',
      doctor_name: 'Dr. Amit Patel (Orthopedics)',
      start_time: getTime(2, 10, 0),
      end_time: getTime(2, 10, 45),
      status: 'AVAILABLE',
    },
    {
      clinic_id: 'fortis-noida',
      doctor_name: 'Dr. Amit Patel (Orthopedics)',
      start_time: getTime(2, 11, 0),
      end_time: getTime(2, 11, 45),
      status: 'AVAILABLE',
    },
    {
      clinic_id: 'max-gurugram',
      doctor_name: 'Dr. Sunita Rao (Dermatology)',
      start_time: getTime(2, 16, 0),
      end_time: getTime(2, 16, 30),
      status: 'AVAILABLE',
    },
  ];

  const insertSlot = db.prepare(`
    INSERT INTO slots (clinic_id, doctor_name, start_time, end_time, status)
    VALUES (@clinic_id, @doctor_name, @start_time, @end_time, @status)
  `);

  const insertManySlots = db.transaction((slots) => {
    for (const slot of slots) {
      insertSlot.run(slot);
    }
  });

  insertManySlots(sampleSlots);

  // Add one pre-booked sample slot for testing
  const prebookedSlot = db.prepare(`
    INSERT INTO slots (clinic_id, doctor_name, start_time, end_time, status)
    VALUES (?, ?, ?, ?, 'BOOKED')
  `).run(
    'apollo-delhi',
    'Dr. Rajesh Sharma (Cardiology)',
    getTime(1, 8, 30),
    getTime(1, 9, 0)
  );

  db.prepare(`
    INSERT INTO bookings (slot_id, patient_name, patient_email, patient_phone, status)
    VALUES (?, ?, ?, ?, 'CONFIRMED')
  `).run(
    prebookedSlot.lastInsertRowid,
    'Kavita Deshmukh',
    'kavita@example.com',
    '+919811223344'
  );

  console.log(`Database seeded successfully with ${sampleSlots.length + 1} slots and 1 sample booking!`);
}

seed();
