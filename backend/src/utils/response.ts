import { Response } from 'express';
import { ApiResponse } from '../types';

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, message?: string): Response {
  const payload: ApiResponse<T> = {
    success: true,
    data,
    ...(message ? { message } : {}),
  };
  return res.status(statusCode).json(payload);
}

export function sendCreated<T>(res: Response, data: T, message?: string): Response {
  return sendSuccess(res, data, 201, message);
}

export function sendError(res: Response, message: string, statusCode = 400, errors?: any): Response {
  const payload: ApiResponse = {
    success: false,
    message,
    ...(errors ? { errors } : {}),
  };
  return res.status(statusCode).json(payload);
}

export function sendNotFound(res: Response, message = 'Resource not found'): Response {
  return sendError(res, message, 404);
}

export function sendUnauthorized(res: Response, message = 'Unauthorized access'): Response {
  return sendError(res, message, 401);
}

export function sendForbidden(res: Response, message = 'Forbidden: insufficient permissions'): Response {
  return sendError(res, message, 403);
}

export function sendConflict(res: Response, message: string): Response {
  return sendError(res, message, 409);
}

export function sendValidationError(res: Response, message: string, errors?: any): Response {
  return sendError(res, message, 422, errors);
}

export function sendInternalError(res: Response, message = 'Internal server error'): Response {
  return sendError(res, message, 500);
}
