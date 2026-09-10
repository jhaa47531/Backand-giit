import { Router } from 'express';
import { FeeController } from '../controllers/fee.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Get specific fee record (Admin or Authenticated)
router.get('/:feeId', authenticateJWT, FeeController.getOne);

// Update fee record (Admin only)
router.put('/:feeId', authenticateJWT, requireRole('ADMIN'), FeeController.update);

// Delete fee record (Admin only)
router.delete('/:feeId', authenticateJWT, requireRole('ADMIN'), FeeController.delete);

export default router;
