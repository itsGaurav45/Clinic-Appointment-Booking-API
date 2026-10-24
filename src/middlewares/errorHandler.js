import { AppError } from '../utils/errors.js';

export default function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details || undefined,
    });
  }

  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({
      success: false,
      error: 'A unique constraint violation occurred.',
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    error: 'Internal Server Error',
  });
}
