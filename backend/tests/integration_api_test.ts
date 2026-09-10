import { createBackendApp } from '../src/app';
import { Database } from '../src/db/database';
import { computeSignatureForTesting } from '../src/utils/razorpay';
import http from 'http';
import path from 'path';
import fs from 'fs';

let server: http.Server;
let baseUrl = '';

async function startTestServer() {
  const testDb = path.resolve(process.cwd(), 'data', 'test_api_integration.sqlite');
  if (fs.existsSync(testDb)) fs.unlinkSync(testDb);

  await Database.init(testDb);
  const app = await createBackendApp();

  return new Promise<void>((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}/api`;
      resolve();
    });
  });
}

async function request(endpoint: string, options: RequestInit = {}) {
  const url = `${baseUrl}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  return { status: res.status, data };
}

async function runApiIntegrationTests() {
  console.log('\n--- RUNNING HTTP REST API INTEGRATION SUITE ---');
  await startTestServer();

  try {
    // 1. Health check
    const health = await request('/health');
    console.log(`[HTTP 1] GET /api/health -> status: ${health.status}, success: ${health.data.success}`);
    if (health.status !== 200 || !health.data.success) throw new Error('Health check failed');

    // 2. Admin Login
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'admin@giit.ac.in',
        password: 'Admin@GIIT2026',
      }),
    });
    console.log(`[HTTP 2] POST /api/auth/login -> status: ${loginRes.status}, role: ${loginRes.data.data?.user?.role}`);
    if (loginRes.status !== 200 || !loginRes.data.data?.token) throw new Error('Admin login failed');
    const adminToken = loginRes.data.data.token;

    // 3. Create Student 1 (Rahul Sharma)
    const stu1Res = await request('/students', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        enrollment_number: 'ENR-2026-001',
        student_name: 'Rahul Sharma',
        course: 'B.Tech Computer Science',
        semester: 1,
        academic_session: '2024-2028',
        mobile: '9876500001',
        total_course_fee: 100000,
      }),
    });
    console.log(`[HTTP 3] POST /api/students -> status: ${stu1Res.status}, student_id: ${stu1Res.data.data?.student?.student_id}`);
    const student1 = stu1Res.data.data.student;

    // 4. Create Student 2 with SAME NAME (Rahul Sharma)
    const stu2Res = await request('/students', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        enrollment_number: 'ENR-2026-002',
        student_name: 'Rahul Sharma', // Exact identical name
        course: 'BCA',
        semester: 1,
        academic_session: '2024-2027',
        mobile: '9876500002',
        total_course_fee: 60000,
      }),
    });
    console.log(`[HTTP 4] POST /api/students (same name) -> status: ${stu2Res.status}, student_id: ${stu2Res.data.data?.student?.student_id}`);
    const student2 = stu2Res.data.data.student;
    if (student1.student_id === student2.student_id) {
      throw new Error('Critical failure: students with same name merged IDs');
    }

    // 5. Search Students
    const searchRes = await request('/students/search?q=Rahul', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`[HTTP 5] GET /api/students/search?q=Rahul -> status: ${searchRes.status}, results: ${searchRes.data.data.length}`);
    if (searchRes.data.data.length !== 2) {
      throw new Error('Search did not return both independent students with name Rahul');
    }

    // 6. Create Fee for Student 1
    const feeRes = await request(`/students/${student1.student_id}/fees`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        academic_session: '2024-2025',
        course: 'B.Tech Computer Science',
        semester: 1,
        fee_type: 'Semester 1 Tuition',
        amount: 50000,
        due_date: '2026-11-01',
      }),
    });
    console.log(`[HTTP 6] POST /api/students/:id/fees -> status: ${feeRes.status}, fee_id: ${feeRes.data.data.fee_id}`);
    const fee = feeRes.data.data;

    // 7. Create Razorpay Payment Order
    const orderRes = await request('/payments/create-order', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({
        student_id: student1.student_id,
        fee_id: fee.fee_id,
        amount: 25000,
      }),
    });
    console.log(`[HTTP 7] POST /api/payments/create-order -> status: ${orderRes.status}, order_id: ${orderRes.data.data.order_id}`);
    const order = orderRes.data.data;

    // 8. Verify Razorpay Payment (Valid)
    const paymentId = 'pay_live_http_verify_001';
    const validSignature = computeSignatureForTesting(order.order_id, paymentId);
    const verifyRes = await request('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: order.order_id,
        razorpay_payment_id: paymentId,
        razorpay_signature: validSignature,
        student_id: student1.student_id,
        fee_id: fee.fee_id,
      }),
    });
    console.log(`[HTTP 8] POST /api/payments/verify -> status: ${verifyRes.status}, receipt_number: ${verifyRes.data.data.receipt?.receipt_number}`);
    if (verifyRes.status !== 201) throw new Error('Payment verification failed');

    // 9. Verify Duplicate Payment Idempotency
    const dupVerifyRes = await request('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: order.order_id,
        razorpay_payment_id: paymentId, // duplicate
        razorpay_signature: validSignature,
        student_id: student1.student_id,
        fee_id: fee.fee_id,
      }),
    });
    console.log(`[HTTP 9] POST /api/payments/verify (duplicate) -> status: ${dupVerifyRes.status}, is_duplicate: ${dupVerifyRes.data.data.is_duplicate}`);
    if (dupVerifyRes.status !== 200 || !dupVerifyRes.data.data.is_duplicate) {
      throw new Error('Duplicate payment protection failed over HTTP');
    }

    // 10. Student Fee Summary Check
    const summaryRes = await request(`/students/${student1.student_id}/summary`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`[HTTP 10] GET /api/students/:id/summary -> paid: ${summaryRes.data.data.total_paid}, due: ${summaryRes.data.data.total_due}`);
    if (summaryRes.data.data.total_paid !== 25000 || summaryRes.data.data.total_due !== 75000) {
      throw new Error('Summary paid/due calculations incorrect');
    }

    // 11. Student Authorization Boundary Check (student cannot access other student)
    const student1Login = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'ENR-2026-001',
        password: 'ENR-2026-001@giit',
      }),
    });
    const student1Token = student1Login.data.data.token;

    // Student 1 tries to access Student 2
    const unauthorizedAccess = await request(`/students/${student2.student_id}`, {
      headers: { Authorization: `Bearer ${student1Token}` },
    });
    console.log(`[HTTP 11] Student 1 accessing Student 2 profile -> status: ${unauthorizedAccess.status} (Expected 403)`);
    if (unauthorizedAccess.status !== 403) {
      throw new Error('Security defect: student was able to access another student profile!');
    }

    // 12. Dashboard Stats
    const statsRes = await request('/dashboard/stats', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    console.log(`[HTTP 12] GET /api/dashboard/stats -> total_students: ${statsRes.data.data.total_students}, total_collected: ${statsRes.data.data.total_collected}`);
    if (statsRes.status !== 200 || statsRes.data.data.total_collected !== 25000) {
      throw new Error('Dashboard stats check failed');
    }

    console.log('\nALL 12 HTTP API INTEGRATION TESTS PASSED PERFECTLY!\n');
  } finally {
    server.close();
    Database.close();
    const testDb = path.resolve(process.cwd(), 'data', 'test_api_integration.sqlite');
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
  }
}

runApiIntegrationTests().catch((err) => {
  console.error('Integration test failed:', err);
  process.exit(1);
});
