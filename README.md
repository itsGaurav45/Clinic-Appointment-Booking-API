# Clinic Appointment Booking API

A RESTful API built with **Node.js**, **Express**, and **SQLite** for managing clinic time slots and patient appointment bookings, featuring strict race-condition handling to guarantee zero double-booking.

---

## Features

- **Slot Management**: Create, list (with filters), and cancel time slots.
- **Appointment Booking**: Patients can book available slots and cancel bookings.
- **Strict Concurrency Protection**: Physically prevents double-booking, even when concurrent requests arrive at the exact same moment.
- **Input Validation**: Validates date formats, chronologically valid time windows, non-empty fields, and valid emails with helpful error messages.
- **Overlap Prevention**: Prevents scheduling overlapping time slots for the same clinic and doctor.
- **Cascading Updates**: Cancelling an active booking releases the slot back to `AVAILABLE`. Cancelling a slot automatically marks any active booking as `CANCELLED`.
- **Automated Test Suite**: Comprehensive tests covering validation, slot/booking lifecycle, and high-concurrency race condition scenarios.

---

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: SQLite with `better-sqlite3` (WAL mode enabled)
- **Testing**: Jest, Supertest

---

## How Double-Booking is Prevented

Preventing race conditions where two requests arrive simultaneously is achieved through a multi-layered database strategy:

1. **Atomic Transactions (`BEGIN IMMEDIATE`)**:
   Transactions lock SQLite's write access immediately rather than deferring the lock until the first write. This serializes concurrent booking operations.

2. **Conditional Atomic Update**:
   ```sql
   UPDATE slots 
   SET status = 'BOOKED', updated_at = datetime('now') 
   WHERE id = ? AND status = 'AVAILABLE';
   ```
   If two requests hit concurrently, the first request updates the row (`changes = 1`). The second request finds `status` is no longer `'AVAILABLE'`, updates 0 rows (`changes = 0`), and is immediately rejected with an HTTP `409 Conflict`.

3. **Database Unique Partial Index**:
   ```sql
   CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_booking 
   ON bookings(slot_id) WHERE status = 'CONFIRMED';
   ```
   At the database engine level, this constraint physically blocks more than one active confirmed booking for any slot, serving as a hard safety guarantee.

---

## Getting Started

### Prerequisites

- Node.js (v18+)
- npm (v9+)

### Installation

```bash
git clone <repository-url>
cd Task
npm install
```

### Running the API

Start development server (with nodemon):
```bash
npm run dev
```

Or start standard production server:
```bash
npm start
```

The server will listen at `http://localhost:5000`.

### Seeding Sample Data

To populate sample clinics, doctors, and slots for testing:
```bash
npm run seed
```

### Running Automated Tests

Run the test suite:
```bash
npm test
```

The test runner will execute:
- Slot creation, validation, overlapping check, and cancellation tests.
- Booking creation, validation, sequential rejection, and cancellation tests.
- **Concurrency tests**: Dispatches parallel concurrent requests at the exact same millisecond to verify that only 1 succeeds and the rest return `409 Conflict`.

---

## API Endpoints Reference

### 1. Slots

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `POST` | `/api/slots` | Publish a new time slot | `201`, `400`, `409` |
| `GET` | `/api/slots` | List slots (supports query filters) | `200` |
| `GET` | `/api/slots/:id` | Get slot details by ID | `200`, `404` |
| `PATCH` | `/api/slots/:id/cancel` | Cancel a slot | `200`, `400`, `404` |

#### Create Slot
`POST /api/slots`

Request Body:
```json
{
  "clinic_id": "apollo-delhi",
  "doctor_name": "Dr. Rajesh Sharma",
  "start_time": "2026-11-15T10:00:00.000Z",
  "end_time": "2026-11-15T10:30:00.000Z"
}
```

