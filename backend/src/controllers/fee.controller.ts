import { Request, Response } from 'express';
import { FeeService } from '../services/fee.service';
import { FeeRepository } from '../repositories/fee.repository';
import { sendCreated, sendError, sendNotFound, sendSuccess } from '../utils/response';

export class FeeController {
  public static create(req: Request, res: Response): void {
    try {
      const studentId = req.params.studentId || req.body.student_id;
      if (!studentId) {
        sendError(res, 'student_id is required', 400);
        return;
      }
      const fee = FeeService.createFee(studentId, req.body);
      sendCreated(res, fee, 'Fee record created successfully');
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        sendNotFound(res, err.message);
        return;
      }
      sendError(res, err.message || 'Failed to create fee record', 400);
    }
  }

  public static getAll(req: Request, res: Response): void {
    try {
      const studentId = req.query.student_id as string;
      if (studentId) {
        const fees = FeeService.getFeesByStudent(studentId);
        sendSuccess(res, fees);
        return;
      }
      const fees = FeeRepository.findAll();
      sendSuccess(res, fees);
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        sendNotFound(res, err.message);
        return;
      }
      sendError(res, err.message || 'Failed to fetch fees', 500);
    }
  }

  public static getByStudent(req: Request, res: Response): void {
    try {
      const { studentId } = req.params;
      const fees = FeeService.getFeesByStudent(studentId);
      sendSuccess(res, fees);
    } catch (err: any) {
      sendNotFound(res, err.message || 'Fees not found for student');
    }
  }

  public static getOne(req: Request, res: Response): void {
    try {
      const { feeId } = req.params;
      const fee = FeeService.getFeeById(feeId);
      sendSuccess(res, fee);
    } catch (err: any) {
      sendNotFound(res, err.message || 'Fee record not found');
    }
  }

  public static update(req: Request, res: Response): void {
    try {
      const { feeId } = req.params;
      const updated = FeeService.updateFee(feeId, req.body);
      sendSuccess(res, updated, 200, 'Fee record updated successfully');
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        sendNotFound(res, err.message);
        return;
      }
      sendError(res, err.message || 'Failed to update fee record', 400);
    }
  }

  public static delete(req: Request, res: Response): void {
    try {
      const { feeId } = req.params;
      FeeService.deleteFee(feeId);
      sendSuccess(res, { deleted: true, fee_id: feeId }, 200, 'Fee record deleted successfully');
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        sendNotFound(res, err.message);
        return;
      }
      sendError(res, err.message || 'Failed to delete fee record', 400);
    }
  }
}
