import path from 'path';
import fs from 'fs';
import { Database } from '../src/db/database';
import { StudentService } from '../src/services/student.service';
import { FeeService } from '../src/services/fee.service';
import { PaymentService } from '../src/services/payment.service';
import { AuthService } from '../src/services/auth.service';
import { ReceiptService } from '../src/services/receipt.service';
import { PaymentRepository } from '../src/repositories/payment.repository';
import { computeSignatureForTesting, verifyRazorpaySignature } from '../src/utils/razorpay';
import { config } from '../src/config/env';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${detail ? `(${detail})` : ''}`);
    failed++;
  }
}

async function runRazorpayFlowTests() {
  console.log('============================================================');
  console.log('GIIT FEE MANAGEMENT — COMPLETE RAZORPAY PAYMENT FLOW TEST SUITE');
  console.log('============================================================\n');

  // Use an isolated test database
  const testDbPath = path.resolve(process.cwd(), 'data', 'test_razorpay_suite.sqlite');
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  await Database.init(testDbPath);

  try {
    // -------------------------------------------------------------
    // Setup: Create test student and fee records
    // -------------------------------------------------------------
    console.log('--> Setup: Creating test student and fee records...');
    const studentRes = StudentService.createStudent({
      enrollment_number: 'GIIT-RZP-2026-001',
      student_name: 'Ananya Sharma',
      course: 'B.Tech IT',
      semester: 3,
      academic_session: '2024-2028',
      mobile: '9876500001',
      email: 'ananya.sharma@giit.ac.in',
      total_course_fee: 120000,
    });
    const student = studentRes.student;
    assert(!!student.student_id, 'Student created successfully');

    const fee = FeeService.createFee(student.student_id, {
      academic_session: '2024-2028',
      course: 'B.Tech IT',
      semester: 3,
      fee_type: 'Semester 3 Tuition Fee',
      amount: 40000,
      due_date: '2026-11-30',
    });
    assert(fee.amount === 40000 && fee.status === 'PENDING', 'Fee record created with status PENDING');

    // -------------------------------------------------------------
    // Requirement 1 & 2: Create Razorpay order server-side & protect secret
    // -------------------------------------------------------------
    console.log('\n--> Requirements 1 & 2: Server-side Razorpay Order Creation & Secret Protection...');
    const order = PaymentService.createOrder({
      student_id: student.student_id,
      fee_id: fee.fee_id,
      amount: 25000,
      notes: 'Semester 3 Installment 1',
    });

    assert(order.order_id.startsWith('order_'), 'Requirement 1A: Razorpay order created server-side with order_* prefix');
    assert(order.amount === 25000 && order.currency === 'INR', 'Requirement 1B: Order amount and currency strictly match');
    assert(order.key_id === config.RAZORPAY_KEY_ID, 'Requirement 1C: Public RAZORPAY_KEY_ID provided for client checkout');

    // Security check: Verify RAZORPAY_KEY_SECRET is NEVER leaked in order response
    const orderString = JSON.stringify(order);
    const secretLeakedInOrder = orderString.includes(config.RAZORPAY_KEY_SECRET);
    assert(!secretLeakedInOrder, 'Requirement 2: RAZORPAY_KEY_SECRET is strictly guarded and never exposed in order response');

    // -------------------------------------------------------------
    // Requirement 3 & 4: Order stored in payment_orders table and linked
    // -------------------------------------------------------------
    console.log('\n--> Requirements 3 & 4: Database Persistence in payment_orders Table...');
    const storedOrder = PaymentRepository.findOrderById(order.order_id);
    assert(!!storedOrder, 'Requirement 3: Payment order persisted in payment_orders table');
    assert(
      storedOrder?.student_id === student.student_id && storedOrder?.fee_id === fee.fee_id,
      'Requirement 4: Order strictly linked to student_id and fee_id in database'
    );
    assert(storedOrder?.status === 'CREATED', 'Order initial status is CREATED (PENDING payment)');

    // -------------------------------------------------------------
    // Requirement 5: Validate student_id and fee_id exist before order creation
    // -------------------------------------------------------------
    console.log('\n--> Requirement 5: Validation of Student and Fee Existence...');
    let nonExistentStudentError = false;
    try {
      PaymentService.createOrder({
        student_id: 'STU_DOES_NOT_EXIST_9999',
        fee_id: fee.fee_id,
        amount: 5000,
      });
    } catch (err: any) {
      nonExistentStudentError = err.statusCode === 404 || err.message.includes('not found');
    }
    assert(nonExistentStudentError, 'Requirement 5A: Rejects order creation for non-existent student (404 Not Found)');

    let nonExistentFeeError = false;
    try {
      PaymentService.createOrder({
        student_id: student.student_id,
        fee_id: 'FEE_DOES_NOT_EXIST_9999',
        amount: 5000,
      });
    } catch (err: any) {
      nonExistentFeeError = err.statusCode === 404 || err.message.includes('not found');
    }
    assert(nonExistentFeeError, 'Requirement 5B: Rejects order creation for non-existent fee (404 Not Found)');

    // Another student's fee
    const otherStudent = StudentService.createStudent({
      enrollment_number: 'GIIT-RZP-2026-002',
      student_name: 'Vikram Mehta',
      course: 'BCA',
      semester: 1,
      academic_session: '2024-2027',
      mobile: '9876500002',
      total_course_fee: 90000,
    }).student;

    let mismatchedOwnershipError = false;
    try {
      PaymentService.createOrder({
        student_id: otherStudent.student_id,
        fee_id: fee.fee_id, // Belongs to Ananya Sharma
        amount: 5000,
      });
    } catch (err: any) {
      mismatchedOwnershipError = err.statusCode === 400 || err.message.includes('does not belong');
    }
    assert(mismatchedOwnershipError, 'Requirement 5C: Rejects order creation when fee does not belong to the student');

    // -------------------------------------------------------------
    // Requirement 6: Validate payment amount against applicable fee
    // -------------------------------------------------------------
    console.log('\n--> Requirement 6: Amount Validation (Prevent zero, negative, or excessive amounts)...');
    let zeroAmountError = false;
    try {
      PaymentService.createOrder({
        student_id: student.student_id,
        fee_id: fee.fee_id,
        amount: 0,
      });
    } catch (err: any) {
      zeroAmountError = err.statusCode === 400 || err.message.includes('greater than zero');
    }
    assert(zeroAmountError, 'Requirement 6A: Rejects order with zero amount (<= 0)');

    let negativeAmountError = false;
    try {
      PaymentService.createOrder({
        student_id: student.student_id,
        fee_id: fee.fee_id,
        amount: -1000,
      });
    } catch (err: any) {
      negativeAmountError = err.statusCode === 400 || err.message.includes('greater than zero');
    }
    assert(negativeAmountError, 'Requirement 6B: Rejects order with negative amount');

    let excessiveAmountError = false;
    try {
      PaymentService.createOrder({
        student_id: student.student_id,
        fee_id: fee.fee_id,
        amount: 50000, // fee total is 40,000
      });
    } catch (err: any) {
      excessiveAmountError = err.statusCode === 400 || err.message.includes('exceeds outstanding');
    }
    assert(excessiveAmountError, 'Requirement 6C: Rejects order exceeding outstanding fee balance');

    // -------------------------------------------------------------
    // Requirement 7 & 8: Verify signature server-side using HMAC-SHA256 & reject invalid
    // -------------------------------------------------------------
    console.log('\n--> Requirements 7 & 8: HMAC-SHA256 Signature Verification & Rejection...');
    let rejectedForgedSig = false;
    try {
      PaymentService.verifyPayment({
        razorpay_order_id: order.order_id,
        razorpay_payment_id: 'pay_tampered_99999',
        razorpay_signature: 'fake_tampered_signature_hex_code_1234567890abcdef',
        student_id: student.student_id,
        fee_id: fee.fee_id,
      });
    } catch (err: any) {
      rejectedForgedSig = err.statusCode === 400 || err.message.includes('signature verification failed');
    }
    assert(rejectedForgedSig, 'Requirement 8A: Strictly rejects invalid/tampered signature');

    // Test with altered payload
    const paymentId1 = 'pay_rzp_real_test_001';
    const validSignature1 = computeSignatureForTesting(order.order_id, paymentId1);

    let rejectedAlteredOrderId = false;
    try {
      PaymentService.verifyPayment({
        razorpay_order_id: 'order_altered_different_id',
        razorpay_payment_id: paymentId1,
        razorpay_signature: validSignature1,
        student_id: student.student_id,
        fee_id: fee.fee_id,
      });
    } catch (err: any) {
      rejectedAlteredOrderId = true;
    }
    assert(rejectedAlteredOrderId, 'Requirement 8B: Rejects signature if order ID does not match HMAC payload');

    // Test timingSafeEqual unit check
    const verifyUnitPass = verifyRazorpaySignature({
      orderId: order.order_id,
      paymentId: paymentId1,
      signature: validSignature1,
    });
    const verifyUnitFail = verifyRazorpaySignature({
      orderId: order.order_id,
      paymentId: paymentId1,
      signature: '0000000000000000000000000000000000000000000000000000000000000000',
    });
    assert(verifyUnitPass && !verifyUnitFail, 'Requirement 7: Server-side HMAC-SHA256 verification function passes valid & rejects forged');

    // -------------------------------------------------------------
    // Requirement 9: Successful verification and payment persistence
    // -------------------------------------------------------------
    console.log('\n--> Requirement 9: Successful Payment Record Creation & Properties...');
    const verifyResult = PaymentService.verifyPayment({
      razorpay_order_id: order.order_id,
      razorpay_payment_id: paymentId1,
      razorpay_signature: validSignature1,
      student_id: student.student_id,
      fee_id: fee.fee_id,
      payment_method: 'NETBANKING',
    });

    const payment = verifyResult.payment;
    assert(payment.payment_status === 'SUCCESS', 'Requirement 9A: payment_status is strictly SUCCESS');
    assert(payment.student_id === student.student_id, 'Requirement 9B: student_id matches');
    assert(payment.fee_id === fee.fee_id, 'Requirement 9C: fee_id matches');
    assert(payment.amount === 25000, 'Requirement 9D: payment amount matches verified order amount');
    assert(payment.razorpay_order_id === order.order_id, 'Requirement 9E: razorpay_order_id matches');
    assert(payment.razorpay_payment_id === paymentId1, 'Requirement 9F: razorpay_payment_id matches');
    assert(payment.razorpay_signature === validSignature1, 'Requirement 9G: razorpay_signature matches');
    assert(payment.payment_id.startsWith('PAY'), 'Requirement 9H: Sequential payment_id assigned');

    // Check payment_orders table was updated to PAID
    const orderAfterPayment = PaymentRepository.findOrderById(order.order_id);
    assert(orderAfterPayment?.status === 'PAID', 'Requirement 9I: payment_orders record status transitioned to PAID');

    // -------------------------------------------------------------
    // Requirement 10: Prevent duplicate processing of the same Razorpay payment
    // -------------------------------------------------------------
    console.log('\n--> Requirement 10: Duplicate Payment Prevention (Idempotency Guarantee)...');
    const duplicateAttempt = PaymentService.verifyPayment({
      razorpay_order_id: order.order_id,
      razorpay_payment_id: paymentId1, // Same payment ID
      razorpay_signature: validSignature1,
      student_id: student.student_id,
      fee_id: fee.fee_id,
    });

    assert(duplicateAttempt.is_duplicate === true, 'Requirement 10A: Duplicate verification flagged with is_duplicate: true');
    assert(duplicateAttempt.payment.payment_id === payment.payment_id, 'Requirement 10B: Returns existing payment record without creating new');

    const allPaymentsForStudent = PaymentRepository.findByStudent(student.student_id);
    assert(allPaymentsForStudent.length === 1, 'Requirement 10C: Database confirms exactly 1 payment record exists (no duplicate inserted)');

    // -------------------------------------------------------------
    // Requirement 11: Update fee's paid amount, due amount and status correctly
    // -------------------------------------------------------------
    console.log('\n--> Requirement 11: Fee Balance & Status Updates (PARTIAL & PAID transitions)...');
    const feeAfterPartial = FeeService.getFeeById(fee.fee_id);
    assert(feeAfterPartial.paid_amount === 25000, 'Requirement 11A: Fee paid_amount correctly updated to 25000');
    assert(feeAfterPartial.due_amount === 15000, 'Requirement 11B: Fee due_amount correctly calculated as 15000');
    assert(feeAfterPartial.status === 'PARTIAL', 'Requirement 11C: Fee status transitioned to PARTIAL');

    // Now pay the remaining balance of 15000
    const secondOrder = PaymentService.createOrder({
      student_id: student.student_id,
      fee_id: fee.fee_id,
      amount: 15000, // Remaining due
    });
    const paymentId2 = 'pay_rzp_real_test_002';
    const validSignature2 = computeSignatureForTesting(secondOrder.order_id, paymentId2);

    const secondPayment = PaymentService.verifyPayment({
      razorpay_order_id: secondOrder.order_id,
      razorpay_payment_id: paymentId2,
      razorpay_signature: validSignature2,
      student_id: student.student_id,
      fee_id: fee.fee_id,
      payment_method: 'CARD',
    });

    assert(secondPayment.payment.payment_status === 'SUCCESS', 'Second payment recorded as SUCCESS');

    const feeAfterFull = FeeService.getFeeById(fee.fee_id);
    assert(feeAfterFull.paid_amount === 40000, 'Requirement 11D: Fee paid_amount is now full 40000');
    assert(feeAfterFull.due_amount === 0, 'Requirement 11E: Fee due_amount is now 0');
    assert(feeAfterFull.status === 'PAID', 'Requirement 11F: Fee status transitioned to PAID');

    // Attempting further payment on fully paid fee must be rejected
    let rejectedOverpayment = false;
    try {
      PaymentService.createOrder({
        student_id: student.student_id,
        fee_id: fee.fee_id,
        amount: 1000,
      });
    } catch (err: any) {
      rejectedOverpayment = err.message.includes('already fully paid');
    }
    assert(rejectedOverpayment, 'Requirement 11G: Order creation rejected for fully paid fee');

    // -------------------------------------------------------------
    // Requirement 12: Official receipt generated/retrieved only after successful verification
    // -------------------------------------------------------------
    console.log('\n--> Requirement 12: Receipt Generation & Linkage...');
    const receipt1 = verifyResult.receipt;
    assert(receipt1.receipt_number.startsWith('RCP-'), 'Requirement 12A: Receipt number generated in RCP-YYYY-XXXXX format');
    assert(receipt1.student_id === student.student_id, 'Requirement 12B: Receipt linked to student');
    assert(receipt1.fee_id === fee.fee_id, 'Requirement 12C: Receipt linked to fee');
    assert(receipt1.payment_id === payment.payment_id, 'Requirement 12D: Receipt linked to payment');
    assert(receipt1.amount_paid === 25000, 'Requirement 12E: Receipt reflects correct paid amount');
    assert(receipt1.razorpay_order_id === order.order_id, 'Requirement 12F: Receipt includes Razorpay Order ID');
    assert(receipt1.razorpay_payment_id === paymentId1, 'Requirement 12G: Receipt includes Razorpay Payment ID');

    // Receipt retrieved by receipt number
    const fetchedReceipt = ReceiptService.getReceiptByNumber(receipt1.receipt_number);
    assert(fetchedReceipt.receipt_number === receipt1.receipt_number, 'Requirement 12H: Receipt retrievable by receipt_number');

    // Secret must NEVER be present on receipt object
    const receiptString = JSON.stringify(receipt1);
    assert(!receiptString.includes(config.RAZORPAY_KEY_SECRET), 'Requirement 12I: RAZORPAY_KEY_SECRET is not in receipt object');

    // -------------------------------------------------------------
    // Requirement 13: Handle FAILED, PENDING and REFUNDED states safely
    // -------------------------------------------------------------
    console.log('\n--> Requirement 13: Handling FAILED, PENDING, and REFUNDED States...');
    // A. Failed payment order
    const otherFee = FeeService.createFee(otherStudent.student_id, {
      academic_session: '2024-2027',
      course: 'BCA',
      semester: 1,
      fee_type: 'First Semester Tuition',
      amount: 20000,
      due_date: '2026-10-31',
    });

    const failedOrder = PaymentService.createOrder({
      student_id: otherStudent.student_id,
      fee_id: otherFee.fee_id,
      amount: 10000,
    });
    const failureRecord = PaymentService.recordFailedPayment({
      razorpay_order_id: failedOrder.order_id,
      error_code: 'BAD_REQUEST_ERROR',
      error_description: 'Payment was cancelled by user',
    });
    assert(failureRecord.status === 'FAILED', 'Requirement 13A: Failed payment order marked as FAILED');
    const storedFailedOrder = PaymentRepository.findOrderById(failedOrder.order_id);
    assert(storedFailedOrder?.status === 'FAILED', 'Requirement 13B: Stored order status is FAILED in database');

    // B. Refunding a payment
    // Student has 2 payments: payment (25000) and secondPayment.payment (15000)
    // Fee status is PAID (40,000 paid).
    // Now refund the second payment (15,000)
    const refundResult = PaymentService.refundPayment(secondPayment.payment.payment_id, 'Overpayment adjustment');
    assert(refundResult.refunded === true, 'Requirement 13C: Refund processed successfully');
    assert(refundResult.payment.payment_status === 'REFUNDED', 'Requirement 13D: Payment status updated to REFUNDED');

    // Fee balance and status should recalculate: total paid is now 25,000 (not 40,000), due is 15,000, status is PARTIAL
    const feeAfterRefund = FeeService.getFeeById(fee.fee_id);
    assert(feeAfterRefund.paid_amount === 25000, 'Requirement 13E: Fee paid_amount rolled back to 25000 after refund');
    assert(feeAfterRefund.due_amount === 15000, 'Requirement 13F: Fee due_amount restored to 15000 after refund');
    assert(feeAfterRefund.status === 'PARTIAL', 'Requirement 13G: Fee status downgraded back to PARTIAL after refund');

    // Duplicate refund must be rejected
    let duplicateRefundError = false;
    try {
      PaymentService.refundPayment(secondPayment.payment.payment_id);
    } catch (err: any) {
      duplicateRefundError = err.message.includes('already been refunded');
    }
    assert(duplicateRefundError, 'Requirement 13H: Duplicate refund rejected');

    // Receipt retrieval for refunded payment must be rejected
    let receiptForRefundedError = false;
    try {
      ReceiptService.getReceiptByPaymentId(secondPayment.payment.payment_id);
    } catch (err: any) {
      receiptForRefundedError = err.message.includes('REFUNDED') || err.message.includes('Only successfully recorded payments');
    }
    assert(receiptForRefundedError, 'Requirement 13I: Receipt generation/retrieval rejected for REFUNDED payment');

    // -------------------------------------------------------------
    // Requirement 14: Never mark a payment SUCCESS based only on frontend data
    // -------------------------------------------------------------
    console.log('\n--> Requirement 14: Client-Side Trust Boundary (Never trust frontend status flag)...');
    let spoofAttemptRejected = false;
    try {
      // Attacker sends payment_status = SUCCESS with fake signature
      PaymentService.verifyPayment({
        razorpay_order_id: failedOrder.order_id,
        razorpay_payment_id: 'pay_attacker_spoofed_001',
        razorpay_signature: 'spoofed_signature',
        student_id: otherStudent.student_id,
        ...({ payment_status: 'SUCCESS' } as any),
      });
    } catch (err: any) {
      spoofAttemptRejected = err.message.includes('signature verification failed');
    }
    assert(spoofAttemptRejected, 'Requirement 14: Spoofed payment_status = SUCCESS without valid HMAC is rejected');

    // -------------------------------------------------------------
    // Requirement 15 & 16: Safe test credentials & regression testing
    // -------------------------------------------------------------
    console.log('\n--> Requirement 15 & 16: Credentials & Regression Verification...');
    assert(typeof config.RAZORPAY_KEY_ID === 'string' && config.RAZORPAY_KEY_ID.length > 0, 'Requirement 16A: RAZORPAY_KEY_ID configured in environment');
    assert(typeof config.RAZORPAY_KEY_SECRET === 'string' && config.RAZORPAY_KEY_SECRET.length > 0, 'Requirement 16B: RAZORPAY_KEY_SECRET configured in environment');

    // Check secrets are not logged anywhere or in errors
    let errorSecretCheck = false;
    try {
      PaymentService.verifyPayment({
        razorpay_order_id: 'order_invalid',
        razorpay_payment_id: 'pay_invalid',
        razorpay_signature: 'sig_invalid',
        student_id: student.student_id,
      });
    } catch (err: any) {
      errorSecretCheck = !err.message.includes(config.RAZORPAY_KEY_SECRET);
    }
    assert(errorSecretCheck, 'Requirement 20: Errors never expose RAZORPAY_KEY_SECRET');

    console.log('\n============================================================');
    console.log(`RAZORPAY FLOW TEST SUITE RESULT: ${passed} PASSED, ${failed} FAILED`);
    console.log('============================================================\n');

    if (failed > 0) {
      process.exit(1);
    }
  } catch (error) {
    console.error('Unexpected error in test suite execution:', error);
    process.exit(1);
  } finally {
    Database.close();
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
  }
}

runRazorpayFlowTests();
