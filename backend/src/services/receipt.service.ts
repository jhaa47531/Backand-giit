import { PaymentRepository } from '../repositories/payment.repository';
import { StudentRepository } from '../repositories/student.repository';
import { FeeRepository } from '../repositories/fee.repository';
import { config } from '../config/env';
import { Fee, Receipt } from '../types';
import { generateReceiptNumber } from '../utils/id_generator';

export class ReceiptService {
  /**
   * Generates official receipt details for a successfully recorded payment.
   * Guarantees student identification using student_id, fee_id, payment_id and receipt_number.
   * Enforces strict 404 responses for missing payment, student or fee records.
   * Strictly forbids receipt generation for unsuccessful payments.
   */
  public static getReceiptByPaymentId(paymentId: string): Receipt {
    if (!paymentId || !paymentId.trim()) {
      const err: any = new Error('Payment ID is required');
      err.statusCode = 400;
      throw err;
    }

    // 1. Payment Record Check
    const payment = PaymentRepository.findById(paymentId.trim());
    if (!payment) {
      const err: any = new Error(`Payment record not found with ID '${paymentId}'`);
      err.statusCode = 404;
      throw err;
    }

    // Requirement 1: Receipt must be generated only for a successfully recorded payment.
    if (payment.payment_status !== 'SUCCESS') {
      const err: any = new Error(
        `Receipt cannot be generated for payment with status '${payment.payment_status}'. Only successfully recorded payments have receipts.`
      );
      err.statusCode = 400;
      throw err;
    }

    // 2. Student Record Check
    const student = StudentRepository.findById(payment.student_id);
    if (!student) {
      const err: any = new Error(`Student record not found with ID '${payment.student_id}' associated with payment`);
      err.statusCode = 404;
      throw err;
    }

    // 3. Fee Record Check (if fee_id was specified on payment)
    let fee: Fee | null = null;
    let feeType = 'Tuition / Course Fee';
    if (payment.fee_id) {
      fee = FeeRepository.findById(payment.fee_id);
      if (!fee) {
        const err: any = new Error(`Fee record not found with ID '${payment.fee_id}' associated with payment`);
        err.statusCode = 404;
        throw err;
      }
      feeType = fee.fee_type;
    }

    // Compute student's overall fee standing
    const fees = FeeRepository.findByStudent(student.student_id);
    const totalFeeObligations = fees.reduce((acc, f) => acc + Number(f.amount), 0);
    const totalFee = Math.max(Number(student.total_course_fee), totalFeeObligations);
    const totalPaid = PaymentRepository.getTotalPaidByStudent(student.student_id);
    const totalDue = Math.max(0, totalFee - totalPaid);

    // Build complete Receipt strictly omitting any internal secrets like RAZORPAY_KEY_SECRET
    const receipt: Receipt = {
      institution_name: config.INSTITUTION.NAME,
      institution_short_name: config.INSTITUTION.SHORT_NAME,
      receipt_number: payment.receipt_number,
      payment_id: payment.payment_id,
      payment_date: payment.payment_date,
      student_id: student.student_id,
      fee_id: payment.fee_id || null,
      student_name: student.student_name,
      enrollment_number: student.enrollment_number,
      course: student.course,
      semester: student.semester,
      academic_session: student.academic_session,
      fee_type: feeType,
      amount_paid: Number(payment.amount),
      amount: Number(payment.amount),
      payment_status: payment.payment_status,
      payment_method: payment.payment_method,
      razorpay_order_id: payment.razorpay_order_id || null,
      razorpay_payment_id: payment.razorpay_payment_id || null,
      student_details: {
        student_id: student.student_id,
        student_name: student.student_name,
        enrollment_number: student.enrollment_number,
        course: student.course,
        semester: student.semester,
        academic_session: student.academic_session,
        father_name: student.father_name || null,
        mother_name: student.mother_name || null,
        mobile: student.mobile,
        email: student.email || null,
      },
      fee_details: fee
        ? {
            fee_id: fee.fee_id,
            fee_type: fee.fee_type,
            amount: Number(fee.amount),
            due_date: fee.due_date || null,
            academic_session: fee.academic_session,
            semester: fee.semester,
            course: fee.course,
            status: fee.status,
          }
        : null,
      total_fee_for_student: totalFee,
      total_paid_by_student: totalPaid,
      total_due_for_student: totalDue,
    };

    return receipt;
  }