Response (`201 Created`):
```json
{
  "success": true,
  "message": "Slot created successfully",
  "data": {
    "id": 1,
    "clinic_id": "apollo-delhi",
    "doctor_name": "Dr. Rajesh Sharma",
    "start_time": "2026-11-15T10:00:00.000Z",
    "end_time": "2026-11-15T10:30:00.000Z",
    "status": "AVAILABLE",
    "booking": null
  }
}
```

#### List Slots with Filters
`GET /api/slots?clinic_id=apollo-delhi&status=AVAILABLE`

Query parameters supported:
- `clinic_id`: string
- `doctor_name`: string
- `status`: `AVAILABLE`, `BOOKED`, or `CANCELLED`
- `from_date`: ISO date string
- `to_date`: ISO date string

---

### 2. Bookings

| Method | Endpoint | Description | Status Codes |
|---|---|---|---|
| `POST` | `/api/bookings` | Book an available slot | `201`, `400`, `404`, `409` |
| `GET` | `/api/bookings` | List bookings (filters: `patient_email`, `status`) | `200` |
| `GET` | `/api/bookings/:id` | Get booking by ID | `200`, `404` |
| `PATCH` | `/api/bookings/:id/cancel` | Cancel an appointment | `200`, `400`, `404` |

#### Book an Appointment
`POST /api/bookings`

Request Body:
```json
{
  "slot_id": 1,
  "patient_name": "Rahul Verma",
  "patient_email": "rahul@example.com",
  "patient_phone": "+919876543210"
}
```

Response (`201 Created`):
```json
{
  "success": true,
  "message": "Appointment booked successfully",
  "data": {
    "id": 1,
    "slot_id": 1,
    "patient_name": "Rahul Verma",
    "patient_email": "rahul@example.com",
    "patient_phone": "+919876543210",
    "status": "CONFIRMED",
    "created_at": "2026-11-10 09:30:00",
    "slot": {
      "clinic_id": "apollo-delhi",
      "doctor_name": "Dr. Rajesh Sharma",
      "start_time": "2026-11-15T10:00:00.000Z",
      "end_time": "2026-11-15T10:30:00.000Z",
      "status": "BOOKED"
    }
  }
}
```

Conflict Response when slot is already booked (`409 Conflict`):
```json
{
  "success": false,
  "error": "Slot 1 is already booked"
}
```

#### Cancel an Appointment
`PATCH /api/bookings/:id/cancel`

Cancelling an appointment automatically updates the booking status to `CANCELLED` and marks the underlying slot back to `AVAILABLE` so another patient can book it.

---

## Project Structure

```
Task/
├── src/
│   ├── config/
│   │   └── db.js                 # Database initialization, WAL mode, schema & constraints
│   ├── controllers/
│   │   ├── slotController.js     # HTTP request handling for slots
│   │   └── bookingController.js  # HTTP request handling for bookings
│   ├── services/
│   │   ├── slotService.js        # Business logic, overlap checks, slot lifecycle
│   │   └── bookingService.js     # Atomic booking transactions, concurrency guards
│   ├── validators/
│   │   ├── slotValidator.js      # Input validation for slot creation
│   │   └── bookingValidator.js   # Input validation for patient bookings
│   ├── routes/
│   │   ├── slotRoutes.js         # Slot API route definitions
│   │   └── bookingRoutes.js      # Booking API route definitions
│   ├── middlewares/
│   │   └── errorHandler.js       # Central error handling middleware
│   ├── utils/
│   │   └── errors.js             # Custom domain error classes (400, 404, 409, 422)
│   ├── app.js                    # Express application factory
│   └── server.js                 # Entry point server listener
├── tests/
│   ├── slots.test.js             # Slot creation, validation, overlap & cancel tests
│   ├── bookings.test.js          # Booking lifecycle, rules & error handling tests
│   └── concurrency.test.js       # Parallel simultaneous request race condition tests
├── scripts/
│   └── seed.js                   # Seed data script for local testing
├── .gitignore
├── package.json
└── README.md
```
