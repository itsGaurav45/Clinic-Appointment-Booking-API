const express = require('express');
const SlotController = require('../controllers/slotController');

const router = express.Router();

router.post('/', SlotController.create);
router.get('/', SlotController.list);
router.get('/:id', SlotController.getById);
router.patch('/:id/cancel', SlotController.cancel);
router.delete('/:id', SlotController.cancel);

module.exports = router;
