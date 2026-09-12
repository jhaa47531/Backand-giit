import { Router } from 'express';
import studentRoutes from './student.routes';
import feeRoutes from './fee.routes';
import paymentRoutes from './payment.routes';
import receiptRoutes from './receipt.routes';
import authRoutes from './auth.routes';
import dashboardRoutes from './dashboard.routes';
import systemRoutes from './system.routes';
import { sendSuccess } from '../utils/response';
import { config } from '../config/env';
import { Database } from '../db/database';
import { COURSE_DEFINITIONS, ALLOWED_COURSES } from '../constants/courses';

const router = Router();

// Comprehensive API Health & Diagnostics
router.get('/health', (_req, res) => {
  try {
    // 1. Verify SQLite connectivity and retrieve table names
    const tablesQuery = Database.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const existingTables = tablesQuery.map(t => t.name);
    const expectedTables = ['students', 'fees', 'payments', 'payment_orders', 'users', 'sequences'];
    const allTablesInitialized = expectedTables.every(table => existingTables.includes(table));

    // 2. Razorpay detection check (strictly boolean and safe metadata, no secret exposed)
    const razorpayDetected = Boolean(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET);
    const razorpayMode = config.RAZORPAY_KEY_ID?.startsWith('rzp_live')
      ? 'production'
      : config.RAZORPAY_KEY_ID?.startsWith('rzp_test')
        ? 'test'
        : razorpayDetected
          ? 'custom'
          : 'not_configured';

    // 3. Verify environment variables loaded safely
    const envLoaded = Boolean(config.DATABASE_FILE && config.JWT_SECRET && config.PORT);

    sendSuccess(res, {
      status: allTablesInitialized ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      service: 'GIIT Fee Management Backend',
      institution: config.INSTITUTION.NAME,
      environment: config.NODE_ENV,
      version: '1.0.0',
      database: {
        connected: true,
        engine: 'SQLite (ACID compliant)',
        tables_initialized: allTablesInitialized,
        tables_found: existingTables,
        expected_tables: expectedTables,
      },
      environment_status: {
        loaded: envLoaded,
        port: config.PORT,
        node_env: config.NODE_ENV,
        jwt_configured: Boolean(config.JWT_SECRET),
        secrets_exposed: false,
      },
      razorpay: {
        detected: razorpayDetected,
        key_id_set: Boolean(config.RAZORPAY_KEY_ID),
        key_secret_set: Boolean(config.RAZORPAY_KEY_SECRET),
        mode: razorpayMode,
      },
    });
  } catch (err: any) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: err.message || 'Database health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

// Course and Academic Structure Catalog
router.get('/courses', (_req, res) => {
  sendSuccess(res, {
    courses: COURSE_DEFINITIONS,
    allowed_courses: ALLOWED_COURSES,
    cycle_rules: {
      odd_cycle: {
        semesters: [1, 3, 5, 7],
        name: 'Odd Semester Cycle (December)',
        advance_payment_deadline: '15 October',
      },
      even_cycle: {
        semesters: [2, 4, 6, 8],
        name: 'Even Semester Cycle (June)',
        advance_payment_deadline: '15 April',
      },
    },
  });
});

// Mount modular sub-routers
router.use('/auth', authRoutes);
router.use('/students', studentRoutes);
router.use('/fees', feeRoutes);
router.use('/payments', paymentRoutes);
router.use('/receipts', receiptRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/system', systemRoutes);

export default router;
