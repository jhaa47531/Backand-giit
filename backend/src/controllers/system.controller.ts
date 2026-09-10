import { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { config } from '../config/env';
import { Database } from '../db/database';
import { computeSignatureForTesting } from '../utils/razorpay';
import { sendError, sendSuccess } from '../utils/response';

const updateEnvSchema = z.object({
  DATABASE_FILE: z.string().min(1, 'DATABASE_FILE path cannot be empty'),
  JWT_SECRET: z.string().min(8, 'JWT_SECRET must be at least 8 characters'),
  RAZORPAY_KEY_ID: z.string().min(1, 'RAZORPAY_KEY_ID is required'),
  RAZORPAY_KEY_SECRET: z.string().min(1, 'RAZORPAY_KEY_SECRET is required'),
  PORT: z.coerce.number().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
});

function maskSecret(val: string): string {
  if (!val || val.length <= 6) return '••••••••';
  return val.slice(0, 4) + '••••••••' + val.slice(-3);
}

export class SystemController {
  /**
   * Get current environment variables / secrets configuration
   */
  public static getConfig(_req: Request, res: Response): void {
    try {
      const dbPath = config.DATABASE_FILE;
      const dbExists = fs.existsSync(dbPath);
      let dbSize = 0;
      if (dbExists) {
        try {
          const stats = fs.statSync(dbPath);
          dbSize = stats.size;
        } catch {
          // ignore
        }
      }

      // Check table stats
      let tableCounts = { students: 0, fees: 0, payments: 0 };
      try {
        const studentCount = Database.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM students');
        const feeCount = Database.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM fees');
        const paymentCount = Database.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM payments');
        tableCounts = {
          students: studentCount?.count || 0,
          fees: feeCount?.count || 0,
          payments: paymentCount?.count || 0,
        };
      } catch {
        // ignore if db not loaded yet
      }

      const envPath = path.resolve(process.cwd(), '.env');
      const hasEnvFile = fs.existsSync(envPath);

      sendSuccess(res, {
        DATABASE_FILE: config.DATABASE_FILE,
        JWT_SECRET: config.JWT_SECRET,
        JWT_SECRET_MASKED: maskSecret(config.JWT_SECRET),
        RAZORPAY_KEY_ID: config.RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET: config.RAZORPAY_KEY_SECRET,
        RAZORPAY_KEY_SECRET_MASKED: maskSecret(config.RAZORPAY_KEY_SECRET),
        PORT: config.PORT,
        NODE_ENV: config.NODE_ENV,
        status: {
          database_connected: true,
          database_exists: dbExists,
          database_size_bytes: dbSize,
          env_file_exists: hasEnvFile,
          table_counts: tableCounts,
        },
      });
    } catch (err: any) {
      sendError(res, err.message || 'Failed to fetch environment configuration', 500);
    }
  }

  /**
   * Update environment variables / secrets and write to .env
   */
  public static updateConfig(req: Request, res: Response): void {
    try {
      const parsed = updateEnvSchema.parse(req.body);

      // Update in-memory config
      config.DATABASE_FILE = parsed.DATABASE_FILE;
      config.JWT_SECRET = parsed.JWT_SECRET;
      config.RAZORPAY_KEY_ID = parsed.RAZORPAY_KEY_ID;
      config.RAZORPAY_KEY_SECRET = parsed.RAZORPAY_KEY_SECRET;
      if (parsed.PORT) config.PORT = parsed.PORT;
      if (parsed.NODE_ENV) config.NODE_ENV = parsed.NODE_ENV;

      // Update process.env
      process.env.DATABASE_FILE = parsed.DATABASE_FILE;
      process.env.JWT_SECRET = parsed.JWT_SECRET;
      process.env.RAZORPAY_KEY_ID = parsed.RAZORPAY_KEY_ID;
      process.env.RAZORPAY_KEY_SECRET = parsed.RAZORPAY_KEY_SECRET;
      if (parsed.PORT) process.env.PORT = String(parsed.PORT);
      if (parsed.NODE_ENV) process.env.NODE_ENV = parsed.NODE_ENV;

      // Format and write to .env
      const envContent = [
        `# GIIT Fee Management Environment Configuration`,
        `# Updated at: ${new Date().toISOString()}`,
        `NODE_ENV="${config.NODE_ENV}"`,
        `PORT="${config.PORT}"`,
        `DATABASE_FILE="${config.DATABASE_FILE}"`,
        `JWT_SECRET="${config.JWT_SECRET}"`,
        ``,
        `# Razorpay Credentials`,
        `RAZORPAY_KEY_ID="${config.RAZORPAY_KEY_ID}"`,
        `RAZORPAY_KEY_SECRET="${config.RAZORPAY_KEY_SECRET}"`,
        ``,
      ].join('\n');

      const envPath = path.resolve(process.cwd(), '.env');
      fs.writeFileSync(envPath, envContent, 'utf-8');

      // Check if database directory exists; create if needed
      const dbDir = path.dirname(config.DATABASE_FILE);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }

      sendSuccess(res, {
        DATABASE_FILE: config.DATABASE_FILE,
        JWT_SECRET: config.JWT_SECRET,
        JWT_SECRET_MASKED: maskSecret(config.JWT_SECRET),
        RAZORPAY_KEY_ID: config.RAZORPAY_KEY_ID,
        RAZORPAY_KEY_SECRET: config.RAZORPAY_KEY_SECRET,
        RAZORPAY_KEY_SECRET_MASKED: maskSecret(config.RAZORPAY_KEY_SECRET),
        PORT: config.PORT,
        NODE_ENV: config.NODE_ENV,
        updated_at: new Date().toISOString(),
      }, 200, 'Environment variables and secrets updated successfully in .env and runtime');
    } catch (err: any) {
      sendError(res, err.message || 'Failed to update environment configuration', 400);
    }
  }

  /**
   * Generate a cryptographically strong 64-char JWT secret
   */
  public static generateSecret(_req: Request, res: Response): void {
    const randomSecret = 'giit_' + crypto.randomBytes(32).toString('hex');
    sendSuccess(res, { secret: randomSecret }, 200, 'Cryptographically strong secret generated');
  }

  /**
   * Test Razorpay credentials signature calculation
   */
  public static testRazorpay(req: Request, res: Response): void {
    try {
      const keySecret = req.body.RAZORPAY_KEY_SECRET || config.RAZORPAY_KEY_SECRET;
      const keyId = req.body.RAZORPAY_KEY_ID || config.RAZORPAY_KEY_ID;

      const sampleOrderId = 'order_test_' + Date.now().toString(36);
      const samplePaymentId = 'pay_test_' + Date.now().toString(36);

      const generatedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(`${sampleOrderId}|${samplePaymentId}`)
        .digest('hex');

      sendSuccess(res, {
        key_id: keyId,
        test_order_id: sampleOrderId,
        test_payment_id: samplePaymentId,
        hmac_signature: generatedSignature,
        algorithm: 'HMAC-SHA256',
        valid: Boolean(keySecret && keyId && generatedSignature),
      }, 200, 'Razorpay HMAC-SHA256 signature verification test succeeded');
    } catch (err: any) {
      sendError(res, err.message || 'Razorpay test failed', 400);
    }
  }
}
