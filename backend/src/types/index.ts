export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'PASSOUT' | 'SUSPENDED';
export type FeeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
export type PaymentStatus = 'SUCCESS' | 'REFUNDED' | 'FAILED';
export type UserRole = 'ADMIN' | 'STUDENT';
export type OrderStatus = 'CREATED' | 'PAID' | 'EXPIRED' | 'FAILED';

export interface Student {
  student_id: string;
  enrollment_number: string;
  student_name: string;
  father_name: string | null;
  mother_name: string | null;
  course: string;
  semester: number;
  academic_session: string;
  mobile: string;
  email: string | null;
  date_of_birth: string | null;
  address: string | null;
  admission_date: string;
  total_course_fee: number;
  status: StudentStatus;
  created_at: string;
  updated_at: string;
}

export interface Fee {
  fee_id: string;
  student_id: string;
  academic_session: string;
  course: string;
  semester: number;
  fee_type: string;
  amount: number;
  due_date: string;
  status: FeeStatus;
  created_at: string;
  updated_at: string;
}

export interface Payment {
  payment_id: string;
  student_id: string;
  fee_id: string | null;
  receipt_number: string;
  amount: number;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  payment_status: PaymentStatus;
  payment_method: string;
  payment_date: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentOrder {
  order_id: string;
  student_id: string;
  fee_id: string | null;
  amount: number;
  currency: string;
  status: OrderStatus;
  receipt: string;
  notes: string | null;
  created_at: string;
}

export interface User {
  user_id: string;
  username: string;
  password_hash: string;
  role: UserRole;
  student_id: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface StudentFeeSummary {
  student: Student;
  total_fee: number;
  total_paid: number;
  total_due: number;
  fee_records: Fee[];
  recent_payments: Payment[];
}

export interface Receipt {
  institution_name: string;
  institution_short_name: string;
  receipt_number: string;
  payment_id: string;
  payment_date: string;
  student_id: string;
  student_name: string;
  enrollment_number: string;
  course: string;
  semester: number;
  academic_session: string;
  fee_type: string;
  amount_paid: number;
  payment_status: PaymentStatus;
  payment_method: string;
  razorpay_order_id: string;
  razorpay_payment_id: string;
  total_fee_for_student: number;
  total_paid_by_student: number;
  total_due_for_student: number;
}

export interface DashboardStats {
  total_students: number;
  total_fee: number;
  total_collected: number;
  total_due: number;
  total_pending_fees: number;
  recent_payments: Array<Payment & { student_name: string; enrollment_number: string; course: string }>;
  recent_students: Student[];
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any;
}

export interface AuthTokenPayload {
  user_id: string;
  username: string;
  role: UserRole;
  student_id?: string | null;
}
