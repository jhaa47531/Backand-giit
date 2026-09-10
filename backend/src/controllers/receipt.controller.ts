import { Request, Response } from 'express';
import { ReceiptService } from '../services/receipt.service';
import { sendCreated, sendError, sendForbidden, sendNotFound, sendSuccess } from '../utils/response';

function handleError(res: Response, err: any, defaultMessage = 'Failed to process receipt request'): void {
  const message = err.message || defaultMessage;
  const status = err.statusCode || (message.toLowerCase().includes('not found') ? 404 : 400);

  if (status === 404) {
    sendNotFound(res, message);
  } else if (status === 403) {
    sendForbidden(res, message);
  } else if (status === 400) {
    sendError(res, message, 400);
  } else {
    sendError(res, message, status);
  }
}

export class ReceiptController {
  /**
   * GET receipt by payment ID
   */
  public static getByPaymentId(req: Request, res: Response): void {
    try {
      const paymentId = (req.params.paymentId || req.query.payment_id) as string;
      if (!paymentId) {
        sendError(res, 'Payment ID parameter is required', 400);
        return;
      }

      const receipt = ReceiptService.getReceiptByPaymentId(paymentId);

      // Student role security boundary check
      if (req.user?.role === 'STUDENT' && req.user.student_id && receipt.student_id !== req.user.student_id) {
        sendForbidden(res, 'Access denied. You are only authorized to access your own receipts.');
        return;
      }

      sendSuccess(res, receipt);
    } catch (err: any) {
      handleError(res, err, 'Receipt not found for specified payment ID');
    }
  }

  /**
   * GET receipt by receipt number
   */
  public static getByNumber(req: Request, res: Response): void {
    try {
      const receiptNumber = (req.params.receiptNumber || req.query.receipt_number) as string;
      if (!receiptNumber) {
        sendError(res, 'Receipt number parameter is required', 400);
        return;
      }

      const receipt = ReceiptService.getReceiptByReceiptNumber(receiptNumber);

      // Student role security boundary check
      if (req.user?.role === 'STUDENT' && req.user.student_id && receipt.student_id !== req.user.student_id) {
        sendForbidden(res, 'Access denied. You are only authorized to access your own receipts.');
        return;
      }

      sendSuccess(res, receipt);
    } catch (err: any) {
      handleError(res, err, 'Receipt not found for specified receipt number');
    }
  }

  /**
   * GET receipt by identifier (handles both receipt_number or payment_id)
   */
  public static getByIdentifier(req: Request, res: Response): void {
    try {
      const { identifier } = req.params;
      if (!identifier) {
        sendError(res, 'Receipt identifier parameter is required', 400);
        return;
      }

      const receipt = ReceiptService.getReceiptByIdentifier(identifier);

      // Student role security boundary check
      if (req.user?.role === 'STUDENT' && req.user.student_id && receipt.student_id !== req.user.student_id) {
        sendForbidden(res, 'Access denied. You are only authorized to access your own receipts.');
        return;
      }

      sendSuccess(res, receipt);
    } catch (err: any) {
      handleError(res, err, 'Receipt not found with specified identifier');
    }
  }

  /**
   * GET /api/receipts (supports ?payment_id=..., ?receipt_number=..., ?student_id=..., or all)
   */
  public static getByQueryOrAll(req: Request, res: Response): void {
    try {
      const { payment_id, receipt_number, student_id } = req.query as {
        payment_id?: string;
        receipt_number?: string;
        student_id?: string;
      };

      if (payment_id) {
        const receipt = ReceiptService.getReceiptByPaymentId(payment_id);
        if (req.user?.role === 'STUDENT' && req.user.student_id && receipt.student_id !== req.user.student_id) {
          sendForbidden(res, 'Access denied. You are only authorized to access your own receipts.');
          return;
        }
        sendSuccess(res, receipt);
        return;
      }

      if (receipt_number) {
        const receipt = ReceiptService.getReceiptByReceiptNumber(receipt_number);
        if (req.user?.role === 'STUDENT' && req.user.student_id && receipt.student_id !== req.user.student_id) {
          sendForbidden(res, 'Access denied. You are only authorized to access your own receipts.');
          return;
        }
        sendSuccess(res, receipt);
        return;
      }

      const targetStudentId = student_id || (req.user?.role === 'STUDENT' ? req.user.student_id : undefined);

      if (targetStudentId) {
        if (req.user?.role === 'STUDENT' && req.user.student_id && targetStudentId !== req.user.student_id) {
          sendForbidden(res, 'Access denied. You are only authorized to access your own receipts.');
          return;
        }
        const receipts = ReceiptService.getReceiptsByStudent(targetStudentId);
        sendSuccess(res, receipts);
        return;
      }

      // If Admin requested all receipts
      if (req.user?.role === 'ADMIN') {
        const receipts = ReceiptService.getAllReceipts();
        sendSuccess(res, receipts);
        return;
      }

      sendError(res, 'Please provide payment_id, receipt_number or student_id parameter', 400);
    } catch (err: any) {
      handleError(res, err, 'Failed to fetch receipts');
    }
  }

  /**
   * POST /api/receipts/generate
   * Generates or retrieves an official receipt for a recorded payment (idempotent, duplicate safe)
   */
  public static generate(req: Request, res: Response): void {
    try {
      const paymentId = (req.body?.payment_id || req.params?.paymentId) as string;
      if (!paymentId) {
        sendError(res, 'payment_id is required in request body to generate a receipt', 400);
        return;
      }

      const result = ReceiptService.generateReceiptForPayment(paymentId);

      if (req.user?.role === 'STUDENT' && req.user.student_id && result.receipt.student_id !== req.user.student_id) {
        sendForbidden(res, 'Access denied. You are only authorized to generate your own receipts.');
        return;
      }

      if (result.is_duplicate) {
        sendSuccess(
          res,
          result.receipt,
          200,
          'Receipt already exists for this payment. Retrieved existing official receipt.'
        );
        return;
      }

      sendCreated(res, result.receipt, 'Official receipt generated successfully');
    } catch (err: any) {
      handleError(res, err, 'Failed to generate receipt');
    }
  }
}
