import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
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

// Get specific payment details (Admin or Authenticated)
router.get('/:paymentId', authenticateJWT, PaymentController.getOne);

// List all payments (Admin only)
router.get('/', authenticateJWT, requireRole('ADMIN'), PaymentController.getAll);

export default router;
