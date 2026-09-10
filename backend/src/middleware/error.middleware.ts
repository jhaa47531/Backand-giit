import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Unhandled server error:', err);

  const statusCode = err.statusCode || (err.status >= 400 && err.status < 600 ? err.status : 500);
  const message = err.message || 'An unexpected internal server error occurred';

  sendError(res, message, statusCode);
}
