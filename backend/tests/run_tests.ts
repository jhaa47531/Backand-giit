import path from 'path';
import fs from 'fs';
import { Database } from '../src/db/database';
import { StudentService } from '../src/services/student.service';
import { FeeService } from '../src/services/fee.service';
import { PaymentService } from '../src/services/payment.service';
import { AuthService } from '../src/services/auth.service';
import { DashboardService } from '../src/services/dashboard.service';
import { ReceiptService } from '../src/services/receipt.service';
import { computeSignatureForTesting } from '../src/utils/razorpay';
import { config } from '../src/config/env';

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failedCount++;
  }
}

async function runAllTests() {
  console.log('============================================================');
  console.log('GIIT FEE MANAGEMENT BACKEND — AUTOMATED TEST SUITE');
  console.log('============================================================\n');

  // Use an isolated test database file
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_giit_suite.sqlite');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  await Database.init(testDbPath);

  try {
    // -------------------------------------------------------------
    // TEST 1: Create Student A
    // -------------------------------------------------------------
    const studentARes = StudentService.createStudent({
      enrollment_number: 'GIIT-2026-001',
      student_name: 'Rahul Sharma',
      course: 'B.Tech CSE',
      semester: 1,
      academic_session: '2024-2028',
      mobile: '9876543210',
      email: 'rahul.sharma@example.com',
      total_course_fee: 100000,
    });
    const studentA = studentARes.student;
    assert(
      studentA.student_id.startsWith('STU') && studentA.student_name === 'Rahul Sharma',
      'TEST 1: Create Student A',
      `student_id=${studentA.student_id}`
    );

    // -------------------------------------------------------------
    // TEST 2: Create Student B
    // -------------------------------------------------------------
    const studentBRes = StudentService.createStudent({
      enrollment_number: 'GIIT-2026-002',
      student_name: 'Amit Kumar',
      course: 'BCA',
      semester: 1,
      academic_session: '2024-2027',
      mobile: '9876543211',
      email: 'amit.kumar@example.com',
      total_course_fee: 80000,
    });
    const studentB = studentBRes.student;
    assert(
      studentB.student_id.startsWith('STU') && studentB.student_name === 'Amit Kumar',
      'TEST 2: Create Student B',
      `student_id=${studentB.student_id}`
    );

    // -------------------------------------------------------------
    // TEST 3: Verify A and B are separate
    // -------------------------------------------------------------
    const fetchedA = StudentService.getStudentById(studentA.student_id);
    const fetchedB = StudentService.getStudentById(studentB.student_id);
    assert(
      fetchedA.student_id !== fetchedB.student_id &&
        fetchedA.enrollment_number !== fetchedB.enrollment_number &&
        fetchedA.student_name !== fetchedB.student_name,
      'TEST 3: Verify A and B are completely separate records',
      `A=${fetchedA.student_id}, B=${fetchedB.student_id}`
    );

    // -------------------------------------------------------------
    // TEST 4 & 5: Create two students with identical names
    // -------------------------------------------------------------
    const studentCRes = StudentService.createStudent({
      enrollment_number: 'GIIT-2026-003',
      student_name: 'Rahul Sharma', // Exact same name as Student A
      course: 'MCA',
      semester: 1,
      academic_session: '2024-2026',
      mobile: '9876543212',
      email: 'rahul.mca@example.com',
      total_course_fee: 120000,
    });
    const studentC = studentCRes.student;
    assert(
      studentC.student_name === studentA.student_name,
      'TEST 4: Create student with identical name as Student A'
    );
    assert(
      studentA.student_id !== studentC.student_id &&
        studentA.enrollment_number !== studentC.enrollment_number &&
        studentC.course === 'MCA' &&
        studentA.course === 'B.Tech CSE',
      'TEST 5: Verify both remain independent records (Same name != same student)',
      `A_ID=${studentA.student_id}, C_ID=${studentC.student_id}`
    );

    // -------------------------------------------------------------
    // TEST 6 & 7: Update Student A & Verify Student B unchanged
    // -------------------------------------------------------------
    const updatedA = StudentService.updateStudent(studentA.student_id, {
      mobile: '9999999999',
      course: 'B.Tech CSE (AI & ML)',
    });
    const recheckedB = StudentService.getStudentById(studentB.student_id);
    assert(
      updatedA.mobile === '9999999999' && updatedA.course === 'B.Tech CSE (AI & ML)',
      'TEST 6: Update Student A'
    );
    assert(
      recheckedB.mobile === '9876543211' &&
        recheckedB.course === 'BCA' &&
        recheckedB.student_name === 'Amit Kumar',
      'TEST 7: Verify Student B remains completely unchanged after updating Student A'
    );

    // -------------------------------------------------------------
    // TEST 8, 9, 10: Fee Creation and Association
    // -------------------------------------------------------------
    const feeA = FeeService.createFee(studentA.student_id, {
      academic_session: '2024-2025',
      course: 'B.Tech CSE (AI & ML)',
      semester: 1,
      fee_type: 'Tuition Fee',
      amount: 50000,
      due_date: '2026-10-15',
    });
    const feeB = FeeService.createFee(studentB.student_id, {
      academic_session: '2024-2025',
      course: 'BCA',
      semester: 1,
      fee_type: 'Admission Fee',
      amount: 40000,
      due_date: '2026-10-20',
    });

    assert(feeA.student_id === studentA.student_id, 'TEST 8: Create fee for Student A');
    assert(feeB.student_id === studentB.student_id, 'TEST 9: Create fee for Student B');

    const feesForA = FeeService.getFeesByStudent(studentA.student_id);
    const feesForB = FeeService.getFeesByStudent(studentB.student_id);
    assert(
      feesForA.length === 1 &&
        feesForA[0].fee_id === feeA.fee_id &&
        feesForB.length === 1 &&
        feesForB[0].fee_id === feeB.fee_id &&
        feesForA[0].fee_id !== feesForB[0].fee_id,
      'TEST 10: Verify fees remain correctly associated to individual students'
    );

    // -------------------------------------------------------------
    // TEST 11: Create Razorpay Order
    // -------------------------------------------------------------
    const order = PaymentService.createOrder({
      student_id: studentA.student_id,
      fee_id: feeA.fee_id,
      amount: 20000,
    });
    assert(
      order.order_id.startsWith('order_') &&
        order.amount === 20000 &&
        order.student_id === studentA.student_id,
      'TEST 11: Create Razorpay order server-side',
      `order_id=${order.order_id}`
    );

    // -------------------------------------------------------------
    // TEST 12: Reject invalid Razorpay signature
    // -------------------------------------------------------------
    let rejectedInvalidSig = false;
    try {
      PaymentService.verifyPayment({
        razorpay_order_id: order.order_id,
        razorpay_payment_id: 'pay_fake_invalid_123',
        razorpay_signature: 'invalid_forged_signature_hex',
        student_id: studentA.student_id,
        fee_id: feeA.fee_id,
      });
    } catch {
      rejectedInvalidSig = true;
    }
    assert(rejectedInvalidSig, 'TEST 12: Reject invalid Razorpay signature');

    // -------------------------------------------------------------
    // TEST 13: Accept valid Razorpay verification
    // -------------------------------------------------------------
    const validPaymentId = 'pay_test_rzp_success_001';
    const validSignature = computeSignatureForTesting(order.order_id, validPaymentId);

    const verifiedResult = PaymentService.verifyPayment({
      razorpay_order_id: order.order_id,
      razorpay_payment_id: validPaymentId,
      razorpay_signature: validSignature,
      student_id: studentA.student_id,
      fee_id: feeA.fee_id,
      payment_method: 'UPI',
    });
    assert(
      verifiedResult.payment.payment_id.startsWith('PAY') &&
        verifiedResult.payment.payment_status === 'SUCCESS' &&
        verifiedResult.payment.amount === 20000 &&
        !verifiedResult.is_duplicate,
      'TEST 13: Accept valid Razorpay signature and persist payment transaction'
    );

    // -------------------------------------------------------------
    // TEST 14: Prevent duplicate payment insertion
    // -------------------------------------------------------------
    const secondVerification = PaymentService.verifyPayment({
      razorpay_order_id: order.order_id,
      razorpay_payment_id: validPaymentId, // exact same payment ID
      razorpay_signature: validSignature,
      student_id: studentA.student_id,
      fee_id: feeA.fee_id,
    });
    const allStudentPayments = PaymentService.getPaymentsByStudent(studentA.student_id);
    assert(
      secondVerification.is_duplicate === true &&
        secondVerification.payment.payment_id === verifiedResult.payment.payment_id &&
        allStudentPayments.length === 1,
      'TEST 14: Prevent duplicate payment insertion (Idempotency guarantee)'
    );

    // -------------------------------------------------------------
    // TEST 15: Verify payment linked to correct student & receipt generated
    // -------------------------------------------------------------
    const receipt = ReceiptService.getReceiptByPaymentId(verifiedResult.payment.payment_id);
    assert(
      receipt.student_id === studentA.student_id &&
        receipt.student_name === 'Rahul Sharma' &&
        receipt.receipt_number.startsWith('RCP-') &&
        receipt.amount_paid === 20000,
      'TEST 15: Verify payment is linked to correct student and official receipt is generated'
    );

    // -------------------------------------------------------------
    // TEST 16: Verify paid / due amounts computed from database records
    // -------------------------------------------------------------
    const summaryA = StudentService.getStudentFeeSummary(studentA.student_id);
    // Student A total course fee: 100,000. Paid: 20,000. Due: 80,000.
    assert(
      summaryA.total_fee === 100000 &&
        summaryA.total_paid === 20000 &&
        summaryA.total_due === 80000,
      'TEST 16: Verify paid/due amounts dynamically computed from backend database records',
      `fee=${summaryA.total_fee}, paid=${summaryA.total_paid}, due=${summaryA.total_due}`
    );

    // -------------------------------------------------------------
    // TEST 17: Verify user authentication & student authorization isolation
    // -------------------------------------------------------------
    const adminLogin = await AuthService.login('admin@giit.ac.in', 'Admin@GIIT2026');
    assert(
      adminLogin.user.role === 'ADMIN' && typeof adminLogin.token === 'string',
      'TEST 17A: Admin authentication succeeds'
    );

    const studentLogin = await AuthService.login(
      studentA.enrollment_number,
      `${studentA.enrollment_number}@giit`
    );
    assert(
      studentLogin.user.role === 'STUDENT' &&
        studentLogin.user.student_id === studentA.student_id,
      'TEST 17B: Student authentication succeeds with correct linked student_id'
    );

    // Test token verification
    const decodedStudentToken = AuthService.verifyToken(studentLogin.token);
    assert(
      decodedStudentToken.student_id === studentA.student_id,
      'TEST 17C: Token contains immutable student_id claim for server-side authorization'
    );

    // -------------------------------------------------------------
    // SECTION 24: CRITICAL DATA ISOLATION TEST SPECIFICATION
    // -------------------------------------------------------------
    console.log('\n--- EXECUTING SPECIFIED CRITICAL DATA ISOLATION TEST (SECTION 24) ---');
    // Create Student A: Name: Rahul Kumar, Enrollment: STU_ISO_001
    const isoA = StudentService.createStudent({
      enrollment_number: 'STU_ISO_001',
      student_name: 'Rahul Kumar',
      course: 'B.Tech',
      semester: 1,
      academic_session: '2024-2028',
      mobile: '9111111111',
      total_course_fee: 50000,
    }).student;

    // Create Student B: Name: Amit Kumar, Enrollment: STU_ISO_002
    const isoB = StudentService.createStudent({
      enrollment_number: 'STU_ISO_002',
      student_name: 'Amit Kumar',
      course: 'BCA',
      semester: 1,
      academic_session: '2024-2027',
      mobile: '9222222222',
      total_course_fee: 40000,
    }).student;

    // Update Student A: mobile changed
    StudentService.updateStudent(isoA.student_id, {
      mobile: '9333333333',
    });

    const refreshedIsoA = StudentService.getStudentById(isoA.student_id);
    const refreshedIsoB = StudentService.getStudentById(isoB.student_id);

    assert(
      refreshedIsoA.mobile === '9333333333' && refreshedIsoB.mobile === '9222222222',
      'CRITICAL ISO-1: Update STU001 changes STU001 while STU002 remains exactly unchanged'
    );

    // Then create Student C: Name: Rahul Kumar (Same name as A!), Enrollment: STU_ISO_003
    const isoC = StudentService.createStudent({
      enrollment_number: 'STU_ISO_003',
      student_name: 'Rahul Kumar',
      course: 'MCA',
      semester: 1,
      academic_session: '2024-2026',
      mobile: '9444444444',
      total_course_fee: 60000,
    }).student;

    assert(
      isoA.student_id !== isoC.student_id &&
        isoA.student_name === isoC.student_name &&
        isoA.enrollment_number === 'STU_ISO_001' &&
        isoC.enrollment_number === 'STU_ISO_003',
      'CRITICAL ISO-2: STU001 != STU003 even though names are identical (Same name != same student)'
    );

    // -------------------------------------------------------------
    // TEST 18: Dashboard Metrics
    // -------------------------------------------------------------
    const stats = DashboardService.getStats();
    assert(
      stats.total_students >= 5 &&
        stats.total_collected === 20000 &&
        stats.recent_payments.length > 0,
      'TEST 18: Dashboard statistics correctly calculated from database records',
      `students=${stats.total_students}, collected=${stats.total_collected}, due=${stats.total_due}`
    );

    console.log('\n============================================================');
    console.log(`TEST SUITE FINISHED: ${passedCount} PASSED, ${failedCount} FAILED`);
    console.log('============================================================\n');

    if (failedCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Test execution threw an unexpected error:', error);
    process.exit(1);
  } finally {
    Database.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

runAllTests();
