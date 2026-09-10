import { Router } from 'express';
import { ReceiptController } from '../controllers/receipt.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { validateBody, generateReceiptSchema } from '../middleware/validate.middleware';

const router = Router();

// Retrieve receipts by query (?payment_id=... / ?receipt_number=... / ?student_id=...) or all receipts
router.get('/', authenticateJWT, ReceiptController.getByQueryOrAll);

// Generate official receipt for payment (duplicate-safe idempotency)
router.post('/generate', authenticateJWT, validateBody(generateReceiptSchema), ReceiptController.generate);

// Get official receipt by payment ID
router.get('/payment/:paymentId', authenticateJWT, ReceiptController.getByPaymentId);

// Get official receipt by receipt number (e.g. RCP-2026-00001)
router.get('/number/:receiptNumber', authenticateJWT, ReceiptController.getByNumber);

// Get official receipt by identifier (receipt_number or payment_id)
router.get('/:identifier', authenticateJWT, ReceiptController.getByIdentifier);

export default router;