  /**
   * Retrieves official receipt by receipt_number (e.g. RCP-2026-00001).
   */
  public static getReceiptByReceiptNumber(receiptNumber: string): Receipt {
    if (!receiptNumber || !receiptNumber.trim()) {
      const err: any = new Error('Receipt number is required');
      err.statusCode = 400;
      throw err;
    }
    const payment = PaymentRepository.findByReceiptNumber(receiptNumber.trim());
    if (!payment) {
      const err: any = new Error(`Receipt not found with number '${receiptNumber}'`);
      err.statusCode = 404;
      throw err;
    }
    return this.getReceiptByPaymentId(payment.payment_id);
  }

  public static getReceiptByNumber(receiptNumber: string): Receipt {
    return this.getReceiptByReceiptNumber(receiptNumber);
  }

  /**
   * Retrieves receipt by identifier (either receipt_number or payment_id).
   */
  public static getReceiptByIdentifier(identifier: string): Receipt {
    if (!identifier || !identifier.trim()) {
      const err: any = new Error('Receipt number or payment ID identifier is required');
      err.statusCode = 400;
      throw err;
    }

    const trimmed = identifier.trim();

    // Check by receipt number
    const paymentByReceipt = PaymentRepository.findByReceiptNumber(trimmed);
    if (paymentByReceipt) {
      return this.getReceiptByPaymentId(paymentByReceipt.payment_id);
    }

    // Check by payment ID
    const paymentById = PaymentRepository.findById(trimmed);
    if (paymentById) {
      return this.getReceiptByPaymentId(paymentById.payment_id);
    }

    // Check by razorpay payment ID
    const paymentByRzp = PaymentRepository.findByRazorpayPaymentId(trimmed);
    if (paymentByRzp) {
      return this.getReceiptByPaymentId(paymentByRzp.payment_id);
    }

    const err: any = new Error(`Receipt not found with identifier '${identifier}'`);
    err.statusCode = 404;
    throw err;
  }

  /**
   * Generates or retrieves receipt for a recorded payment.
   * Requirement 7: Prevents duplicate receipts for the same successful payment.
   */
  public static generateReceiptForPayment(paymentId: string): { receipt: Receipt; is_duplicate: boolean } {
    const payment = PaymentRepository.findById(paymentId);
    if (!payment) {
      const err: any = new Error(`Payment record not found with ID '${paymentId}'`);
      err.statusCode = 404;
      throw err;
    }

    if (payment.payment_status !== 'SUCCESS') {
      const err: any = new Error(
        `Receipt cannot be generated for payment with status '${payment.payment_status}'. Only successfully recorded payments have receipts.`
      );
      err.statusCode = 400;
      throw err;
    }

    // Check student and fee existence
    const student = StudentRepository.findById(payment.student_id);
    if (!student) {
      const err: any = new Error(`Student record not found with ID '${payment.student_id}' associated with payment`);
      err.statusCode = 404;
      throw err;
    }

    if (payment.fee_id) {
      const fee = FeeRepository.findById(payment.fee_id);
      if (!fee) {
        const err: any = new Error(`Fee record not found with ID '${payment.fee_id}' associated with payment`);
        err.statusCode = 404;
        throw err;
      }
    }

    // If payment already has an official receipt_number, return it (duplicate prevention)
    if (payment.receipt_number) {
      return {
        receipt: this.getReceiptByPaymentId(payment.payment_id),
        is_duplicate: true,
      };
    }

    // Generate unique receipt number atomically
    const receiptSeq = PaymentRepository.getNextReceiptSequence();
    const receiptNumber = generateReceiptNumber(receiptSeq);
    PaymentRepository.updateReceiptNumber(payment.payment_id, receiptNumber);

    return {
      receipt: this.getReceiptByPaymentId(payment.payment_id),
      is_duplicate: false,
    };
  }

  /**
   * Retrieves all receipts for a student.
   */
  public static getReceiptsByStudent(studentId: string): Receipt[] {
    const student = StudentRepository.findById(studentId);
    if (!student) {
      const err: any = new Error(`Student record not found with ID '${studentId}'`);
      err.statusCode = 404;
      throw err;
    }

    const payments = PaymentRepository.findByStudent(studentId);
    const successfulPayments = payments.filter((p) => p.payment_status === 'SUCCESS' && Boolean(p.receipt_number));

    return successfulPayments.map((p) => this.getReceiptByPaymentId(p.payment_id));
  }

  /**
   * Retrieves all official receipts across the institution.
   */
  public static getAllReceipts(): Receipt[] {
    const payments = PaymentRepository.findAll();
    const successfulPayments = payments.filter((p) => p.payment_status === 'SUCCESS' && Boolean(p.receipt_number));

    return successfulPayments.map((p) => this.getReceiptByPaymentId(p.payment_id));
  }
}
