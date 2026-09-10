import { Request, Response } from 'express';
import { ReceiptService } from '../services/receipt.service';
import { sendNotFound, sendSuccess } from '../utils/response';

export class ReceiptController {
  public static getByPaymentId(req: Request, res: Response): void {
    try {
      const { paymentId } = req.params;
      const receipt = ReceiptService.getReceiptByPaymentId(paymentId);
      sendSuccess(res, receipt);
    } catch (err: any) {
      sendNotFound(res, err.message || 'Receipt not found');
    }
  }

  public static getByNumber(req: Request, res: Response): void {
    try {
      const { receiptNumber } = req.params;
      const receipt = ReceiptService.getReceiptByReceiptNumber(receiptNumber);
      sendSuccess(res, receipt);
    } catch (err: any) {
      sendNotFound(res, err.message || 'Receipt not found');
    }
  }
}
