import { Database } from '../db/database';
import { PaymentRepository } from '../repositories/payment.repository';
import { StudentRepository } from '../repositories/student.repository';
import { FeeRepository } from '../repositories/fee.repository';
import { config } from '../config/env';
import { Payment, PaymentOrder, Receipt, OrderStatus, FeeStatus } from '../types';
import {
  generatePaymentId,
  generateReceiptNumber,
  generateRazorpayOrderId,
} from '../utils/id_generator';
import { verifyRazorpaySignature } from '../utils/razorpay';
import { ReceiptService } from './receipt.service';
import { AppError } from '../utils/errors';

export interface CreateOrderDTO {
  student_id: string;
  amount: number;
  fee_id?: string;
  notes?: string;
}

export interface VerifyPaymentDTO {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  student_id: string;
  fee_id?: string;
  amount?: number;
  payment_method?: string;
}

export class PaymentService {
  /**
   * Helper to recalculate and persist the fee status based on actual successful payments
   */
  public static recalculateFeeStatus(feeId: string): FeeStatus {
    const fee = FeeRepository.findById(feeId);
    if (!fee) return 'PENDING';

    const totalPaidForFee = PaymentRepository.getTotalPaidByFee(feeId);
    let newStatus: FeeStatus = 'PENDING';

    if (totalPaidForFee >= Number(fee.amount)) {
      newStatus = 'PAID';
    } else if (totalPaidForFee > 0) {
      newStatus = 'PARTIAL';
    } else {
      const isOverdue = fee.due_date && new Date(fee.due_date) < new Date();
      newStatus = isOverdue ? 'OVERDUE' : 'PENDING';
    }

    FeeRepository.update(feeId, { status: newStatus });
    return newStatus;
  }

  /**
   * Creates a Razorpay payment order server-side.
   * Strictly validates student existence, fee existence, ownership, and amount limits.
   * Stores the order in payment_orders table.
   * Never exposes RAZORPAY_KEY_SECRET.
   */
  public static createOrder(data: CreateOrderDTO): {
    order_id: string;
    amount: number;
    currency: string;
    key_id: string;
    student_id: string;
    student_name: string;
    fee_id: string;
    receipt_hint: string;
  } {
    // 1. Validate student existence
    if (!data.student_id || !data.student_id.trim()) {
      throw new AppError('student_id is required', 400);
    }
    const student = StudentRepository.findById(data.student_id);
    if (!student) {
      throw new AppError(`Student not found with ID '${data.student_id}'`, 404);
    }

    if (student.status === 'SUSPENDED' || student.status === 'INACTIVE') {
      throw new AppError(`Student account is currently ${student.status}. Payments cannot be initiated.`, 400);
    }

    // 2. Validate fee existence & ownership
    if (!data.fee_id || !data.fee_id.trim()) {
      throw new AppError('fee_id is required to link payment to fee obligation', 400);
    }
    const fee = FeeRepository.findById(data.fee_id);
    if (!fee) {
      throw new AppError(`Fee record not found with ID '${data.fee_id}'`, 404);
    }
    if (fee.student_id !== data.student_id) {
      throw new AppError(`Fee record '${data.fee_id}' does not belong to student '${data.student_id}'`, 400);
    }

    // 3. Validate payment amount against applicable fee
    if (typeof data.amount !== 'number' || isNaN(data.amount) || Number(data.amount) <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }

    const alreadyPaid = PaymentRepository.getTotalPaidByFee(fee.fee_id);
    const remainingDue = Math.max(0, Number(fee.amount) - alreadyPaid);

    if (remainingDue <= 0) {
      throw new AppError(`Fee '${fee.fee_id}' is already fully paid. No further payments can be accepted.`, 400);
    }

    if (Number(data.amount) > remainingDue) {
      throw new AppError(`Payment amount (₹${data.amount}) exceeds outstanding fee balance (₹${remainingDue})`, 400);
    }

    // 4. Generate order identifier & receipt hint
    const orderId = generateRazorpayOrderId();
    const receiptHint = `rcpt_${Date.now().toString().slice(-6)}`;

    // 5. Store order in payment_orders table
    const order: PaymentOrder = {
      order_id: orderId,
      student_id: data.student_id,
      fee_id: fee.fee_id,
      amount: Number(data.amount),
      currency: 'INR',
      status: 'CREATED',
      receipt: receiptHint,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
    };

    PaymentRepository.createOrder(order);

    // Return safe public checkout parameters (Key secret is never exposed)
    return {
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      key_id: config.RAZORPAY_KEY_ID,
      student_id: student.student_id,
      student_name: student.student_name,
      fee_id: fee.fee_id,
      receipt_hint: receiptHint,
    };
  }

