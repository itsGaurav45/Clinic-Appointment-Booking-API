import express from 'express';
import SlotController from '../controllers/slotController.js';

const router = express.Router();

router.post('/', SlotController.create);
router.get('/', SlotController.list);
router.get('/:id', SlotController.getById);
router.patch('/:id/cancel', SlotController.cancel);
router.delete('/:id', SlotController.cancel);

export default router;
