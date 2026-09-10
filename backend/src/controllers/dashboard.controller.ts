import { Request, Response } from 'express';
import { DashboardService } from '../services/dashboard.service';
import { sendError, sendSuccess } from '../utils/response';

export class DashboardController {
  public static getStats(_req: Request, res: Response): void {
    try {
      const stats = DashboardService.getStats();
      sendSuccess(res, stats);
    } catch (err: any) {
      sendError(res, err.message || 'Failed to fetch dashboard statistics', 500);
    }
  }
}
