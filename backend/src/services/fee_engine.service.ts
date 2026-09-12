import { FeeRepository } from '../repositories/fee.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { StudentRepository } from '../repositories/student.repository';
import { Student, Fee, Payment } from '../types';
import {
  COURSE_DEFINITIONS,
  normalizeCourseCode,
  getMaxSemestersForCourse,
  getSemesterCycleInfo,
  getNextPaymentCycle,
  CycleInfo,
} from '../constants/courses';

export type CentralizedFeeStatus =
  | 'PAID'
  | 'PENDING'
  | 'PARTIALLY PAID'
  | 'ADVANCE PAID'
  | 'FEE CLEARED';

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
  
  // Academic cycle
  current_cycle: CycleInfo;
  
  // Annual and installment calculation
  annual_fee: number;
  installment_1_fee: number; // 50% for Odd semester
  installment_2_fee: number; // 50% for Even semester
  
  // Financial breakdown
  previous_pending_fee: number;
  current_semester_fee: number;
  total_required_fee: number; // previous_pending_fee + current_semester_fee
  
  // Payments and ledger
  total_paid: number;
  paid_towards_previous: number;
  paid_towards_current: number;
  advance_amount: number;
  
  // Due & Status
  total_pending_amount: number;
  fee_status: CentralizedFeeStatus;
  status_message: string;
  is_cleared: boolean;
  
  // Next cycle
  next_payment_cycle: {
    next_semester: number | null;
    next_cycle_type: 'ODD' | 'EVEN' | 'COMPLETED';
    next_cycle_name: string;
    next_due_date: string;
    is_last_semester: boolean;
  };
  
  // Full fee items breakdown
  breakdown: FeeItemBreakdown[];
  recent_payments: Payment[];
}

export class FeeEngineService {
  /**
   * Centralized backend calculation engine for fee status, cycles, and installments.
   * Backend remains the SINGLE SOURCE OF TRUTH.
   */
  public static calculateStudentFeeStatus(studentId: string): DetailedFeeCalculation {
    const student = StudentRepository.findById(studentId);
    if (!student) {
      throw new Error(`Student not found with ID '${studentId}'`);
    }

    return this.computeForStudent(student);
  }

