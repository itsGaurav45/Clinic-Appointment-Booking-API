import express from 'express';
import BookingController from '../controllers/bookingController.js';

const router = express.Router();

router.post('/', BookingController.create);
router.get('/', BookingController.list);
router.get('/:id', BookingController.getById);
router.patch('/:id/cancel', BookingController.cancel);
router.delete('/:id', BookingController.cancel);

export default router;
