import http from 'http';

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

async function runStudentCrudTest() {
  console.log('============================================================');
  console.log('GIIT FEE MANAGEMENT BACKEND — STUDENT CRUD API TEST');
  console.log('============================================================\n');

  // Step 0: Obtain Admin Token
  console.log('--> Step 0: Authenticating as Admin...');
  const loginRes = await apiRequest('/api/auth/login', 'POST', {
    username: 'admin@giit.ac.in',
    password: 'Admin@GIIT2026',
  });

  if (loginRes.status !== 200 || !loginRes.body.data?.token) {
    throw new Error(`Admin login failed: ${JSON.stringify(loginRes.body)}`);
  }
  const adminToken = loginRes.body.data.token;
  console.log('    ✓ Admin authenticated successfully. Token received.\n');

  // Operation 1: Create one temporary student
  console.log('--> Operation 1: Creating temporary student...');
  const payload1 = {
    enrollment_number: 'GIIT-API-TEST-2026-001',
    student_name: 'GIIT API Test Student',
    course: 'BCA',
    semester: 3,
    academic_session: '2026-27',
    total_course_fee: 50000,
  };

  const createRes = await apiRequest('/api/students', 'POST', payload1, adminToken);
  console.log(`    Status: ${createRes.status}`);
  console.log(`    Response: ${JSON.stringify(createRes.body, null, 2)}`);

  if (createRes.status !== 201 || !createRes.body.success || !createRes.body.data?.student) {
    throw new Error(`Failed to create student: ${JSON.stringify(createRes.body)}`);
  }

  const createdStudent = createRes.body.data.student;
  const studentId = createdStudent.student_id;
  console.log(`    ✓ Created Student ID: ${studentId}\n`);

  // Operation 2: Fetch the created student and verify student_id and enrollment_number
  console.log(`--> Operation 2: Fetching created student (${studentId})...`);
  const fetchRes = await apiRequest(`/api/students/${studentId}`, 'GET', undefined, adminToken);
  console.log(`    Status: ${fetchRes.status}`);
  console.log(`    Response: ${JSON.stringify(fetchRes.body, null, 2)}`);

  if (fetchRes.status !== 200 || !fetchRes.body.success) {
    throw new Error(`Failed to fetch student: ${JSON.stringify(fetchRes.body)}`);
  }

  const fetchedStudent = fetchRes.body.data;
  if (fetchedStudent.student_id !== studentId) {
    throw new Error(`student_id mismatch: expected ${studentId}, got ${fetchedStudent.student_id}`);
  }
  if (fetchedStudent.enrollment_number !== 'GIIT-API-TEST-2026-001') {
    throw new Error(`enrollment_number mismatch: expected GIIT-API-TEST-2026-001, got ${fetchedStudent.enrollment_number}`);
  }
  console.log(`    ✓ Verified: student_id=${fetchedStudent.student_id}, enrollment_number=${fetchedStudent.enrollment_number}\n`);

  // Operation 3: Attempt to create another student with the SAME enrollment_number
  console.log('--> Operation 3: Attempting to create duplicate student with same enrollment_number...');
  const duplicatePayload = {
    enrollment_number: 'GIIT-API-TEST-2026-001',
    student_name: 'Duplicate Student Attempt',
    course: 'MCA',
    semester: 1,
    academic_session: '2026-27',
    total_course_fee: 60000,
  };

  const duplicateRes = await apiRequest('/api/students', 'POST', duplicatePayload, adminToken);
  console.log(`    Status: ${duplicateRes.status}`);
  console.log(`    Response: ${JSON.stringify(duplicateRes.body, null, 2)}`);

  if (duplicateRes.status !== 409 && duplicateRes.status !== 400) {
    throw new Error(`Expected 409 Conflict or 400 for duplicate enrollment, received: ${duplicateRes.status}`);
  }
  console.log(`    ✓ Confirmed: Backend rejected duplicate enrollment_number with status ${duplicateRes.status} (${duplicateRes.body.message || duplicateRes.body.error})\n`);

  // Operation 4: Update the temporary student's name
  console.log(`--> Operation 4: Updating temporary student's name (${studentId})...`);
  const updatePayload = {
    student_name: 'GIIT API Test Student (Updated)',
  };

  const updateRes = await apiRequest(`/api/students/${studentId}`, 'PUT', updatePayload, adminToken);
  console.log(`    Status: ${updateRes.status}`);
  console.log(`    Response: ${JSON.stringify(updateRes.body, null, 2)}`);

  if (updateRes.status !== 200 || !updateRes.body.success) {
    throw new Error(`Failed to update student: ${JSON.stringify(updateRes.body)}`);
  }
  console.log(`    ✓ Student name updated to: ${updateRes.body.data?.student_name}\n`);

  // Operation 5: Fetch the student again and verify the update
  console.log(`--> Operation 5: Fetching student again to verify update (${studentId})...`);
  const fetchAgainRes = await apiRequest(`/api/students/${studentId}`, 'GET', undefined, adminToken);
  console.log(`    Status: ${fetchAgainRes.status}`);
  console.log(`    Response: ${JSON.stringify(fetchAgainRes.body, null, 2)}`);

  if (fetchAgainRes.status !== 200 || !fetchAgainRes.body.success) {
    throw new Error(`Failed to re-fetch student: ${JSON.stringify(fetchAgainRes.body)}`);
  }

  const updatedStudent = fetchAgainRes.body.data;
  if (updatedStudent.student_name !== 'GIIT API Test Student (Updated)') {
    throw new Error(`Updated name mismatch: expected "GIIT API Test Student (Updated)", got "${updatedStudent.student_name}"`);
  }
  console.log(`    ✓ Verified: student_name is correctly updated to "${updatedStudent.student_name}"\n`);

  // Operation 6: Delete the temporary student
  console.log(`--> Operation 6: Deleting temporary student (${studentId})...`);
  const deleteRes = await apiRequest(`/api/students/${studentId}`, 'DELETE', undefined, adminToken);
  console.log(`    Status: ${deleteRes.status}`);
  console.log(`    Response: ${JSON.stringify(deleteRes.body, null, 2)}`);

  if (deleteRes.status !== 200 || !deleteRes.body.success) {
    throw new Error(`Failed to delete student: ${JSON.stringify(deleteRes.body)}`);
  }
  console.log(`    ✓ Student ${studentId} deleted successfully.\n`);

  // Operation 7: Confirm that the deleted student can no longer be fetched
  console.log(`--> Operation 7: Confirming deleted student can no longer be fetched (${studentId})...`);
  const fetchDeletedRes = await apiRequest(`/api/students/${studentId}`, 'GET', undefined, adminToken);
  console.log(`    Status: ${fetchDeletedRes.status}`);
  console.log(`    Response: ${JSON.stringify(fetchDeletedRes.body, null, 2)}`);

  if (fetchDeletedRes.status !== 404) {
    throw new Error(`Expected status 404 for deleted student, received ${fetchDeletedRes.status}`);
  }
  console.log(`    ✓ Confirmed: Deleted student returns 404 Not Found (${fetchDeletedRes.body.message || fetchDeletedRes.body.error}).\n`);

  console.log('============================================================');
  console.log('ALL 7 STUDENT CRUD OPERATIONS COMPLETED & VERIFIED 100%');
  console.log('============================================================');
}

runStudentCrudTest().catch((err) => {
  console.error('\n❌ TEST FAILED WITH ERROR:', err);
  process.exit(1);
});