  /**
   * Verifies payment using official Razorpay HMAC-SHA256 signature verification.
   * Enforces DUPLICATE PAYMENT PROTECTION & DATABASE TRANSACTIONS.
   * Never marks a payment SUCCESS based only on frontend data.
   */
  public static verifyPayment(data: VerifyPaymentDTO): {
    payment: Payment;
    receipt: Receipt;
    is_duplicate: boolean;
  } {
    // -------------------------------------------------------------
    // RULE 1: DUPLICATE PAYMENT PROTECTION (IDEMPOTENCY)
    // -------------------------------------------------------------
    const existingPayment = PaymentRepository.findByRazorpayPaymentId(data.razorpay_payment_id);
    if (existingPayment) {
      const receipt = ReceiptService.getReceiptByPaymentId(existingPayment.payment_id);
      return {
        payment: existingPayment,
        receipt,
        is_duplicate: true,
      };
    }

    // -------------------------------------------------------------
    // RULE 2: VERIFY RAZORPAY SIGNATURE STRICTLY SERVER-SIDE (HMAC-SHA256)
    // -------------------------------------------------------------
    const isValidSignature = verifyRazorpaySignature({
      orderId: data.razorpay_order_id,
      paymentId: data.razorpay_payment_id,
      signature: data.razorpay_signature,
    });

    if (!isValidSignature) {
      throw new AppError('Razorpay signature verification failed. Invalid or tampered signature.', 400);
    }

    // -------------------------------------------------------------
    // RULE 3: VERIFY ORDER & STUDENT RELATIONSHIP
    // -------------------------------------------------------------
    const order = PaymentRepository.findOrderById(data.razorpay_order_id);
    if (!order) {
      throw new AppError(`Matching payment order not found for ID '${data.razorpay_order_id}'`, 404);
    }

    if (order.student_id !== data.student_id) {
      throw new AppError('Student ID does not match the payment order record', 400);
    }

    // Check if order was already completed by another payment
    const existingPaymentForOrder = PaymentRepository.findByRazorpayOrderId(data.razorpay_order_id);
    if (existingPaymentForOrder) {
      const receipt = ReceiptService.getReceiptByPaymentId(existingPaymentForOrder.payment_id);
      return {
        payment: existingPaymentForOrder,
        receipt,
        is_duplicate: true,
      };
    }

    // Rely on verified server order amount, never trusting client amount
    const paymentAmount = order.amount;
    const feeId = order.fee_id || data.fee_id || null;

    // -------------------------------------------------------------
    // RULE 4: ATOMIC DATABASE TRANSACTION FOR FINANCIAL MUTATION
    // -------------------------------------------------------------
    return Database.transaction(() => {
      // 1. Generate unique sequential payment ID & official receipt number
      const paymentSeq = PaymentRepository.getNextSequence();
      const paymentId = generatePaymentId(paymentSeq);

      const receiptSeq = PaymentRepository.getNextReceiptSequence();
      const receiptNumber = generateReceiptNumber(receiptSeq);

      // 2. Create the immutable payment record with SUCCESS status
      const payment: Payment = {
        payment_id: paymentId,
        student_id: data.student_id,
        fee_id: feeId,
        receipt_number: receiptNumber,
        amount: paymentAmount,
        razorpay_order_id: data.razorpay_order_id,
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_signature: data.razorpay_signature,
        payment_status: 'SUCCESS',
        payment_method: data.payment_method || 'ONLINE_RAZORPAY',
        payment_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const savedPayment = PaymentRepository.create(payment);

      // 3. Mark the internal payment order as PAID
      PaymentRepository.updateOrderStatus(order.order_id, 'PAID');

      // 4. Recalculate and update fee balance and status
      if (feeId) {
        this.recalculateFeeStatus(feeId);
      }

      // 5. Generate and return the official receipt (ONLY generated after successful verification)
      const receipt = ReceiptService.getReceiptByPaymentId(savedPayment.payment_id);

      return {
        payment: savedPayment,
        receipt,
        is_duplicate: false,
      };
    });
  }

  /**
   * Safely refunds a verified payment (Admin only).
   * Updates payment status to REFUNDED, recalculates fee balance and status,
   * and revokes receipt validity.
   */
  public static refundPayment(paymentId: string, reason?: string): {
    payment: Payment;
    refunded: boolean;
    message: string;
  } {
    const payment = PaymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError(`Payment record not found with ID '${paymentId}'`, 404);
    }

    if (payment.payment_status === 'REFUNDED') {
      throw new AppError(`Payment '${paymentId}' has already been refunded`, 400);
    }

    if (payment.payment_status !== 'SUCCESS') {
      throw new AppError(`Only successful payments can be refunded. Current status is '${payment.payment_status}'`, 400);
    }

    return Database.transaction(() => {
      // 1. Update payment status to REFUNDED
      PaymentRepository.updatePaymentStatus(paymentId, 'REFUNDED');

      // 2. Recalculate fee obligation status (excluding refunded payment)
      if (payment.fee_id) {
        this.recalculateFeeStatus(payment.fee_id);
      }

      const updatedPayment = PaymentRepository.findById(paymentId)!;

      return {
        payment: updatedPayment,
        refunded: true,
        message: `Payment '${paymentId}' of ₹${payment.amount} has been refunded successfully.${reason ? ` Reason: ${reason}` : ''}`,
      };
    });
  }

