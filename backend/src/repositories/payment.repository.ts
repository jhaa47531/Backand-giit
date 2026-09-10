import { Database } from '../db/database';
import { Payment, PaymentOrder, OrderStatus, PaymentStatus } from '../types';

export class PaymentRepository {
  public static getNextSequence(): number {
    return Database.getNextSequence('payment_id');
  }

  public static getNextReceiptSequence(): number {
    return Database.getNextSequence('receipt_number');
  }

  public static create(payment: Payment): Payment {
    Database.run(
      `INSERT INTO payments (
        payment_id, student_id, fee_id, receipt_number, amount,
        razorpay_order_id, razorpay_payment_id, razorpay_signature,
        payment_status, payment_method, payment_date, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        payment.payment_id,
        payment.student_id,
        payment.fee_id || null,
        payment.receipt_number,
        payment.amount,
        payment.razorpay_order_id,
        payment.razorpay_payment_id,
        payment.razorpay_signature,
        payment.payment_status || 'SUCCESS',
        payment.payment_method || 'ONLINE',
      ]
    );
    return this.findById(payment.payment_id)!;
  }

  public static findById(paymentId: string): Payment | null {
    return Database.queryOne<Payment>(
      'SELECT * FROM payments WHERE payment_id = ?',
      [paymentId]
    );
  }

  public static findByRazorpayPaymentId(razorpayPaymentId: string): Payment | null {
    return Database.queryOne<Payment>(
      'SELECT * FROM payments WHERE razorpay_payment_id = ?',
      [razorpayPaymentId]
    );
  }

  public static findByRazorpayOrderId(razorpayOrderId: string): Payment | null {
    return Database.queryOne<Payment>(
      'SELECT * FROM payments WHERE razorpay_order_id = ?',
      [razorpayOrderId]
    );
  }

  public static findByReceiptNumber(receiptNumber: string): Payment | null {
    return Database.queryOne<Payment>(
      'SELECT * FROM payments WHERE receipt_number = ?',
      [receiptNumber]
    );
  }

  public static findByStudent(studentId: string): Payment[] {
    return Database.query<Payment>(
      'SELECT * FROM payments WHERE student_id = ? ORDER BY payment_date DESC, created_at DESC',
      [studentId]
    );
  }

  public static findByFee(feeId: string): Payment[] {
    return Database.query<Payment>(
      'SELECT * FROM payments WHERE fee_id = ? ORDER BY payment_date DESC, created_at DESC',
      [feeId]
    );
  }

  public static updateReceiptNumber(paymentId: string, receiptNumber: string): void {
    Database.run(
      'UPDATE payments SET receipt_number = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?',
      [receiptNumber, paymentId]
    );
  }

  public static findAll(): Payment[] {
    return Database.query<Payment>(
      'SELECT * FROM payments ORDER BY payment_date DESC, created_at DESC'
    );
  }

  public static findRecent(limit = 10): Array<Payment & { student_name: string; enrollment_number: string; course: string }> {
    return Database.query<Payment & { student_name: string; enrollment_number: string; course: string }>(
      `SELECT p.*, s.student_name, s.enrollment_number, s.course 
       FROM payments p
       JOIN students s ON p.student_id = s.student_id
       ORDER BY p.payment_date DESC
       LIMIT ?`,
      [limit]
    );
  }

  public static getTotalPaidByStudent(studentId: string): number {
    const res = Database.queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE student_id = ? AND payment_status = 'SUCCESS'",
      [studentId]
    );
    return res ? Number(res.total) : 0;
  }

  public static getTotalPaidByFee(feeId: string): number {
    const res = Database.queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE fee_id = ? AND payment_status = 'SUCCESS'",
      [feeId]
    );
    return res ? Number(res.total) : 0;
  }

  public static getTotalCollected(): number {
    const res = Database.queryOne<{ total: number }>(
      "SELECT COALESCE(SUM(amount), 0) as total FROM payments WHERE payment_status = 'SUCCESS'"
    );
    return res ? Number(res.total) : 0;
  }

  // --- Payment Orders ---
  public static createOrder(order: PaymentOrder): PaymentOrder {
    Database.run(
      `INSERT INTO payment_orders (
        order_id, student_id, fee_id, amount, currency, status, receipt, notes, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        order.order_id,
        order.student_id,
        order.fee_id || null,
        order.amount,
        order.currency || 'INR',
        order.status || 'CREATED',
        order.receipt,
        order.notes || null,
      ]
    );
    return this.findOrderById(order.order_id)!;
  }

  public static findOrderById(orderId: string): PaymentOrder | null {
    return Database.queryOne<PaymentOrder>(
      'SELECT * FROM payment_orders WHERE order_id = ?',
      [orderId]
    );
  }

  public static updateOrderStatus(orderId: string, status: OrderStatus): void {
    Database.run(
      'UPDATE payment_orders SET status = ? WHERE order_id = ?',
      [status, orderId]
    );
  }

  public static updatePaymentStatus(paymentId: string, status: PaymentStatus): void {
    Database.run(
      'UPDATE payments SET payment_status = ?, updated_at = CURRENT_TIMESTAMP WHERE payment_id = ?',
      [status, paymentId]
    );
  }

  public static findOrdersByStudent(studentId: string): PaymentOrder[] {
    return Database.query<PaymentOrder>(
      'SELECT * FROM payment_orders WHERE student_id = ? ORDER BY created_at DESC',
      [studentId]
    );
  }

  public static findOrdersByFee(feeId: string): PaymentOrder[] {
    return Database.query<PaymentOrder>(
      'SELECT * FROM payment_orders WHERE fee_id = ? ORDER BY created_at DESC',
      [feeId]
    );
  }

  public static findAllOrders(): PaymentOrder[] {
    return Database.query<PaymentOrder>(
      'SELECT * FROM payment_orders ORDER BY created_at DESC'
    );
  }
}
