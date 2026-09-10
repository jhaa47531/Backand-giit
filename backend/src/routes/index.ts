import { Router } from 'express';
import studentRoutes from './student.routes';
import feeRoutes from './fee.routes';
import paymentRoutes from './payment.routes';
import receiptRoutes from './receipt.routes';
import authRoutes from './auth.routes';
import dashboardRoutes from './dashboard.routes';
import { sendSuccess } from '../utils/response';
import { config } from '../config/env';

const router = Router();

// API Health & Status
router.get('/health', (_req, res) => {
  sendSuccess(res, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'GIIT Fee Management Backend',
    institution: config.INSTITUTION.NAME,
    environment: config.NODE_ENV,
    version: '1.0.0',
  });
});

// Mount modular sub-routers
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/fees', feeRoutes);
router.use('/payments', paymentRoutes);
router.use('/receipts', receiptRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
