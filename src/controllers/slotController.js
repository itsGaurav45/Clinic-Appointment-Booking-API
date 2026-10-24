import SlotService from '../services/slotService.js';
import { validateCreateSlot } from '../validators/slotValidator.js';

export default class SlotController {
  static create(req, res, next) {
    try {
      const validatedData = validateCreateSlot(req.body);
      const slot = SlotService.createSlot(validatedData, req.app.locals.db);
      return res.status(201).json({
        success: true,
        message: 'Slot created successfully',
        data: slot,
      });
    } catch (err) {
      next(err);
    }
  }

  static list(req, res, next) {
    try {
      const filters = {
        clinic_id: req.query.clinic_id,
        doctor_name: req.query.doctor_name,
        status: req.query.status,
        from_date: req.query.from_date,
        to_date: req.query.to_date,
      };
      const slots = SlotService.listSlots(filters, req.app.locals.db);
      return res.status(200).json({
        success: true,
        count: slots.length,
        data: slots,
      });
    } catch (err) {
      next(err);
    }
  }

  static getById(req, res, next) {
    try {
      const slotId = parseInt(req.params.id, 10);
      const slot = SlotService.getSlotById(slotId, req.app.locals.db);
      return res.status(200).json({
        success: true,
        data: slot,
      });
    } catch (err) {
      next(err);
    }
  }

  static cancel(req, res, next) {
    try {
      const slotId = parseInt(req.params.id, 10);
      const slot = SlotService.cancelSlot(slotId, req.app.locals.db);
      return res.status(200).json({
        success: true,
        message: 'Slot cancelled successfully',
        data: slot,
      });
    } catch (err) {
      next(err);
    }
  }
}
