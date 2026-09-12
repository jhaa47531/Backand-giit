import { Router } from 'express';
import { StudentController } from '../controllers/student.controller';
import { FeeController } from '../controllers/fee.controller';
import { PaymentController } from '../controllers/payment.controller';
import { authenticateJWT, requireRole, enforceStudentAccess } from '../middleware/auth.middleware';
import { validateBody, createStudentSchema, updateStudentSchema, createFeeSchema } from '../middleware/validate.middleware';

const router = Router();

// Search students (Admin only)
router.get('/search', authenticateJWT, requireRole('ADMIN'), StudentController.search);

// Create student (Admin only)
router.post(
  '/',
  authenticateJWT,
  requireRole('ADMIN'),
  validateBody(createStudentSchema),
  StudentController.create
);

// Get all students (Admin only)
router.get('/', authenticateJWT, requireRole('ADMIN'), StudentController.getAll);

// Get specific student profile (Admin or same Student)
router.get(
  '/:studentId',
  authenticateJWT,
  enforceStudentAccess,
  StudentController.getOne
);

// Update student profile (Admin only)
router.put(
  '/:studentId',
  authenticateJWT,
  requireRole('ADMIN'),
  validateBody(updateStudentSchema),
  StudentController.update
);

// Delete student (Admin only)
router.delete(
  '/:studentId',
  authenticateJWT,
  requireRole('ADMIN'),
  StudentController.delete
);

// Get student overall fee summary (Admin or same Student)
router.get(
  '/:studentId/summary',
  authenticateJWT,
  enforceStudentAccess,
  StudentController.getFeeSummary
);

// Get student centralized fee calculation breakdown (Admin or same Student)
router.get(
  '/:studentId/fee-status',
  authenticateJWT,
  enforceStudentAccess,
  StudentController.getFeeStatus
);

// Fee obligations for student (Admin or same Student)
router.get(
  '/:studentId/fees',
  authenticateJWT,
  enforceStudentAccess,
  FeeController.getByStudent
);

// Create fee obligation for student (Admin only)
router.post(
  '/:studentId/fees',
  authenticateJWT,
  requireRole('ADMIN'),
  validateBody(createFeeSchema),
  FeeController.create
);

// Payment history for student (Admin or same Student)
router.get(
  '/:studentId/payments',
  authenticateJWT,
  enforceStudentAccess,
  PaymentController.getByStudent
);

export default router;
