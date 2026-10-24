import { BadRequestError } from '../utils/errors.js';

export function validateCreateSlot(body) {
  const errors = [];
  const { clinic_id, doctor_name, start_time, end_time } = body;

  if (!clinic_id || typeof clinic_id !== 'string' || clinic_id.trim() === '') {
    errors.push('clinic_id is required and must be a non-empty string');
  }

  if (!doctor_name || typeof doctor_name !== 'string' || doctor_name.trim() === '') {
    errors.push('doctor_name is required and must be a non-empty string');
  }

  if (!start_time || typeof start_time !== 'string') {
    errors.push('start_time is required and must be a valid ISO-8601 date string');
  }

  if (!end_time || typeof end_time !== 'string') {
    errors.push('end_time is required and must be a valid ISO-8601 date string');
  }

  let startDate, endDate;
  if (start_time) {
    startDate = new Date(start_time);
    if (isNaN(startDate.getTime())) {
      errors.push('start_time must be a valid date');
    }
  }

  if (end_time) {
    endDate = new Date(end_time);
    if (isNaN(endDate.getTime())) {
      errors.push('end_time must be a valid date');
    }
  }

  if (startDate && endDate && !isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
    if (startDate >= endDate) {
      errors.push('start_time must be strictly before end_time');
    }

    const durationMinutes = (endDate.getTime() - startDate.getTime()) / (1000 * 60);
    if (durationMinutes < 5) {
      errors.push('Slot duration must be at least 5 minutes');
    }
  }

  if (errors.length > 0) {
    throw new BadRequestError('Invalid slot data provided', errors);
  }

  return {
    clinic_id: clinic_id.trim(),
    doctor_name: doctor_name.trim(),
    start_time: startDate.toISOString(),
    end_time: endDate.toISOString(),
  };
}
