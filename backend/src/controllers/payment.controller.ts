import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service';
import { sendCreated, sendError, sendNotFound, sendSuccess } from '../utils/response';

export class PaymentController {
  public static createOrder(req: Request, res: Response): void {
    try {
      const order = PaymentService.createOrder(req.body);
      sendCreated(res, order, 'Payment order created successfully');
    } catch (err: any) {
      sendError(res, err.message || 'Failed to create payment order', 400);
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
      sendError(res, err.message || 'Payment verification failed', 400);
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
