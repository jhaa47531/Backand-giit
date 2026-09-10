import { Database } from '../db/database';
import { PaymentRepository } from '../repositories/payment.repository';
import { StudentRepository } from '../repositories/student.repository';
import { FeeRepository } from '../repositories/fee.repository';
import { config } from '../config/env';
import { Payment, PaymentOrder, Receipt } from '../types';
import {
  generatePaymentId,
  generateReceiptNumber,
  generateRazorpayOrderId,
} from '../utils/id_generator';
import { verifyRazorpaySignature } from '../utils/razorpay';
import { ReceiptService } from './receipt.service';

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
   * Creates a Razorpay payment order server-side.
   */
  public static createOrder(data: CreateOrderDTO): {
    order_id: string;
    amount: number;
    currency: string;
    key_id: string;
    student_id: string;
    student_name: string;
    receipt_hint: string;
  } {
    const student = StudentRepository.findById(data.student_id);
    if (!student) {
      throw new Error(`Invalid student. Student not found with ID '${data.student_id}'`);
    }

    if (student.status === 'SUSPENDED' || student.status === 'INACTIVE') {
      throw new Error(`Student account is currently ${student.status}. Payments cannot be initiated.`);
    }

    if (!data.amount || Number(data.amount) <= 0) {
      throw new Error('Payment amount must be greater than zero');
    }

    // If a specific fee obligation is linked, validate it
    if (data.fee_id) {
      const fee = FeeRepository.findById(data.fee_id);
      if (!fee) {
        throw new Error(`Fee record not found with ID '${data.fee_id}'`);
      }
      if (fee.student_id !== data.student_id) {
        throw new Error('Fee record does not belong to the specified student');
      }
      const alreadyPaid = PaymentRepository.getTotalPaidByFee(fee.fee_id);
      const remainingDue = Math.max(0, Number(fee.amount) - alreadyPaid);
      if (Number(data.amount) > remainingDue) {
        throw new Error(`Payment amount (₹${data.amount}) exceeds outstanding fee balance (₹${remainingDue})`);
      }
    }

    const orderId = generateRazorpayOrderId();
    const receiptHint = `rcpt_${Date.now().toString().slice(-6)}`;

    const order: PaymentOrder = {
      order_id: orderId,
      student_id: data.student_id,
      fee_id: data.fee_id || null,
      amount: Number(data.amount),
      currency: 'INR',
      status: 'CREATED',
      receipt: receiptHint,
      notes: data.notes || null,
      created_at: new Date().toISOString(),
    };

    PaymentRepository.createOrder(order);

    return {
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      key_id: config.RAZORPAY_KEY_ID, // Safe public key ID for checkout initialization
      student_id: student.student_id,
      student_name: student.student_name,
      receipt_hint: receiptHint,
    };
  }

  /**
   * Verifies payment using official Razorpay HMAC-SHA256 signature verification.
   * Enforces DUPLICATE PAYMENT PROTECTION & DATABASE TRANSACTIONS.
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
    // RULE 2: VERIFY RAZORPAY SIGNATURE STRICTLY SERVER-SIDE
    // -------------------------------------------------------------
    const isValidSignature = verifyRazorpaySignature({
      orderId: data.razorpay_order_id,
      paymentId: data.razorpay_payment_id,
      signature: data.razorpay_signature,
    });

    if (!isValidSignature) {
      throw new Error('Razorpay signature verification failed. Transaction cannot be verified.');
    }

    // -------------------------------------------------------------
    // RULE 3: VERIFY ORDER & STUDENT RELATIONSHIP
    // -------------------------------------------------------------
    const order = PaymentRepository.findOrderById(data.razorpay_order_id);
    if (!order) {
      throw new Error(`Matching payment order not found for ID '${data.razorpay_order_id}'`);
    }

    if (order.student_id !== data.student_id) {
      throw new Error('Student ID does not match the order records');
    }

    const paymentAmount = order.amount;
    const feeId = data.fee_id || order.fee_id || null;

    // -------------------------------------------------------------
    // RULE 4: DATABASE TRANSACTION FOR ATOMIC FINANCIAL MUTATION
    // -------------------------------------------------------------
    return Database.transaction(() => {
      // 1. Generate unique sequential payment ID & official receipt number
      const paymentSeq = PaymentRepository.getNextSequence();
      const paymentId = generatePaymentId(paymentSeq);

      const receiptSeq = PaymentRepository.getNextReceiptSequence();
      const receiptNumber = generateReceiptNumber(receiptSeq);

      // 2. Create the immutable payment record
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

      // 4. If linked to a fee obligation, recalculate and update fee status
      if (feeId) {
        const fee = FeeRepository.findById(feeId);
        if (fee) {
          const totalPaidForFee = PaymentRepository.getTotalPaidByFee(feeId);
          let newStatus = fee.status;
          if (totalPaidForFee >= Number(fee.amount)) {
            newStatus = 'PAID';
          } else if (totalPaidForFee > 0) {
            newStatus = 'PARTIAL';
          }
          FeeRepository.update(feeId, { status: newStatus });
        }
      }

      // 5. Generate and return the official receipt
      const receipt = ReceiptService.getReceiptByPaymentId(savedPayment.payment_id);

      return {
        payment: savedPayment,
        receipt,
        is_duplicate: false,
      };
    });
  }

  public static getPaymentById(paymentId: string): Payment {
    const payment = PaymentRepository.findById(paymentId);
    if (!payment) {
      throw new Error(`Payment not found with ID '${paymentId}'`);
    }
    return payment;
  }

  public static getPaymentsByStudent(studentId: string): Payment[] {
    const student = StudentRepository.findById(studentId);
    if (!student) {
      throw new Error(`Student not found with ID '${studentId}'`);
    }
    return PaymentRepository.findByStudent(studentId);
  }

  public static getAllPayments(): Payment[] {
    return PaymentRepository.findAll();
  }
}
