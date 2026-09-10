import { createBackendApp } from '../src/app';
import { Database } from '../src/db/database';
import { StudentService } from '../src/services/student.service';
import { FeeService } from '../src/services/fee.service';
import { PaymentService } from '../src/services/payment.service';
import { ReceiptService } from '../src/services/receipt.service';
import { PaymentRepository } from '../src/repositories/payment.repository';
import { computeSignatureForTesting } from '../src/utils/razorpay';
import { config } from '../src/config/env';
import { Payment } from '../src/types';
import http from 'http';
import path from 'path';
import fs from 'fs';

let server: http.Server;
let baseUrl = '';
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, description: string, detail?: any) {
  if (condition) {
    console.log(`  ✓ ${description}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAILED: ${description}`, detail ? JSON.stringify(detail, null, 2) : '');
    failedTests++;
    throw new Error(`Assertion failed: ${description}`);
  }
}

async function startTestServer() {
  const testDb = path.resolve(process.cwd(), 'data', 'test_receipt_suite.sqlite');
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
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

async function runReceiptTestSuite() {
  console.log('============================================================');
  console.log('GIIT FEE MANAGEMENT — RECEIPT GENERATOR & VERIFICATION SUITE');
  console.log('============================================================\n');

  await startTestServer();

  try {
    // -------------------------------------------------------------
    // Step 0: Authenticate as Admin
    // -------------------------------------------------------------
    console.log('--> Step 0: Authenticating Admin for API Access...');
    const loginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: 'admin@giit.ac.in',
        password: 'Admin@GIIT2026',
      }),
    });
    assert(loginRes.status === 200 && Boolean(loginRes.data?.data?.token), 'Admin authenticated successfully');
    const adminToken = loginRes.data.data.token;
    const authHeaders = { Authorization: `Bearer ${adminToken}` };

    // -------------------------------------------------------------
    // Setup: Create Test Student & Fee Obligation
    // -------------------------------------------------------------
    console.log('\n--> Setup: Creating Student and Fee Obligation for Receipt Testing...');
    const studentRes = await request('/students', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        enrollment_number: 'ENR-RCP-2026-001',
        student_name: 'Aditya Narayan Verma',
        course: 'B.Tech Computer Science',
        semester: 2,
        academic_session: '2025-2029',
        mobile: '9876543210',
        email: 'aditya.verma@example.com',
        father_name: 'Ramesh Verma',
        mother_name: 'Sunita Verma',
        total_course_fee: 120000,
      }),
    });
    assert(studentRes.status === 201, 'Student created successfully', studentRes.data);
    const testStudent = studentRes.data.data.student;

    const feeRes = await request(`/students/${testStudent.student_id}/fees`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        academic_session: '2025-2026',
        course: 'B.Tech Computer Science',
        semester: 2,
        fee_type: 'Semester 2 Tuition Fee',
        amount: 45000,
        due_date: '2026-11-15',
      }),
    });
    assert(feeRes.status === 201, 'Fee record created successfully', feeRes.data);
    const testFee = feeRes.data.data;

    // -------------------------------------------------------------
    // Requirement 1: Receipt must be generated only for a successfully recorded payment.
    // -------------------------------------------------------------
    console.log('\n--> Requirement 1: Verifying receipt is ONLY generated for a successful payment...');
    // Create an unrecorded / failed payment directly in DB to test rejection
    const failedPayment: Payment = {
      payment_id: 'PAY_FAILED_TEST_001',
      student_id: testStudent.student_id,
      fee_id: testFee.fee_id,
      receipt_number: 'RCP-FAIL-00001',
      amount: 10000,
      razorpay_order_id: 'order_failed_001',
      razorpay_payment_id: 'pay_failed_rzp_001',
      razorpay_signature: 'sig_failed',
      payment_status: 'FAILED',
      payment_method: 'ONLINE',
      payment_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    PaymentRepository.create(failedPayment);

    // Attempt retrieval/generation for FAILED payment
    const failedReceiptAttempt = await request(`/receipts/payment/${failedPayment.payment_id}`, {
      headers: authHeaders,
    });
    assert(
      failedReceiptAttempt.status === 400,
      'Requirement 1 Passed: Rejected receipt retrieval for payment with FAILED status (HTTP 400)',
      failedReceiptAttempt.data
    );

    let serviceThrewForFailed = false;
    try {
      ReceiptService.getReceiptByPaymentId(failedPayment.payment_id);
    } catch (err: any) {
      serviceThrewForFailed = true;
      assert(
        err.statusCode === 400 && err.message.includes('Only successfully recorded payments'),
        'ReceiptService throws 400 for unsuccessful payment'
      );
    }
    assert(serviceThrewForFailed, 'ReceiptService strictly rejects non-SUCCESS payments');

    // -------------------------------------------------------------
    // Requirement 2, 3, 4, 5: Record Successful Payment & Verify Receipt Structure
    // -------------------------------------------------------------
    console.log('\n--> Requirements 2, 3, 4 & 5: Recording Successful Payment & Verifying Receipt Fields...');
    const orderRes = await request('/payments/create-order', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        student_id: testStudent.student_id,
        fee_id: testFee.fee_id,
        amount: 30000,
      }),
    });
    assert(orderRes.status === 201, 'Razorpay order created successfully', orderRes.data);
    const order = orderRes.data.data;

    const rzpPaymentId1 = 'pay_rzp_success_test_001';
    const validSignature1 = computeSignatureForTesting(order.order_id, rzpPaymentId1);

    const verifyRes = await request('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: order.order_id,
        razorpay_payment_id: rzpPaymentId1,
        razorpay_signature: validSignature1,
        student_id: testStudent.student_id,
        fee_id: testFee.fee_id,
        payment_method: 'UPI',
      }),
    });
    assert(verifyRes.status === 201, 'Payment verified and committed to database', verifyRes.data);
    const recordedPayment = verifyRes.data.data.payment;
    const initialReceipt = verifyRes.data.data.receipt;

    // Requirement 2: Unique receipt number format
    assert(
      Boolean(initialReceipt.receipt_number) && /^RCP-\d{4}-\d{5}$/.test(initialReceipt.receipt_number),
      `Requirement 2 Passed: Unique receipt_number follows standard format (${initialReceipt.receipt_number})`
    );

    // Requirement 3: Receipt linked using student_id, fee_id, payment_id and receipt_number
    assert(
      initialReceipt.student_id === testStudent.student_id &&
        initialReceipt.fee_id === testFee.fee_id &&
        initialReceipt.payment_id === recordedPayment.payment_id &&
        initialReceipt.receipt_number === recordedPayment.receipt_number,
      `Requirement 3 Passed: Receipt strictly linked by student_id (${initialReceipt.student_id}), fee_id (${initialReceipt.fee_id}), payment_id (${initialReceipt.payment_id}), and receipt_number (${initialReceipt.receipt_number})`
    );

    // Requirement 4: Include student details, enrollment_number, course, semester, fee details, paid amount, payment date and payment status
    assert(
      initialReceipt.student_name === 'Aditya Narayan Verma' &&
        initialReceipt.enrollment_number === 'ENR-RCP-2026-001' &&
        initialReceipt.course === 'B.Tech Computer Science' &&
        initialReceipt.semester === 2 &&
        initialReceipt.academic_session === '2025-2029' &&
        initialReceipt.amount_paid === 30000 &&
        initialReceipt.payment_status === 'SUCCESS' &&
        Boolean(initialReceipt.payment_date) &&
        Boolean(initialReceipt.fee_details) &&
        initialReceipt.fee_details.fee_type === 'Semester 2 Tuition Fee' &&
        initialReceipt.fee_details.amount === 45000 &&
        Boolean(initialReceipt.student_details),
      'Requirement 4 Passed: Complete student details, enrollment, course, semester, fee details, paid amount, payment date & status included'
    );

    // Requirement 5: Include Razorpay Order ID and Razorpay Payment ID
    assert(
      initialReceipt.razorpay_order_id === order.order_id &&
        initialReceipt.razorpay_payment_id === rzpPaymentId1,
      `Requirement 5 Passed: Razorpay Order ID (${initialReceipt.razorpay_order_id}) and Payment ID (${initialReceipt.razorpay_payment_id}) present and correct`
    );

    // -------------------------------------------------------------
    // Requirement 6: Never expose RAZORPAY_KEY_SECRET
    // -------------------------------------------------------------
    console.log('\n--> Requirement 6: Checking secret protection (RAZORPAY_KEY_SECRET never exposed)...');
    const receiptJsonString = JSON.stringify(initialReceipt);
    assert(
      !receiptJsonString.includes(config.RAZORPAY_KEY_SECRET) &&
        !('key_secret' in initialReceipt) &&
        !('RAZORPAY_KEY_SECRET' in initialReceipt) &&
        !('razorpay_signature' in initialReceipt),
      'Requirement 6 Passed: RAZORPAY_KEY_SECRET and cryptographic signatures are never exposed in receipt object'
    );

    // -------------------------------------------------------------
    // Requirement 7: Receipt generation must not create duplicate receipts for the same successful payment
    // -------------------------------------------------------------
    console.log('\n--> Requirement 7: Verifying Duplicate Prevention (Idempotency)...');
    // Attempt 1: Call verify endpoint again with exact same payment ID
    const dupVerifyRes = await request('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: order.order_id,
        razorpay_payment_id: rzpPaymentId1,
        razorpay_signature: validSignature1,
        student_id: testStudent.student_id,
        fee_id: testFee.fee_id,
      }),
    });
    assert(
      dupVerifyRes.status === 200 &&
        dupVerifyRes.data.data.is_duplicate === true &&
        dupVerifyRes.data.data.receipt.receipt_number === initialReceipt.receipt_number,
      `Duplicate payment verification returned exact same receipt_number (${initialReceipt.receipt_number}) with is_duplicate: true`
    );

    // Attempt 2: Call POST /api/receipts/generate multiple times
    const generateRes1 = await request('/receipts/generate', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ payment_id: recordedPayment.payment_id }),
    });
    assert(
      generateRes1.status === 200 &&
        generateRes1.data.data.receipt_number === initialReceipt.receipt_number,
      'POST /api/receipts/generate correctly returns existing receipt number without duplicate'
    );

    const generateRes2 = await request('/receipts/generate', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ payment_id: recordedPayment.payment_id }),
    });
    assert(
      generateRes2.status === 200 &&
        generateRes2.data.data.receipt_number === initialReceipt.receipt_number,
      'Subsequent POST /api/receipts/generate calls maintain idempotency'
    );

    // Verify in database that only ONE payment/receipt record exists for this payment
    const totalPaymentsCount = PaymentRepository.findAll().filter(
      (p) => p.payment_id === recordedPayment.payment_id
    ).length;
    assert(
      totalPaymentsCount === 1,
      'Requirement 7 Passed: Exactly 1 payment/receipt record in database for successful payment (no duplicates created)'
    );

    // Verify a second distinct payment gets a different, unique receipt_number
    const order2Res = await request('/payments/create-order', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        student_id: testStudent.student_id,
        fee_id: testFee.fee_id,
        amount: 15000,
      }),
    });
    const order2 = order2Res.data.data;
    const rzpPaymentId2 = 'pay_rzp_success_test_002';
    const validSignature2 = computeSignatureForTesting(order2.order_id, rzpPaymentId2);

    const verifyRes2 = await request('/payments/verify', {
      method: 'POST',
      body: JSON.stringify({
        razorpay_order_id: order2.order_id,
        razorpay_payment_id: rzpPaymentId2,
        razorpay_signature: validSignature2,
        student_id: testStudent.student_id,
        fee_id: testFee.fee_id,
      }),
    });
    const secondReceipt = verifyRes2.data.data.receipt;
    assert(
      secondReceipt.receipt_number !== initialReceipt.receipt_number,
      `Requirement 2 Re-verified: Distinct payments receive unique receipt numbers (${initialReceipt.receipt_number} vs ${secondReceipt.receipt_number})`
    );

    // -------------------------------------------------------------
    // Requirement 8: Add a GET endpoint to retrieve a receipt by receipt_number and/or payment_id
    // -------------------------------------------------------------
    console.log('\n--> Requirement 8: Testing Receipt Retrieval GET Endpoints...');

    // 8A. Retrieve by receipt_number via /api/receipts/:receiptNumber
    const getByReceiptNumberRes = await request(`/receipts/${initialReceipt.receipt_number}`, {
      headers: authHeaders,
    });
    assert(
      getByReceiptNumberRes.status === 200 &&
        getByReceiptNumberRes.data.data.receipt_number === initialReceipt.receipt_number,
      `8A Passed: GET /api/receipts/:receiptNumber retrieved receipt (${initialReceipt.receipt_number})`
    );

    // 8B. Retrieve by receipt_number via /api/receipts/number/:receiptNumber
    const getByExplicitNumberRes = await request(`/receipts/number/${initialReceipt.receipt_number}`, {
      headers: authHeaders,
    });
    assert(
      getByExplicitNumberRes.status === 200 &&
        getByExplicitNumberRes.data.data.receipt_number === initialReceipt.receipt_number,
      `8B Passed: GET /api/receipts/number/:receiptNumber retrieved receipt (${initialReceipt.receipt_number})`
    );

    // 8C. Retrieve by payment_id via /api/receipts/payment/:paymentId
    const getByPaymentIdRes = await request(`/receipts/payment/${recordedPayment.payment_id}`, {
      headers: authHeaders,
    });
    assert(
      getByPaymentIdRes.status === 200 &&
        getByPaymentIdRes.data.data.payment_id === recordedPayment.payment_id,
      `8C Passed: GET /api/receipts/payment/:paymentId retrieved receipt for payment (${recordedPayment.payment_id})`
    );

    // 8D. Retrieve by payment_id via /api/payments/:paymentId/receipt
    const getByPaymentRouteRes = await request(`/payments/${recordedPayment.payment_id}/receipt`, {
      headers: authHeaders,
    });
    assert(
      getByPaymentRouteRes.status === 200 &&
        getByPaymentRouteRes.data.data.payment_id === recordedPayment.payment_id,
      `8D Passed: GET /api/payments/:paymentId/receipt retrieved receipt`
    );

    // 8E. Retrieve via query params /api/receipts?payment_id=...
    const getByQueryPaymentRes = await request(`/receipts?payment_id=${recordedPayment.payment_id}`, {
      headers: authHeaders,
    });
    assert(
      getByQueryPaymentRes.status === 200 &&
        getByQueryPaymentRes.data.data.payment_id === recordedPayment.payment_id,
      `8E Passed: GET /api/receipts?payment_id=... retrieved receipt`
    );

    // 8F. Retrieve via query params /api/receipts?receipt_number=...
    const getByQueryReceiptRes = await request(`/receipts?receipt_number=${initialReceipt.receipt_number}`, {
      headers: authHeaders,
    });
    assert(
      getByQueryReceiptRes.status === 200 &&
        getByQueryReceiptRes.data.data.receipt_number === initialReceipt.receipt_number,
      `8F Passed: GET /api/receipts?receipt_number=... retrieved receipt`
    );

    // 8G. Retrieve all receipts for student via /api/receipts?student_id=...
    const getStudentReceiptsRes = await request(`/receipts?student_id=${testStudent.student_id}`, {
      headers: authHeaders,
    });
    assert(
      getStudentReceiptsRes.status === 200 &&
        Array.isArray(getStudentReceiptsRes.data.data) &&
        getStudentReceiptsRes.data.data.length === 2,
      `8G Passed: GET /api/receipts?student_id=... retrieved array of 2 receipts for student`
    );

    // -------------------------------------------------------------
    // Requirement 9: Handle missing student, fee or payment records with proper 404 responses
    // -------------------------------------------------------------
    console.log('\n--> Requirement 9: Testing 404 responses for missing student, fee or payment records...');

    // 9A. Missing payment record
    const missingPaymentRes = await request('/receipts/payment/PAY_NON_EXISTENT_999999', {
      headers: authHeaders,
    });
    assert(
      missingPaymentRes.status === 404 &&
        missingPaymentRes.data.message.includes("Payment record not found with ID 'PAY_NON_EXISTENT_999999'"),
      `9A Passed: Missing payment returns HTTP 404 (${missingPaymentRes.data.message})`
    );

    // 9B. Missing receipt number
    const missingReceiptNumberRes = await request('/receipts/RCP-2099-99999', {
      headers: authHeaders,
    });
    assert(
      missingReceiptNumberRes.status === 404 &&
        missingReceiptNumberRes.data.message.includes("Receipt not found with identifier 'RCP-2099-99999'"),
      `9B Passed: Missing receipt number returns HTTP 404 (${missingReceiptNumberRes.data.message})`
    );

    // 9C. Missing student record associated with payment
    // Insert directly using rawDb with foreign_keys OFF to simulate orphaned record
    const rawDb = Database.getRawDb();
    rawDb.run('PRAGMA foreign_keys = OFF;');
    rawDb.run(
      `INSERT INTO payments (payment_id, student_id, fee_id, receipt_number, amount, razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_status, payment_method, payment_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        'PAY_ORPHAN_STUDENT_001',
        'STU_DELETED_OR_MISSING_999',
        null,
        'RCP-2026-99998',
        5000,
        'order_test_orphan_stu',
        'pay_rzp_orphan_stu',
        'sig_orphan',
        'SUCCESS',
        'ONLINE',
      ]
    );
    rawDb.run('PRAGMA foreign_keys = ON;');

    const missingStudentRes = await request('/receipts/payment/PAY_ORPHAN_STUDENT_001', {
      headers: authHeaders,
    });
    assert(
      missingStudentRes.status === 404 &&
        missingStudentRes.data.message.includes("Student record not found with ID 'STU_DELETED_OR_MISSING_999'"),
      `9C Passed: Missing student record returns HTTP 404 (${missingStudentRes.data.message})`
    );

    // 9D. Missing fee record associated with payment
    rawDb.run('PRAGMA foreign_keys = OFF;');
    rawDb.run(
      `INSERT INTO payments (payment_id, student_id, fee_id, receipt_number, amount, razorpay_order_id, razorpay_payment_id, razorpay_signature, payment_status, payment_method, payment_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        'PAY_ORPHAN_FEE_001',
        testStudent.student_id,
        'FEE_MISSING_DELETED_999',
        'RCP-2026-99999',
        5000,
        'order_test_orphan_fee',
        'pay_rzp_orphan_fee',
        'sig_orphan',
        'SUCCESS',
        'ONLINE',
      ]
    );
    rawDb.run('PRAGMA foreign_keys = ON;');

    const missingFeeRes = await request('/receipts/payment/PAY_ORPHAN_FEE_001', {
      headers: authHeaders,
    });
    assert(
      missingFeeRes.status === 404 &&
        missingFeeRes.data.message.includes("Fee record not found with ID 'FEE_MISSING_DELETED_999'"),
      `9D Passed: Missing fee record returns HTTP 404 (${missingFeeRes.data.message})`
    );

    // -------------------------------------------------------------
    // Security Boundary Check: Student can only view own receipts
    // -------------------------------------------------------------
    console.log('\n--> Security Check: Student Role Authorization Boundaries...');
    const studentLoginRes = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: testStudent.enrollment_number,
        password: `${testStudent.enrollment_number}@giit`,
      }),
    });
    assert(studentLoginRes.status === 200, 'Student authenticated successfully');
    const studentToken = studentLoginRes.data.data.token;
    const studentAuthHeaders = { Authorization: `Bearer ${studentToken}` };

    // Student fetches own receipt -> Allowed (200)
    const ownReceiptRes = await request(`/receipts/${initialReceipt.receipt_number}`, {
      headers: studentAuthHeaders,
    });
    assert(ownReceiptRes.status === 200, 'Student can access their own receipt');

    // Create a different student's payment
    const otherStudent = StudentService.createStudent({
      enrollment_number: 'ENR-OTHER-001',
      student_name: 'Other Student',
      course: 'BCA',
      semester: 1,
      academic_session: '2026-27',
      mobile: '9800000000',
      total_course_fee: 50000,
    }).student;

    const otherPayment: Payment = {
      payment_id: 'PAY_OTHER_STU_001',
      student_id: otherStudent.student_id,
      fee_id: null,
      receipt_number: 'RCP-2026-88888',
      amount: 10000,
      razorpay_order_id: 'order_other',
      razorpay_payment_id: 'pay_other_001',
      razorpay_signature: 'sig_other',
      payment_status: 'SUCCESS',
      payment_method: 'ONLINE',
      payment_date: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    PaymentRepository.create(otherPayment);

    // Student 1 tries to access Student 2's receipt -> Forbidden (403)
    const unauthorizedReceiptRes = await request(`/receipts/${otherPayment.receipt_number}`, {
      headers: studentAuthHeaders,
    });
    assert(
      unauthorizedReceiptRes.status === 403,
      'Security Check Passed: Student accessing another student receipt is rejected with HTTP 403 Forbidden'
    );

    console.log('\n============================================================');
    console.log(`ALL RECEIPT GENERATOR REQUIREMENTS PASSED: ${passedTests} passed, ${failedTests} failed`);
    console.log('============================================================\n');
  } finally {
    if (server) server.close();
    Database.close();
    const testDb = path.resolve(process.cwd(), 'data', 'test_receipt_suite.sqlite');
    if (fs.existsSync(testDb)) fs.unlinkSync(testDb);
  }
}

runReceiptTestSuite().catch((err) => {
  console.error('Test suite failure:', err);
  process.exit(1);
});
