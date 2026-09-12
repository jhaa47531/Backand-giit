export type StudentStatus = 'ACTIVE' | 'INACTIVE' | 'PASSOUT' | 'SUSPENDED';
export type FeeStatus = 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE';
export type PaymentStatus = 'SUCCESS' | 'REFUNDED' | 'FAILED' | 'PENDING';
export type CentralizedFeeStatus = 'PAID' | 'PENDING' | 'PARTIALLY PAID' | 'ADVANCE PAID' | 'FEE CLEARED';

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
  created_at?: string;
  updated_at?: string;
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
  paid_amount?: number;
  due_amount?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Payment {
  payment_id: string;
  student_id: string;
  fee_id: string;
  amount: number;
  payment_mode: string;
  transaction_reference: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  payment_status: PaymentStatus;
  payment_date: string;
}

export interface FeeItemBreakdown {
  fee_id: string;
  semester: number;
  semester_label: string;
  cycle_type: 'ODD' | 'EVEN';
  fee_type: string;
  amount: number;
  paid_amount: number;
  pending_amount: number;
  due_date: string;
  status: string;
  is_previous_pending: boolean;
  is_current_semester: boolean;
  is_advance_semester: boolean;
}

export interface DetailedFeeCalculation {
  student_id: string;
  student_name: string;
  enrollment_number: string;
  course: string;
  normalized_course: string;
  current_semester: number;
  max_semesters: number;
  duration_years: number;
  current_cycle: {
    semester: number;
    cycle_type: 'ODD' | 'EVEN';
    cycle_name: string;
    session_cycle_label: string;
    advance_due_date_str: string;
  };
  annual_fee: number;
  installment_1_fee: number;
  installment_2_fee: number;
  previous_pending_fee: number;
  current_semester_fee: number;
  total_required_fee: number;
  total_paid: number;
  paid_towards_previous: number;
  paid_towards_current: number;
  advance_amount: number;
  total_pending_amount: number;
  fee_status: CentralizedFeeStatus;
  status_message: string;
  is_cleared: boolean;
  next_payment_cycle: {
    next_semester: number | null;
    next_cycle_type: 'ODD' | 'EVEN' | 'COMPLETED';
    next_cycle_name: string;
    next_due_date: string;
    is_last_semester: boolean;
  };
  breakdown: FeeItemBreakdown[];
  recent_payments: Payment[];
}

export interface CourseDefinition {
  code: string;
  name: string;
  total_semesters: number;
  duration_years: number;
  default_annual_fee: number;
}
