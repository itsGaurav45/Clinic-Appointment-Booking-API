const BookingService = require('../services/bookingService');
const { validateCreateBooking } = require('../validators/bookingValidator');

class BookingController {
  static create(req, res, next) {
    try {
      const validatedData = validateCreateBooking(req.body);
      const booking = BookingService.createBooking(validatedData, req.app.locals.db);
      return res.status(201).json({
        success: true,
        message: 'Appointment booked successfully',
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  }

  static list(req, res, next) {
    try {
      const filters = {
        patient_email: req.query.patient_email,
        slot_id: req.query.slot_id ? parseInt(req.query.slot_id, 10) : undefined,
        status: req.query.status,
      };
      const bookings = BookingService.listBookings(filters, req.app.locals.db);
      return res.status(200).json({
        success: true,
        count: bookings.length,
        data: bookings,
      });
    } catch (err) {
      next(err);
    }
  }

  static getById(req, res, next) {
    try {
      const bookingId = parseInt(req.params.id, 10);
      const booking = BookingService.getBookingById(bookingId, req.app.locals.db);
      return res.status(200).json({
        success: true,
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  }

  static cancel(req, res, next) {
    try {
      const bookingId = parseInt(req.params.id, 10);
      const booking = BookingService.cancelBooking(bookingId, req.app.locals.db);
      return res.status(200).json({
        success: true,
        message: 'Booking cancelled successfully. Slot has been freed for other patients.',
        data: booking,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = BookingController;
