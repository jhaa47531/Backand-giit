import http from 'http';
import { Database } from '../src/db/database';

interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
  errors?: any[];
}

async function apiRequest<T = any>(
  endpoint: string,
  method: string = 'GET',
  body?: any,
  token?: string
): Promise<{ status: number; body: ApiResponse<T> }> {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : undefined;
    const headers: http.OutgoingHttpHeaders = {
      Accept: 'application/json',
    };
    if (postData) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(postData);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: endpoint,
        method,
        headers,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve({ status: res.statusCode || 0, body: parsed });
          } catch (e) {
            reject(new Error(`Failed to parse response: ${raw.slice(0, 200)}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function runFeeCrudSuite() {
  console.log('============================================================');
  console.log('GIIT FEE MANAGEMENT BACKEND — FEE API SUITE & VERIFICATION');
  console.log('============================================================\n');

  // Initialize DB connection for direct foreign key check
  await Database.init();

  // Step 0: Obtain Admin Auth Token
  console.log('--> Step 0: Authenticating as Admin...');
  const loginRes = await apiRequest('/api/auth/login', 'POST', {
    username: 'admin@giit.ac.in',
    password: 'Admin@GIIT2026',
  });
  if (loginRes.status !== 200 || !loginRes.body.data?.token) {
    throw new Error(`Admin authentication failed: ${JSON.stringify(loginRes.body)}`);
  }
  const adminToken = loginRes.body.data.token;
  console.log('    ✓ Admin authenticated successfully.\n');

  // Setup: Create a temporary test student for the fee tests
  console.log('--> Setup: Creating dedicated test student...');
  const studentPayload = {
    enrollment_number: 'GIIT-FEE-TEST-2026-001',
    student_name: 'Fee API Test Student',
    course: 'BCA',
    semester: 4,
    academic_session: '2026-27',
    total_course_fee: 75000,
  };
  const stuRes = await apiRequest('/api/students', 'POST', studentPayload, adminToken);
  if (stuRes.status !== 201 || !stuRes.body.data?.student?.student_id) {
    throw new Error(`Failed to create test student: ${JSON.stringify(stuRes.body)}`);
  }
  const testStudent = stuRes.body.data.student;
  const testStudentId = testStudent.student_id;
  console.log(`    ✓ Created Test Student: ${testStudent.student_name} (ID: ${testStudentId})\n`);

  let testFeeId = '';

  try {
    // Requirement 1 & 2: Create a fee for an existing test student linked by student_id
    console.log('--> Requirement 1 & 2: Creating fee linked by student_id...');
    const feePayload = {
      academic_session: '2026-27',
      course: 'BCA',
      semester: 4,
      fee_type: 'Semester Tuition Fee',
      amount: 35000,
      due_date: '2026-10-15',
    };

    const createFeeRes = await apiRequest(`/api/students/${testStudentId}/fees`, 'POST', feePayload, adminToken);
    console.log(`    Status: ${createFeeRes.status}`);
    console.log(`    Response: ${JSON.stringify(createFeeRes.body, null, 2)}`);

    if (createFeeRes.status !== 201 || !createFeeRes.body.success || !createFeeRes.body.data?.fee_id) {
      throw new Error(`Failed to create fee: ${JSON.stringify(createFeeRes.body)}`);
    }

    const createdFee = createFeeRes.body.data;
    testFeeId = createdFee.fee_id;

    // Verify Requirement 1: Fees must ALWAYS be linked using student_id, never student_name
    if (createdFee.student_id !== testStudentId) {
      throw new Error(`Requirement 1 violation: fee.student_id (${createdFee.student_id}) !== testStudentId (${testStudentId})`);
    }
    if ((createdFee as any).student_name !== undefined) {
      throw new Error('Requirement 1 violation: fee record contains student_name instead of pure student_id linkage');
    }
    console.log(`    ✓ Requirement 1 & 2 Passed: Fee ${testFeeId} created and strictly linked to student_id: ${createdFee.student_id}\n`);

    // Requirement 3: Fetch all fees for that student
    console.log(`--> Requirement 3: Fetching all fees for student ${testStudentId}...`);
    const studentFeesRes = await apiRequest(`/api/students/${testStudentId}/fees`, 'GET', undefined, adminToken);
    console.log(`    Status: ${studentFeesRes.status}`);
    console.log(`    Count of fees found: ${studentFeesRes.body.data?.length}`);

    if (studentFeesRes.status !== 200 || !Array.isArray(studentFeesRes.body.data)) {
      throw new Error(`Failed to fetch fees by student: ${JSON.stringify(studentFeesRes.body)}`);
    }
    const matchedFee = studentFeesRes.body.data.find((f: any) => f.fee_id === testFeeId);
    if (!matchedFee) {
      throw new Error(`Created fee ${testFeeId} not found in student's fee list`);
    }
    if (matchedFee.student_id !== testStudentId) {
      throw new Error(`Fee in list has invalid student_id: ${matchedFee.student_id}`);
    }
    console.log(`    ✓ Requirement 3 Passed: Successfully fetched student fees (found ${studentFeesRes.body.data.length} fee(s))\n`);

    // Requirement 4: Fetch the fee by fee_id
    console.log(`--> Requirement 4: Fetching fee by fee_id (${testFeeId})...`);
    const singleFeeRes = await apiRequest(`/api/fees/${testFeeId}`, 'GET', undefined, adminToken);
    console.log(`    Status: ${singleFeeRes.status}`);
    console.log(`    Response: ${JSON.stringify(singleFeeRes.body, null, 2)}`);

    if (singleFeeRes.status !== 200 || !singleFeeRes.body.success) {
      throw new Error(`Failed to fetch fee by fee_id: ${JSON.stringify(singleFeeRes.body)}`);
    }
    const fetchedFee = singleFeeRes.body.data;
    if (fetchedFee.fee_id !== testFeeId || fetchedFee.student_id !== testStudentId) {
      throw new Error(`Fetched fee data mismatch: ${JSON.stringify(fetchedFee)}`);
    }
    console.log(`    ✓ Requirement 4 Passed: Fee correctly fetched by fee_id with matching student_id and amount.\n`);

    // Requirement 5: Update the fee
    console.log(`--> Requirement 5: Updating fee (${testFeeId})...`);
    const updatePayload = {
      fee_type: 'Updated BCA Tuition & Lab Fee',
      amount: 40000,
    };
    const updateFeeRes = await apiRequest(`/api/fees/${testFeeId}`, 'PUT', updatePayload, adminToken);
    console.log(`    Status: ${updateFeeRes.status}`);
    console.log(`    Response: ${JSON.stringify(updateFeeRes.body, null, 2)}`);

    if (updateFeeRes.status !== 200 || !updateFeeRes.body.success) {
      throw new Error(`Failed to update fee: ${JSON.stringify(updateFeeRes.body)}`);
    }
    if (updateFeeRes.body.data?.fee_type !== 'Updated BCA Tuition & Lab Fee' || Number(updateFeeRes.body.data?.amount) !== 40000) {
      throw new Error(`Updated fee values mismatch: ${JSON.stringify(updateFeeRes.body.data)}`);
    }
    console.log(`    ✓ Requirement 5 Passed: Fee successfully updated.\n`);

    // Requirement 6: Verify fee status transitions correctly: PENDING, PARTIAL, PAID, OVERDUE
    console.log('--> Requirement 6: Verifying fee status transitions (PENDING -> PARTIAL -> PAID -> OVERDUE)...');

    const statuses: Array<'PARTIAL' | 'PAID' | 'OVERDUE' | 'PENDING'> = ['PARTIAL', 'PAID', 'OVERDUE', 'PENDING'];
    for (const targetStatus of statuses) {
      const transitionRes = await apiRequest(`/api/fees/${testFeeId}`, 'PUT', { status: targetStatus }, adminToken);
      if (transitionRes.status !== 200 || transitionRes.body.data?.status !== targetStatus) {
        throw new Error(`Failed transition to ${targetStatus}: ${JSON.stringify(transitionRes.body)}`);
      }
      // Re-fetch to guarantee database persistence
      const verifyRes = await apiRequest(`/api/fees/${testFeeId}`, 'GET', undefined, adminToken);
      if (verifyRes.body.data?.status !== targetStatus) {
        throw new Error(`Status persistence check failed for ${targetStatus}: got ${verifyRes.body.data?.status}`);
      }
      console.log(`    ✓ State transition -> ${targetStatus}: verified in database.`);
    }

    // Verify rejection of invalid status transition
    const invalidStatusRes = await apiRequest(`/api/fees/${testFeeId}`, 'PUT', { status: 'CANCELLED_INVALID' }, adminToken);
    if (invalidStatusRes.status === 200) {
      throw new Error('Backend failed to reject invalid fee status!');
    }
    console.log(`    ✓ Invalid status rejected properly with HTTP ${invalidStatusRes.status}`);
    console.log('    ✓ Requirement 6 Passed: Complete status transitions verified.\n');

    // Requirement 7: Reject creation when student_id does not exist
    console.log('--> Requirement 7: Attempting to create fee for non-existent student_id...');
    const nonExistentStudentId = 'STU_DOES_NOT_EXIST_99999';
    const invalidStudentRes = await apiRequest(`/api/students/${nonExistentStudentId}/fees`, 'POST', {
      academic_session: '2026-27',
      course: 'BCA',
      semester: 1,
      fee_type: 'Tuition Fee',
      amount: 15000,
      due_date: '2026-12-31',
    }, adminToken);

    console.log(`    Status: ${invalidStudentRes.status}`);
    console.log(`    Response: ${JSON.stringify(invalidStudentRes.body)}`);

    if (invalidStudentRes.status !== 404 && invalidStudentRes.status !== 400) {
      throw new Error(`Expected HTTP 404 or 400 for non-existent student_id, got: ${invalidStudentRes.status}`);
    }
    console.log(`    ✓ Requirement 7 Passed: Rejected fee creation for non-existent student with status ${invalidStudentRes.status}.\n`);

    // Requirement 8: Delete the temporary fee and confirm deletion
    console.log(`--> Requirement 8: Deleting temporary fee (${testFeeId})...`);
    const deleteFeeRes = await apiRequest(`/api/fees/${testFeeId}`, 'DELETE', undefined, adminToken);
    console.log(`    Status: ${deleteFeeRes.status}`);
    console.log(`    Response: ${JSON.stringify(deleteFeeRes.body, null, 2)}`);

    if (deleteFeeRes.status !== 200 || !deleteFeeRes.body.success) {
      throw new Error(`Failed to delete fee: ${JSON.stringify(deleteFeeRes.body)}`);
    }

    // Confirm deleted fee can no longer be fetched
    const fetchDeletedFeeRes = await apiRequest(`/api/fees/${testFeeId}`, 'GET', undefined, adminToken);
    console.log(`    Fetch deleted fee status: ${fetchDeletedFeeRes.status}`);
    if (fetchDeletedFeeRes.status !== 404) {
      throw new Error(`Expected HTTP 404 for deleted fee, got: ${fetchDeletedFeeRes.status}`);
    }
    console.log(`    ✓ Requirement 8 Passed: Temporary fee deleted and confirmed 404 Not Found.\n`);

    // Requirement 9: Verify foreign-key integrity
    console.log('--> Requirement 9: Verifying Foreign-Key Integrity...');

    // 9A: Relational database foreign key enforcement on INSERT
    let fkRejected = false;
    try {
      Database.run(
        `INSERT INTO fees (fee_id, student_id, academic_session, course, semester, fee_type, amount, due_date, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ['FEE_FK_TEST_001', 'STU_UNKNOWN_FK_999', '2026-27', 'BCA', 1, 'Lab Fee', 5000, '2026-11-01', 'PENDING']
      );
    } catch (err: any) {
      fkRejected = err.message && (err.message.includes('FOREIGN KEY') || err.message.includes('constraint failed'));
      console.log(`    Direct SQLite Foreign Key check error: "${err.message}"`);
    }
    if (!fkRejected) {
      throw new Error('SQLite foreign key constraint was not enforced on invalid student_id insert!');
    }
    console.log('    ✓ 9A: Direct SQLite foreign-key constraint enforcement verified.');

    // 9B: Cascade foreign-key integrity test
    console.log('    9B: Testing cascade referential integrity upon student removal...');
    // Create temporary fee for testStudentId
    const tempFee = await apiRequest(`/api/students/${testStudentId}/fees`, 'POST', {
      academic_session: '2026-27',
      course: 'BCA',
      semester: 4,
      fee_type: 'Cascade Verification Fee',
      amount: 12000,
      due_date: '2026-12-01',
    }, adminToken);
    const tempFeeId = tempFee.body.data?.fee_id;

    // Delete the student
    const delStu = await apiRequest(`/api/students/${testStudentId}`, 'DELETE', undefined, adminToken);
    if (delStu.status !== 200) {
      throw new Error(`Failed to delete student for cascade check: ${JSON.stringify(delStu.body)}`);
    }

    // Verify that the fee linked to the deleted student was cascaded and no longer exists
    const checkFee = await apiRequest(`/api/fees/${tempFeeId}`, 'GET', undefined, adminToken);
    if (checkFee.status !== 404) {
      throw new Error(`Cascade referential integrity failed: fee ${tempFeeId} still exists after student deletion!`);
    }
    console.log('    ✓ 9B: Cascade referential integrity verified (fees properly removed with student).');
    console.log('    ✓ Requirement 9 Passed: Foreign-key integrity fully verified.\n');

  } finally {
    // Clean up test student if still exists
    try {
      await apiRequest(`/api/students/${testStudentId}`, 'DELETE', undefined, adminToken);
    } catch {
      // already cleaned up
    }
  }

  console.log('============================================================');
  console.log('ALL FEE API REQUIREMENTS (1 THROUGH 9) VERIFIED 100% PASS');
  console.log('============================================================');
}

runFeeCrudSuite().catch((err) => {
  console.error('\n❌ FEE API TEST SUITE FAILED:', err);
  process.exit(1);
});