  public static computeForStudent(student: Student): DetailedFeeCalculation {
    const studentId = student.student_id;
    const normCourse = normalizeCourseCode(student.course) || student.course;
    const courseDef = COURSE_DEFINITIONS[normCourse];
    const maxSemesters = courseDef ? courseDef.total_semesters : getMaxSemestersForCourse(student.course);
    const durationYears = courseDef ? courseDef.duration_years : 3;

    const currentSemester = Number(student.semester) || 1;
    const currentCycle = getSemesterCycleInfo(currentSemester);
    const nextCycle = getNextPaymentCycle(currentSemester, maxSemesters);

    // Calculate annual fee:
    // If total_course_fee is set, annual fee = total_course_fee / duration_years.
    // Otherwise fallback to default annual fee from course definition.
    const totalCourseFee = Number(student.total_course_fee) || 0;
    const annualFee = totalCourseFee > 0
      ? Math.round(totalCourseFee / durationYears)
      : (courseDef?.default_annual_fee || 70000);

    // Two equal installments per year (50% each)
    const installment1 = Math.round(annualFee / 2);
    const installment2 = annualFee - installment1; // Handle odd numbers cleanly

    // Fetch existing fee demands and payments
    const feeRecords = FeeRepository.findByStudent(studentId);
    const payments = PaymentRepository.findByStudent(studentId);
    const totalPaid = PaymentRepository.getTotalPaidByStudent(studentId);

    // If there are no fee records at all for current semester, synthesize or check
    const today = new Date().toISOString().split('T')[0];

    // Build breakdown for each fee record
    // We categorize each fee into:
    // 1. Previous semester fee (< currentSemester)
    // 2. Current semester fee (=== currentSemester)
    // 3. Advance semester fee (> currentSemester)
    let previousPendingSum = 0;
    let currentSemesterFeeSum = 0;
    let advanceSemesterFeeSum = 0;

    // Simulate waterfall allocation of total payments:
    // Rule: Payments FIRST clear previous pending fees in chronological order,
    // THEN clear current semester fees,
    // Any remaining surplus is credited as advance fee.
    let remainingPaymentToAllocate = totalPaid;

    // Sort fee records by semester ascending, then due_date ascending
    const sortedFees = [...feeRecords].sort((a, b) => {
      if (a.semester !== b.semester) return a.semester - b.semester;
      return a.due_date.localeCompare(b.due_date);
    });

    const breakdown: FeeItemBreakdown[] = sortedFees.map((fee) => {
      const feeAmount = Number(fee.amount);
      const isPrevious = fee.semester < currentSemester;
      const isCurrent = fee.semester === currentSemester;
      const isAdvance = fee.semester > currentSemester;

      // Allocate from payments waterfall
      const allocatedPaid = Math.min(remainingPaymentToAllocate, feeAmount);
      remainingPaymentToAllocate -= allocatedPaid;
      const pending = Math.max(0, feeAmount - allocatedPaid);

      if (isPrevious) {
        previousPendingSum += pending;
      } else if (isCurrent) {
        currentSemesterFeeSum += feeAmount;
      } else if (isAdvance) {
        advanceSemesterFeeSum += feeAmount;
      }

      let status = 'PENDING';
      if (allocatedPaid >= feeAmount) {
        status = 'PAID';
      } else if (allocatedPaid > 0) {
        status = 'PARTIAL';
      } else if (fee.due_date < today) {
        status = 'OVERDUE';
      }

      const cycle = getSemesterCycleInfo(fee.semester);

      return {
        fee_id: fee.fee_id,
        semester: fee.semester,
        semester_label: `Semester ${fee.semester} (${cycle.cycle_name})`,
        cycle_type: cycle.cycle_type,
        fee_type: fee.fee_type,
        amount: feeAmount,
        paid_amount: allocatedPaid,
        pending_amount: pending,
        due_date: fee.due_date,
        status,
        is_previous_pending: isPrevious,
        is_current_semester: isCurrent,
        is_advance_semester: isAdvance,
      };
    });

    // If no fee record exists for current semester yet, default current semester fee
    // to installment amount so student always sees current semester demand
    const hasCurrentSemesterFee = sortedFees.some(f => f.semester === currentSemester);
    if (!hasCurrentSemesterFee && sortedFees.length === 0) {
      currentSemesterFeeSum = currentSemester % 2 !== 0 ? installment1 : installment2;
    }

    // Previous pending fee is the total unpaid amount from previous semesters
    const previousPendingFee = previousPendingSum;

    // Current semester fee total
    const currentSemesterFee = currentSemesterFeeSum;

    // Total required fee (Previous Pending + Current Semester)
    const totalRequired = previousPendingFee + currentSemesterFee;

    // Compute payments toward previous vs current vs advance
    let paidTowardsPrevious = 0;
    let paidTowardsCurrent = 0;
    let advanceAmount = 0;

    // Remaining payment after fully covering previous obligations
    let paymentTracker = totalPaid;
    
    // 1. Clear previous total fee obligations
    const prevTotalAmount = breakdown
      .filter(b => b.is_previous_pending)
      .reduce((sum, b) => sum + b.amount, 0);
    
    paidTowardsPrevious = Math.min(paymentTracker, prevTotalAmount);
    paymentTracker -= paidTowardsPrevious;

    // 2. Clear current semester fee obligations
    paidTowardsCurrent = Math.min(paymentTracker, currentSemesterFee);
    paymentTracker -= paidTowardsCurrent;

    // 3. Excess payment becomes advance fee
    advanceAmount = Math.max(0, paymentTracker);

    // Total pending balance
    const currentPending = Math.max(0, currentSemesterFee - paidTowardsCurrent);
    const totalPendingAmount = previousPendingFee + currentPending;

    // Centralized status determination:
    let feeStatus: CentralizedFeeStatus = 'PENDING';
    let isCleared = false;

    if (totalPendingAmount <= 0) {
      isCleared = true;
      if (advanceAmount > 0) {
        feeStatus = 'ADVANCE PAID';
      } else {
        feeStatus = 'FEE CLEARED';
      }
    } else {
      if (totalPaid > 0) {
        feeStatus = 'PARTIALLY PAID';
      } else {
        feeStatus = 'PENDING';
      }
    }

    // Status message requirement:
    // When all required fees are covered: "Your Fee is Cleared"
    // When something is pending, show proper fee breakdown message
    const statusMessage = isCleared
      ? 'Your Fee is Cleared'
      : `Pending Fee: ₹${totalPendingAmount.toLocaleString('en-IN')}`;

    return {
      student_id: student.student_id,
      student_name: student.student_name,
      enrollment_number: student.enrollment_number,
      course: student.course,
      normalized_course: normCourse,
      current_semester: currentSemester,
      max_semesters: maxSemesters,
      duration_years: durationYears,

      current_cycle: currentCycle,

      annual_fee: annualFee,
      installment_1_fee: installment1,
      installment_2_fee: installment2,

      previous_pending_fee: previousPendingFee,
      current_semester_fee: currentSemesterFee,
      total_required_fee: totalRequired,

      total_paid: totalPaid,
      paid_towards_previous: paidTowardsPrevious,
      paid_towards_current: paidTowardsCurrent,
      advance_amount: advanceAmount,

      total_pending_amount: totalPendingAmount,
      fee_status: feeStatus,
      status_message: statusMessage,
      is_cleared: isCleared,

      next_payment_cycle: nextCycle,

      breakdown,
      recent_payments: payments,
    };
  }
}
