import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { sendValidationError } from '../utils/response';

export function validateBody<T>(schema: z.ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.issues.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        }));
        sendValidationError(res, 'Validation failed for request body', formattedErrors);
        return;
      }
      sendValidationError(res, 'Invalid request data');
    }
  };
}

// Validation schemas for Student
export const createStudentSchema = z.object({
  enrollment_number: z.string().min(2, 'Enrollment number is required and must be at least 2 characters'),
  student_name: z.string().min(2, 'Student name is required and must be at least 2 characters'),
  father_name: z.string().optional(),
  mother_name: z.string().optional(),
  course: z.string().min(2, 'Course name is required (e.g. B.Tech CSE, BCA, MCA)'),
  semester: z.coerce.number().int().min(1, 'Semester must be at least 1').max(12, 'Semester cannot exceed 12'),
  academic_session: z.string().min(4, 'Academic session is required (e.g. 2024-2025)'),
  mobile: z.string().min(10, 'Valid 10-digit mobile number is required').max(15).optional().default('9800000000'),
  email: z.string().email('Invalid email address format').optional().or(z.literal('')),
  date_of_birth: z.string().optional(),
  address: z.string().optional(),
  admission_date: z.string().optional(),
  total_course_fee: z.coerce.number().min(0, 'Total course fee cannot be negative').optional(),
  initial_password: z.string().min(6, 'Password must be at least 6 characters').optional(),
});

export const updateStudentSchema = createStudentSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'PASSOUT', 'SUSPENDED']).optional(),
});

// Validation schemas for Fees
export const createFeeSchema = z.object({
  student_id: z.string().optional(),
  academic_session: z.string().min(4, 'Academic session is required'),
  course: z.string().min(2, 'Course is required'),
  semester: z.coerce.number().int().min(1).max(12),
  fee_type: z.string().min(2, 'Fee type is required (e.g. Tuition, Exam, Hostel)'),
  amount: z.coerce.number().positive('Fee amount must be greater than zero'),
  due_date: z.string().min(4, 'Due date is required (YYYY-MM-DD)'),
});

export const updateFeeSchema = z.object({
  academic_session: z.string().min(4).optional(),
  course: z.string().min(2).optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  fee_type: z.string().min(2).optional(),
  amount: z.coerce.number().positive('Fee amount must be greater than zero').optional(),
  due_date: z.string().min(4).optional(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE']).optional(),
});

// Validation schemas for Payments
export const createPaymentOrderSchema = z.object({
  student_id: z.string().min(1, 'student_id is required'),
  amount: z.coerce.number().positive('Payment amount must be greater than zero'),
  fee_id: z.string().optional(),
  notes: z.string().optional(),
});

export const verifyPaymentSchema = z.object({
  razorpay_order_id: z.string().min(1, 'razorpay_order_id is required'),
  razorpay_payment_id: z.string().min(1, 'razorpay_payment_id is required'),
  razorpay_signature: z.string().min(1, 'razorpay_signature is required'),
  student_id: z.string().min(1, 'student_id is required'),
  fee_id: z.string().optional(),
  amount: z.coerce.number().positive().optional(),
  payment_method: z.string().optional(),
});

// Validation schemas for Receipts
export const generateReceiptSchema = z.object({
  payment_id: z.string().min(1, 'payment_id is required'),
});

// Validation schemas for Auth
export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(6, 'New password must be at least 6 characters'),
});
