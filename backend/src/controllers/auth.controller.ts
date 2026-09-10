import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';
import { sendError, sendSuccess, sendUnauthorized } from '../utils/response';

export class AuthController {
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;
      const result = await AuthService.login(username, password);
      sendSuccess(res, result, 200, 'Login successful');
    } catch (err: any) {
      sendUnauthorized(res, err.message || 'Authentication failed');
    }
  }

  public static getMe(req: Request, res: Response): void {
    if (!req.user) {
      sendUnauthorized(res, 'Not authenticated');
      return;
    }
    sendSuccess(res, { user: req.user });
  }

  public static changePassword(req: Request, res: Response): void {
    try {
      if (!req.user) {
        sendUnauthorized(res, 'Not authenticated');
        return;
      }
      const { current_password, new_password } = req.body;
      AuthService.changePassword(req.user.user_id, current_password, new_password);
      sendSuccess(res, { updated: true }, 200, 'Password changed successfully');
    } catch (err: any) {
      sendError(res, err.message || 'Failed to update password', 400);
    }
  }
}
