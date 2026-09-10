import { StudentRepository } from '../repositories/student.repository';
import { FeeRepository } from '../repositories/fee.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { DashboardStats } from '../types';

export class DashboardService {
  /**
   * Computes campus financial & student KPIs entirely from dynamic database records.
   */
  public static getStats(): DashboardStats {
    const total_students = StudentRepository.count();

    // Sum of course fees across all enrolled students
    const students = StudentRepository.findAll();
    const totalCourseFee = students.reduce((acc, s) => acc + Number(s.total_course_fee), 0);
    const totalFeeObligations = FeeRepository.getTotalFeeAmount();
    const total_fee = Math.max(totalCourseFee, totalFeeObligations);

    const total_collected = PaymentRepository.getTotalCollected();
    const total_due = Math.max(0, total_fee - total_collected);
    const total_pending_fees = FeeRepository.getPendingFeeCount();

    const recent_payments = PaymentRepository.findRecent(8);
    const recent_students = StudentRepository.findAll().slice(0, 8);

    return {
      total_students,
      total_fee,
      total_collected,
      total_due,
      total_pending_fees,
      recent_payments,
      recent_students,
    };
  }
}
