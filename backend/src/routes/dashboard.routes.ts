import { Router } from 'express';
import { DashboardController } from '../controllers/dashboard.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';

const router = Router();

// Dashboard analytics & metrics (Admin only)
router.get('/stats', authenticateJWT, requireRole('ADMIN'), DashboardController.getStats);

export default router;
