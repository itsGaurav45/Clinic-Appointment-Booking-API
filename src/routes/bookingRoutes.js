const express = require('express');
const BookingController = require('../controllers/bookingController');

const router = express.Router();

router.post('/', BookingController.create);
router.get('/', BookingController.list);
router.get('/:id', BookingController.getById);
router.patch('/:id/cancel', BookingController.cancel);
router.delete('/:id', BookingController.cancel);

module.exports = router;
