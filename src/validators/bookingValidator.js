const { BadRequestError } = require('../utils/errors');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the payload for creating a booking.
 * @param {object} body
 */
function validateCreateBooking(body) {
  const errors = [];
  const { slot_id, patient_name, patient_email, patient_phone } = body;

  const parsedSlotId = parseInt(slot_id, 10);
  if (!slot_id || isNaN(parsedSlotId) || parsedSlotId <= 0) {
    errors.push('slot_id is required and must be a positive integer');
  }

  if (!patient_name || typeof patient_name !== 'string' || patient_name.trim() === '') {
    errors.push('patient_name is required and must be a non-empty string');
  }

  if (!patient_email || typeof patient_email !== 'string' || !EMAIL_REGEX.test(patient_email.trim())) {
    errors.push('patient_email is required and must be a valid email address');
  }

  if (patient_phone !== undefined && patient_phone !== null) {
    if (typeof patient_phone !== 'string') {
      errors.push('patient_phone must be a string if provided');
    }
  }

  if (errors.length > 0) {
    throw new BadRequestError('Invalid booking data provided', errors);
  }

  return {
    slot_id: parsedSlotId,
    patient_name: patient_name.trim(),
    patient_email: patient_email.trim().toLowerCase(),
    patient_phone: patient_phone ? patient_phone.trim() : null,
  };
}

module.exports = {
  validateCreateBooking,
};
