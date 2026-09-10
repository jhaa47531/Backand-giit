import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { sendForbidden, sendUnauthorized } from '../utils/response';
import { AuthTokenPayload, UserRole } from '../types';

declare global {
  namespace Express {
    interface Request {
      user?: AuthTokenPayload;
    }
  }
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    sendUnauthorized(res, 'Authentication token required');
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    sendUnauthorized(res, 'Invalid authorization format. Format: Bearer <token>');
    return;
  }

  try {
    const payload = AuthService.verifyToken(parts[1]);
    req.user = payload;
    next();
  } catch (err: any) {
    sendUnauthorized(res, err.message || 'Invalid or expired token');
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendUnauthorized(res, 'Authentication required');
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      sendForbidden(res, `Access denied. Role '${req.user.role}' is not authorized for this resource.`);
      return;
    }

    next();
  };
}

/**
 * CRITICAL SECURITY MIDDLEWARE:
 * Prevents students from accessing another student's data by merely modifying studentId in URL.
 * If user is an ADMIN, access is allowed.
 * If user is a STUDENT, studentId parameter MUST match user's own student_id.
 */
export function enforceStudentAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendUnauthorized(res, 'Authentication required');
    return;
  }

  if (req.user.role === 'ADMIN') {
    return next();
  }

  const requestedStudentId = req.params.studentId || req.body?.student_id || req.query?.student_id;

  if (req.user.role === 'STUDENT') {
    if (!req.user.student_id || req.user.student_id !== requestedStudentId) {
      sendForbidden(res, 'Access denied. You are only authorized to access your own student profile and records.');
      return;
    }
  }

  next();
}