  /**
   * Safely records a failed payment attempt or failed order.
   * Ensures no fee is credited and no receipt is generated.
   */
  public static recordFailedPayment(data: {
    razorpay_order_id: string;
    razorpay_payment_id?: string;
    student_id?: string;
    fee_id?: string;
    error_code?: string;
    error_description?: string;
  }): {
    order_id: string;
    status: OrderStatus;
    recorded: boolean;
  } {
    const order = PaymentRepository.findOrderById(data.razorpay_order_id);
    if (order) {
      PaymentRepository.updateOrderStatus(order.order_id, 'FAILED');
    }

    return {
      order_id: data.razorpay_order_id,
      status: 'FAILED',
      recorded: true,
    };
  }

  public static getOrderById(orderId: string): PaymentOrder {
    const order = PaymentRepository.findOrderById(orderId);
    if (!order) {
      throw new AppError(`Payment order not found with ID '${orderId}'`, 404);
    }
    return order;
  }

  public static getOrdersByStudent(studentId: string): PaymentOrder[] {
    const student = StudentRepository.findById(studentId);
    if (!student) {
      throw new AppError(`Student not found with ID '${studentId}'`, 404);
    }
    return PaymentRepository.findOrdersByStudent(studentId);
  }

  public static getPaymentById(paymentId: string): Payment {
    const payment = PaymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError(`Payment not found with ID '${paymentId}'`, 404);
    }
    return payment;
  }

  public static getPaymentsByStudent(studentId: string): Payment[] {
    const student = StudentRepository.findById(studentId);
    if (!student) {
      throw new AppError(`Student not found with ID '${studentId}'`, 404);
    }
    return PaymentRepository.findByStudent(studentId);
  }

  public static getAllPayments(): Payment[] {
    return PaymentRepository.findAll();
  }

  public static getAllOrders(): PaymentOrder[] {
    return PaymentRepository.findAllOrders();
  }
}

