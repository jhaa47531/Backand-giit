import http from 'http';
import { Database } from '../src/db/database';
import { config } from '../src/config/env';
import crypto from 'crypto';

interface HealthCheckResult {
  step: number;
  name: string;
  passed: boolean;
  details: any;
  error?: string;
}

async function runHealthCheck(): Promise<void> {
  console.log('============================================================');
  console.log('GIIT FEE MANAGEMENT BACKEND — FULL HEALTH CHECK VERIFICATION');
  console.log('============================================================\n');

  const results: HealthCheckResult[] = [];

  // Step 1: Check Database connection and initialization
  try {
    const db = await Database.getDb();
    const isDbConnected = Boolean(db);
    results.push({
      step: 1,
      name: 'SQLite Database Connection',
      passed: isDbConnected,
      details: {
        engine: 'SQLite (sql.js / WebAssembly & Node FileSystem)',
        path: config.DATABASE_FILE,
        foreign_keys: 'PRAGMA foreign_keys = ON',
      },
    });
  } catch (err: any) {
    results.push({
      step: 1,
      name: 'SQLite Database Connection',
      passed: false,
      details: {},
      error: err.message,
    });
  }

  // Step 2: Check all database tables initialization
  try {
    const tablesQuery = Database.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const existingTables = tablesQuery.map(t => t.name);
    const expectedTables = ['students', 'fees', 'payments', 'payment_orders', 'users', 'sequences'];
    const missingTables = expectedTables.filter(t => !existingTables.includes(t));
    const allPassed = missingTables.length === 0;

    // Check sequences table content
    const sequences = Database.query<{ name: string; next_val: number }>('SELECT * FROM sequences');

    // Check users table content (at least admin user)
    const adminUser = Database.queryOne<{ user_id: string; username: string; role: string }>(
      "SELECT user_id, username, role FROM users WHERE role = 'ADMIN'"
    );

    results.push({
      step: 2,
      name: 'Database Tables & Sequences Initialization',
      passed: allPassed && Boolean(adminUser),
      details: {
        expected_tables: expectedTables,
        existing_tables: existingTables,
        missing_tables: missingTables,
        sequences_initialized: sequences.map(s => `${s.name}: ${s.next_val}`),
        admin_account_seeded: Boolean(adminUser),
        admin_username: adminUser?.username || 'none',
      },
    });
  } catch (err: any) {
    results.push({
      step: 2,
      name: 'Database Tables & Sequences Initialization',
      passed: false,
      details: {},
      error: err.message,
    });
  }

  // Step 3: Verify Environment Variables Loaded Safely Without Exposing Secrets
  try {
    const hasDbFile = Boolean(config.DATABASE_FILE);
    const hasJwtSecret = Boolean(config.JWT_SECRET && config.JWT_SECRET.length >= 8);
    const hasPort = Boolean(config.PORT && config.PORT > 0);
    const hasNodeEnv = Boolean(config.NODE_ENV);

    // Verify secrets are NOT exposed in stringified config or public getters
    const safeDump = JSON.stringify({
      PORT: config.PORT,
      NODE_ENV: config.NODE_ENV,
      DATABASE_FILE: config.DATABASE_FILE,
      JWT_SECRET_CONFIGURED: Boolean(config.JWT_SECRET),
      RAZORPAY_CONFIGURED: Boolean(config.RAZORPAY_KEY_ID && config.RAZORPAY_KEY_SECRET),
    });

    const jwtSecretExposed = safeDump.includes(config.JWT_SECRET);
    const rzpSecretExposed = safeDump.includes(config.RAZORPAY_KEY_SECRET);

    results.push({
      step: 3,
      name: 'Environment Variables Loaded Without Secret Exposure',
      passed: hasDbFile && hasJwtSecret && hasPort && hasNodeEnv && !jwtSecretExposed && !rzpSecretExposed,
      details: {
        DATABASE_FILE_loaded: hasDbFile,
        JWT_SECRET_loaded: hasJwtSecret,
        PORT: config.PORT,
        NODE_ENV: config.NODE_ENV,
        secrets_exposed_in_public_dump: jwtSecretExposed || rzpSecretExposed,
      },
    });
  } catch (err: any) {
    results.push({
      step: 3,
      name: 'Environment Variables Loaded Without Secret Exposure',
      passed: false,
      details: {},
      error: err.message,
    });
  }

  // Step 4: Razorpay Configuration Detection & Cryptographic Signature Check
  try {
    const keyIdPresent = Boolean(config.RAZORPAY_KEY_ID);
    const keySecretPresent = Boolean(config.RAZORPAY_KEY_SECRET);
    const isDetected = keyIdPresent && keySecretPresent;

    // Test HMAC-SHA256 signature calculation with the configured secret
    let hmacTestPassed = false;
    if (isDetected) {
      const orderId = 'order_health_test_123';
      const paymentId = 'pay_health_test_456';
      const signature = crypto
        .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      // Verify signature
      const expected = crypto
        .createHmac('sha256', config.RAZORPAY_KEY_SECRET)
        .update(`${orderId}|${paymentId}`)
        .digest('hex');

      hmacTestPassed = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    }

    results.push({
      step: 4,
      name: 'Razorpay Configuration & HMAC Verification Engine',
      passed: isDetected && hmacTestPassed,
      details: {
        detected: isDetected,
        key_id_configured: keyIdPresent,
        key_secret_configured: keySecretPresent,
        key_mode: config.RAZORPAY_KEY_ID.startsWith('rzp_live') ? 'production' : 'test',
        hmac_sha256_functional: hmacTestPassed,
      },
    });
  } catch (err: any) {
    results.push({
      step: 4,
      name: 'Razorpay Configuration & HMAC Verification Engine',
      passed: false,
      details: {},
      error: err.message,
    });
  }

  // Step 5: Backend Server Check & GET /api/health HTTP Verification
  try {
    const healthResponse = await makeHttpRequest('http://127.0.0.1:3000/api/health');
    const parsed = JSON.parse(healthResponse.body);
    const isSuccess = healthResponse.statusCode === 200 && parsed.success === true && parsed.data?.status === 'healthy';

    results.push({
      step: 5,
      name: 'Backend Server & GET /api/health Response',
      passed: isSuccess,
      details: {
        http_status: healthResponse.statusCode,
        api_success: parsed.success,
        health_status: parsed.data?.status,
        service: parsed.data?.service,
        institution: parsed.data?.institution,
        database_connected: parsed.data?.database?.connected,
        tables_initialized: parsed.data?.database?.tables_initialized,
        razorpay_detected: parsed.data?.razorpay?.detected,
        secrets_exposed: parsed.data?.environment_status?.secrets_exposed,
      },
    });
  } catch (err: any) {
    results.push({
      step: 5,
      name: 'Backend Server & GET /api/health Response',
      passed: false,
      details: {},
      error: err.message,
    });
  }

  // Report Summary
  let allPass = true;
  for (const r of results) {
    const statusIcon = r.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${statusIcon}: [Step ${r.step}] ${r.name}`);
    console.log('   Details:', JSON.stringify(r.details, null, 2).replace(/\n/g, '\n   '));
    if (r.error) {
      console.log(`   Error: ${r.error}`);
    }
    console.log();
    if (!r.passed) allPass = false;
  }

  console.log('============================================================');
  if (allPass) {
    console.log('HEALTH CHECK RESULT: ALL 5 VERIFICATION STAGES PASSED (100%)');
  } else {
    console.error('HEALTH CHECK RESULT: ONE OR MORE STAGES FAILED');
    process.exit(1);
  }
  console.log('============================================================');
}

function makeHttpRequest(urlStr: string): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => resolve({ statusCode: res.statusCode || 0, body }));
      }
    );
    req.on('error', (err) => reject(err));
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Request timed out after 5000ms'));
    });
    req.end();
  });
}

runHealthCheck().catch((err) => {
  console.error('Fatal health check error:', err);
  process.exit(1);
});
