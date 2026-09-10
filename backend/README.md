# GIIT Fee Management — Production-Ready Backend

**Global Institute of Information & Technology (GIIT)**  
**Campus Portal — Fee Management & Online Payment Engine**

---

## 1. System Architecture

The GIIT Fee Management backend is engineered with a strict **layered relational architecture**, isolating business logic from low-level storage engines via a **Repository Pattern**.

```
HTTP Client / Frontend
        │
        ▼ (JSON over HTTPS)
Express REST API Controllers & Middleware
  ├── JWT Authentication (`authenticateJWT`)
  ├── Role-Based Access Control (`requireRole('ADMIN')`)
  ├── Student Authorization Guard (`enforceStudentAccess`)
  └── Zod Input Validation (`validateBody`)
        │
        ▼
Service Layer (Domain Logic)
  ├── StudentService (Guaranteed unique student_id, name isolation)
  ├── FeeService (Due/Paid computation, status transitions)
  ├── PaymentService (Razorpay HMAC-SHA256 signature verification & idempotency)
  ├── ReceiptService (Official GIIT tamper-evident receipts)
  └── DashboardService (Live SQL-aggregated institutional metrics)
        │
        ▼
Repository Layer (Data Access Abstraction)
  ├── StudentRepository
  ├── FeeRepository
  ├── PaymentRepository
  └── UserRepository
        │
        ▼
Relational SQL Engine (`sql.js` / ANSI SQL / Oracle SQL Compatible)
  ├── ACID Transactions with Savepoints
  ├── Atomic Sequence Generators
  └── Foreign Keys, Uniqueness & Check Constraints
```

---

## 2. Critical Student Isolation Strategy

### The Bug Solved:
In prior revisions, students sharing identical names (e.g. two students named "Rahul Sharma") were erroneously merged, or editing one student overwrote another.

### Backend Guarantees:
1. **Never use `student_name` as a primary key or unique constraint.**
2. **Every student is assigned an independent, sequential identifier** (e.g., `STU000001`, `STU000002`).
3. **`enrollment_number` is strictly UNIQUE and indexed.**
4. **Multiple students can have the exact same name with zero collision.**
5. **Updating `STU000001` only mutates `STU000001`. `STU000002` remains completely untouched.**
6. **Search by name yields multiple discrete student records; never merges them.**

---

## 3. Razorpay Server-Side Payment Architecture

### Security Flow:
1. **Authenticated User/Student** selects outstanding fee or custom amount.
2. **`POST /api/payments/create-order`**:
   - Backend validates the student exists and is active.
   - Backend checks outstanding fee balance.
   - Backend creates an internal order in `payment_orders` with status `CREATED`.
   - Returns order metadata (`order_id`, `amount`, `key_id`) to frontend.
   - **`RAZORPAY_KEY_SECRET` is NEVER returned or exposed to the client.**
3. **Checkout occurs via Razorpay modal**.
4. **`POST /api/payments/verify`**:
   - Client sends `{ razorpay_order_id, razorpay_payment_id, razorpay_signature, student_id }`.
   - **Step A: Duplicate Payment Protection (Idempotency)**: If `razorpay_payment_id` is already in the database, the backend returns the existing payment and receipt immediately with `is_duplicate: true`. Duplicate payments are never inserted.
   - **Step B: Official Signature Verification**: Server computes:
     `HMAC-SHA256(order_id + "|" + payment_id, RAZORPAY_KEY_SECRET)`
     Using timing-safe comparison (`crypto.timingSafeEqual`) to prevent side-channel attacks.
   - **Step C: Database Transaction**:
     - Inserts verified payment into `payments` table with unique `receipt_number`.
     - Marks internal order as `PAID`.
     - Recalculates linked fee status (`PAID` if full, `PARTIAL` if partial).
     - Commits transaction. If anything fails, it rolls back automatically.
   - Returns the official receipt.

---

## 4. Environment Variables

Create `.env` based on `.env.example`:

```env
# Runtime
NODE_ENV=development
PORT=3000
DATABASE_FILE=./data/giit_fee_management.sqlite

# Security & Authentication
JWT_SECRET=giit_production_grade_jwt_secret_key_2026

# Razorpay Credentials (Server-side ONLY)
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_secret_key
```

---

## 5. Local Setup & Running

```bash
# 1. Install dependencies
npm install

# 2. Run automated test suite (Tests 1-17 + Critical Isolation + HTTP Integration)
npm test
npm run test:api

# 3. (Optional) Seed demo students, fees, and payments
npm run seed

# 4. Start the backend development server
npm run dev
```

The backend starts at `http://localhost:3000` with all endpoints under `http://localhost:3000/api`.

Default Admin Credentials:
- **Username**: `admin@giit.ac.in`
- **Password**: `Admin@GIIT2026`

---

## 6. Frontend Integration Contract (API Reference)

### Authentication APIs

#### 1. Login
- **Endpoint**: `POST /api/auth/login`
- **Request**:
  ```json
  {
    "username": "admin@giit.ac.in",
    "password": "Admin@GIIT2026"
  }
  ```
- **Response** (`200 OK`):
  ```json
  {
    "success": true,
    "message": "Login successful",
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIs...",
      "user": {
        "user_id": "USR_ADMIN01",
        "username": "admin@giit.ac.in",
        "role": "ADMIN",
        "student_id": null
      }
    }
  }
  ```

#### 2. Get Current Profile
- **Endpoint**: `GET /api/auth/me`
- **Header**: `Authorization: Bearer <token>`

---

### Student Management APIs

