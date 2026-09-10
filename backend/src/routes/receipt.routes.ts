import { Router } from 'express';
import { ReceiptController } from '../controllers/receipt.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();

// Get official receipt by payment ID
router.get('/payment/:paymentId', authenticateJWT, ReceiptController.getByPaymentId);

// Get official receipt by receipt number (e.g. RCP-2026-00001)
router.get('/:receiptNumber', authenticateJWT, ReceiptController.getByNumber);

export default router;
