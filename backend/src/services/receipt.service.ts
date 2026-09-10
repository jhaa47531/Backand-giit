import { PaymentRepository } from '../repositories/payment.repository';
import { StudentRepository } from '../repositories/student.repository';
import { FeeRepository } from '../repositories/fee.repository';
import { config } from '../config/env';
import { Receipt } from '../types';

export class ReceiptService {
  /**
   * Generates official receipt details for a verified payment.
   * Guarantees student identification using student_id, NOT student name alone.
   */
  public static getReceiptByPaymentId(paymentId: string): Receipt {
    const payment = PaymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error(`Payment record not found with ID '${paymentId}'`);
    }

    const student = StudentRepository.findById(payment.student_id);
    if (!student) {
      throw new Error(`Student record not found for ID '${payment.student_id}' associated with payment`);
    }

    let feeType = 'Tuition / Course Fee';
    if (payment.fee_id) {
      const fee = FeeRepository.findById(payment.fee_id);
      if (fee) {
        feeType = fee.fee_type;
      }
    }

    // Compute student's overall fee standing
    const fees = FeeRepository.findByStudent(student.student_id);
    const totalFeeObligations = fees.reduce((acc, f) => acc + Number(f.amount), 0);
    const totalFee = Math.max(Number(student.total_course_fee), totalFeeObligations);
    const totalPaid = PaymentRepository.getTotalPaidByStudent(student.student_id);
    const totalDue = Math.max(0, totalFee - totalPaid);

    const receipt: Receipt = {
      institution_name: config.INSTITUTION.NAME,
      institution_short_name: config.INSTITUTION.SHORT_NAME,
      receipt_number: payment.receipt_number,
      payment_id: payment.payment_id,
      payment_date: payment.payment_date,
      student_id: student.student_id,
      student_name: student.student_name,
      enrollment_number: student.enrollment_number,
      course: student.course,
      semester: student.semester,
      academic_session: student.academic_session,
      fee_type: feeType,
      amount_paid: Number(payment.amount),
      payment_status: payment.payment_status,
      payment_method: payment.payment_method,
      razorpay_order_id: payment.razorpay_order_id,
      razorpay_payment_id: payment.razorpay_payment_id,
      total_fee_for_student: totalFee,
      total_paid_by_student: totalPaid,
      total_due_for_student: totalDue,
    };

    return receipt;
  }

  public static getReceiptByReceiptNumber(receiptNumber: string): Receipt {
    const payment = PaymentRepository.findByReceiptNumber(receiptNumber.trim());
    if (!payment) {
      throw new Error(`Receipt not found with number '${receiptNumber}'`);
    }
    return this.getReceiptByPaymentId(payment.payment_id);
  }
}
