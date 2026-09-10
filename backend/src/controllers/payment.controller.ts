import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { sendCreated, sendError, sendNotFound, sendSuccess } from '../utils/response';

export class PaymentController {
  public static createOrder(req: Request, res: Response): void {
    try {
      const order = PaymentService.createOrder(req.body);
      sendCreated(res, order, 'Payment order created successfully');
    } catch (err: any) {
      const status = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
      sendError(res, err.message || 'Failed to create payment order', status);
    }
  }

  public static verify(req: Request, res: Response): void {
    try {
      const result = PaymentService.verifyPayment(req.body);
      if (result.is_duplicate) {
        sendSuccess(res, result, 200, 'Payment already verified previously. Retrieved existing record.');
        return;
      }
      sendCreated(res, result, 'Payment verified and recorded successfully');
    } catch (err: any) {
      const status = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
      sendError(res, err.message || 'Payment verification failed', status);
    }
  }

  public static refund(req: Request, res: Response): void {
    try {
      const { paymentId } = req.params;
      const { reason } = req.body || {};
      const result = PaymentService.refundPayment(paymentId, reason);
      sendSuccess(res, result, 200, result.message);
    } catch (err: any) {
      const status = err.statusCode || (err.message?.includes('not found') ? 404 : 400);
      sendError(res, err.message || 'Payment refund failed', status);
    }
  }

  public static recordFailure(req: Request, res: Response): void {
    try {
      const result = PaymentService.recordFailedPayment(req.body);
      sendSuccess(res, result, 200, 'Payment failure recorded');
    } catch (err: any) {
      const status = err.statusCode || 400;
      sendError(res, err.message || 'Failed to record payment failure', status);
    }
  }

  public static getOrder(req: Request, res: Response): void {
    try {
      const { orderId } = req.params;
      const order = PaymentService.getOrderById(orderId);
      sendSuccess(res, order);
    } catch (err: any) {
      const status = err.statusCode || 404;
      sendError(res, err.message || 'Order not found', status);
    }
  }

  public static getAllOrders(_req: Request, res: Response): void {
    try {
      const orders = PaymentService.getAllOrders();
      sendSuccess(res, orders);
    } catch (err: any) {
      sendError(res, err.message || 'Failed to fetch orders', 500);
    }
  }

  public static getOrdersByStudent(req: Request, res: Response): void {
    try {
      const { studentId } = req.params;
      const orders = PaymentService.getOrdersByStudent(studentId);
      sendSuccess(res, orders);
    } catch (err: any) {
      const status = err.statusCode || 404;
      sendError(res, err.message || 'Orders not found', status);
    }
  }

  public static getByStudent(req: Request, res: Response): void {
    try {
      const { studentId } = req.params;
      const payments = PaymentService.getPaymentsByStudent(studentId);
      sendSuccess(res, payments);
    } catch (err: any) {
      sendNotFound(res, err.message || 'Payments not found');
    }
  }

  public static getOne(req: Request, res: Response): void {
    try {
      const { paymentId } = req.params;
      const payment = PaymentService.getPaymentById(paymentId);
      sendSuccess(res, payment);
    } catch (err: any) {
      sendNotFound(res, err.message || 'Payment not found');
    }
  }

  public static getAll(_req: Request, res: Response): void {
    try {
      const payments = PaymentService.getAllPayments();
      sendSuccess(res, payments);
    } catch (err: any) {
      sendError(res, err.message || 'Failed to fetch payments', 500);
    }
  }
}

