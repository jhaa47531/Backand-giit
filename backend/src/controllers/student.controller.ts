import { Request, Response } from 'express';
import { StudentService } from '../services/student.service';
import { FeeEngineService } from '../services/fee_engine.service';
import { sendCreated, sendError, sendNotFound, sendSuccess } from '../utils/response';

export class StudentController {
  public static create(req: Request, res: Response): void {
    try {
      const result = StudentService.createStudent(req.body);
      sendCreated(res, result, 'Student record created successfully');
    } catch (err: any) {
      if (err.message && err.message.includes('already exists')) {
        sendError(res, err.message, 409);
        return;
      }
      sendError(res, err.message || 'Failed to create student', 400);
    }
  }

  public static getAll(req: Request, res: Response): void {
    try {
      const status = req.query.status as any;
      const course = req.query.course as string;
      const students = StudentService.getAllStudents({ status, course });
      sendSuccess(res, students);
    } catch (err: any) {
      sendError(res, err.message || 'Failed to fetch students', 500);
    }
  }

  public static getOne(req: Request, res: Response): void {
    try {
      const { studentId } = req.params;
      const student = StudentService.getStudentById(studentId);
      sendSuccess(res, student);
    } catch (err: any) {
      sendNotFound(res, err.message || 'Student not found');
    }
  }

  public static update(req: Request, res: Response): void {
    try {
      const { studentId } = req.params;
      const updated = StudentService.updateStudent(studentId, req.body);
      sendSuccess(res, updated, 200, 'Student updated successfully');
    } catch (err: any) {
      if (err.message && err.message.includes('not found')) {
        sendNotFound(res, err.message);
        return;
      }
      sendError(res, err.message || 'Failed to update student', 400);
    }
  }

  public static delete(req: Request, res: Response): void {
    try {
      const { studentId } = req.params;
      StudentService.deleteStudent(studentId);
      sendSuccess(res, { deleted: true, student_id: studentId }, 200, 'Student deleted successfully');
    } catch (err: any) {
      sendNotFound(res, err.message || 'Student not found');
    }
  }

  public static search(req: Request, res: Response): void {
    try {
      const query = (req.query.q as string) || (req.query.query as string) || '';
      const results = StudentService.searchStudents(query);
      sendSuccess(res, results);
    } catch (err: any) {
      sendError(res, err.message || 'Failed to search students', 500);
    }
  }

  public static getFeeSummary(req: Request, res: Response): void {
    try {
      const { studentId } = req.params;
      const summary = StudentService.getStudentFeeSummary(studentId);
      sendSuccess(res, summary);
    } catch (err: any) {
      sendNotFound(res, err.message || 'Student fee summary not found');
    }
  }

  public static getFeeStatus(req: Request, res: Response): void {
    try {
      const { studentId } = req.params;
      const calculation = FeeEngineService.calculateStudentFeeStatus(studentId);
      sendSuccess(res, calculation);
    } catch (err: any) {
      sendNotFound(res, err.message || 'Student fee status not found');
    }
  }
}
