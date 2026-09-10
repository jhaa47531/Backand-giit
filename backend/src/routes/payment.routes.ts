import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { ReceiptController } from '../controllers/receipt.controller';
import { authenticateJWT, requireRole, enforceStudentAccess } from '../middleware/auth.middleware';
import { validateBody, createPaymentOrderSchema, verifyPaymentSchema } from '../middleware/validate.middleware';

const router = Router();

// Create Razorpay checkout order (Admin or authenticated Student paying own fees)
router.post(
  '/create-order',
  authenticateJWT,
  validateBody(createPaymentOrderSchema),
  enforceStudentAccess,
  PaymentController.createOrder
);

// Verify Razorpay payment and commit payment record (Accessible during checkout flow)
router.post(
  '/verify',
  validateBody(verifyPaymentSchema),
  PaymentController.verify
);

// Record payment failure (e.g. from Razorpay checkout modal failure or cancellation)
router.post('/fail', PaymentController.recordFailure);

// Get specific payment order status
router.get('/orders/:orderId', authenticateJWT, PaymentController.getOrder);

// List all payment orders (Admin only)
router.get('/orders', authenticateJWT, requireRole('ADMIN'), PaymentController.getAllOrders);

// Refund a payment (Admin only)
router.post('/:paymentId/refund', authenticateJWT, requireRole('ADMIN'), PaymentController.refund);

// Get receipt for specific payment
router.get('/:paymentId/receipt', authenticateJWT, ReceiptController.getByPaymentId);

// Get specific payment details (Admin or Authenticated)
router.get('/:paymentId', authenticateJWT, PaymentController.getOne);

// List all payments (Admin only)
router.get('/', authenticateJWT, requireRole('ADMIN'), PaymentController.getAll);

export default router;
