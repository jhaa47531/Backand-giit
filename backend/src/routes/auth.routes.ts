import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { validateBody, loginSchema, changePasswordSchema } from '../middleware/validate.middleware';

const router = Router();

// Login (Admin or Student)
router.post('/login', validateBody(loginSchema), AuthController.login);

// Get current user profile
router.get('/me', authenticateJWT, AuthController.getMe);

// Change password
router.post('/change-password', authenticateJWT, validateBody(changePasswordSchema), AuthController.changePassword);

export default router;
