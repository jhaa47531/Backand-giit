import { Router } from 'express';
import { SystemController } from '../controllers/system.controller';

const router = Router();

// Get current environment & secrets configuration
router.get('/config', SystemController.getConfig);

// Update environment & secrets configuration
router.post('/config', SystemController.updateConfig);

// Generate random strong JWT secret
router.post('/generate-secret', SystemController.generateSecret);

// Test Razorpay HMAC-SHA256 signature generation
router.post('/test-razorpay', SystemController.testRazorpay);

export default router;
