import { Router } from 'express';
import { FeeController } from '../controllers/fee.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { validateBody, createFeeSchema, updateFeeSchema } from '../middleware/validate.middleware';

const router = Router();

// Create fee obligation (Admin only) - can specify student_id in body
router.post('/', authenticateJWT, requireRole('ADMIN'), validateBody(createFeeSchema), FeeController.create);

// Get all fees or filter by student_id query (Admin or Authenticated)
router.get('/', authenticateJWT, FeeController.getAll);

// Get specific fee record (Admin or Authenticated)
router.get('/:feeId', authenticateJWT, FeeController.getOne);

// Update fee record (Admin only)
router.put('/:feeId', authenticateJWT, requireRole('ADMIN'), validateBody(updateFeeSchema), FeeController.update);

// Delete fee record (Admin only)
router.delete('/:feeId', authenticateJWT, requireRole('ADMIN'), FeeController.delete);

export default router;