#### 3. Create Student (Admin Only)
- **Endpoint**: `POST /api/students`
- **Header**: `Authorization: Bearer <token>`
- **Request**:
  ```json
  {
    "enrollment_number": "GIIT-2024-BTECH-001",
    "student_name": "Aarav Sharma",
    "father_name": "Rajesh Sharma",
    "mother_name": "Sunita Sharma",
    "course": "B.Tech Computer Science & Engineering",
    "semester": 1,
    "academic_session": "2024-2028",
    "mobile": "9811223344",
    "email": "aarav.sharma@giit.ac.in",
    "total_course_fee": 380000
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "message": "Student record created successfully",
    "data": {
      "student": {
        "student_id": "STU000001",
        "enrollment_number": "GIIT-2024-BTECH-001",
        "student_name": "Aarav Sharma",
        "course": "B.Tech Computer Science & Engineering",
        "semester": 1,
        "academic_session": "2024-2028",
        "mobile": "9811223344",
        "total_course_fee": 380000,
        "status": "ACTIVE"
      },
      "tempPassword": "GIIT-2024-BTECH-001@giit"
    }
  }
  ```

#### 4. List All Students (Admin Only)
- **Endpoint**: `GET /api/students?course=...&status=ACTIVE`

#### 5. Search Students
- **Endpoint**: `GET /api/students/search?q=Rahul`

#### 6. Get Student Details
- **Endpoint**: `GET /api/students/:studentId`

#### 7. Update Student (Admin Only)
- **Endpoint**: `PUT /api/students/:studentId`

#### 8. Student Fee Summary (Real-time computed)
- **Endpoint**: `GET /api/students/:studentId/summary`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "student": { ... },
      "total_fee": 380000,
      "total_paid": 45000,
      "total_due": 335000,
      "fee_records": [ ... ],
      "recent_payments": [ ... ]
    }
  }
  ```

---

### Fee Management APIs

#### 9. Create Fee Obligation
- **Endpoint**: `POST /api/students/:studentId/fees`
- **Request**:
  ```json
  {
    "academic_session": "2024-2025",
    "course": "B.Tech Computer Science & Engineering",
    "semester": 1,
    "fee_type": "Tuition Fee",
    "amount": 45000,
    "due_date": "2026-10-31"
  }
  ```

#### 10. List Fees for Student
- **Endpoint**: `GET /api/students/:studentId/fees`

#### 11. Update Fee
- **Endpoint**: `PUT /api/fees/:feeId`

#### 12. Delete Fee
- **Endpoint**: `DELETE /api/fees/:feeId`

---

### Razorpay Payment APIs

#### 13. Create Payment Order
- **Endpoint**: `POST /api/payments/create-order`
- **Request**:
  ```json
  {
    "student_id": "STU000001",
    "fee_id": "FEE000001",
    "amount": 45000
  }
  ```
- **Response** (`201 Created`):
  ```json
  {
    "success": true,
    "data": {
      "order_id": "order_a7b9c1d2e3f4",
      "amount": 45000,
      "currency": "INR",
      "key_id": "rzp_test_your_key_id",
      "student_id": "STU000001",
      "student_name": "Aarav Sharma"
    }
  }
  ```

#### 14. Verify Payment & Commit Record
- **Endpoint**: `POST /api/payments/verify`
- **Request**:
  ```json
  {
    "razorpay_order_id": "order_a7b9c1d2e3f4",
    "razorpay_payment_id": "pay_live_892341234",
    "razorpay_signature": "6b28f805a81878b668f45a...",
    "student_id": "STU000001",
    "fee_id": "FEE000001"
  }
  ```
- **Response** (`201 Created` or `200 OK` for duplicate):
  ```json
  {
    "success": true,
    "message": "Payment verified and recorded successfully",
    "data": {
      "payment": {
        "payment_id": "PAY000001",
        "student_id": "STU000001",
        "receipt_number": "RCP-2026-00001",
        "amount": 45000,
        "payment_status": "SUCCESS"
      },
      "receipt": {
        "institution_name": "Global Institute of Information & Technology",
        "receipt_number": "RCP-2026-00001",
        "student_id": "STU000001",
        "student_name": "Aarav Sharma",
        "enrollment_number": "GIIT-2024-BTECH-001",
        "course": "B.Tech Computer Science & Engineering",
        "amount_paid": 45000
      },
      "is_duplicate": false
    }
  }
  ```

---

### Receipt APIs

#### 15. Get Receipt by Payment ID
- **Endpoint**: `GET /api/receipts/payment/:paymentId`

#### 16. Get Receipt by Receipt Number
- **Endpoint**: `GET /api/receipts/:receiptNumber`

---

### Dashboard API

#### 17. Get Institutional Statistics (Admin Only)
- **Endpoint**: `GET /api/dashboard/stats`
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "total_students": 250,
      "total_fee": 12500000,
      "total_collected": 8750000,
      "total_due": 3750000,
      "total_pending_fees": 42,
      "recent_payments": [ ... ],
      "recent_students": [ ... ]
    }
  }
  ```

---

## 7. Netlify Deployment Instructions

1. Connect repository to Netlify.
2. Build Settings:
   - **Base directory**: `/`
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Functions directory**: `netlify/functions`
3. Configure Environment Variables in Netlify Dashboard:
   - `JWT_SECRET`: Secure 64-character random string
   - `RAZORPAY_KEY_ID`: Your Razorpay Key ID
   - `RAZORPAY_KEY_SECRET`: Your Razorpay Key Secret
   - `NODE_ENV`: `production`
4. Deploy site. The API endpoints will be served at `/.netlify/functions/api/api/*` and transparently rewritten to `/api/*` via `netlify.toml`.
