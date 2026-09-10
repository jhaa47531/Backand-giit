-- ============================================================
-- GIIT FEE MANAGEMENT DATABASE SCHEMA
-- Relational ANSI/Oracle/SQLite SQL Compatible
-- ============================================================

-- Table 1: Master Record of Every Student
CREATE TABLE IF NOT EXISTS students (
  student_id VARCHAR(50) PRIMARY KEY,
  enrollment_number VARCHAR(50) UNIQUE NOT NULL,
  student_name VARCHAR(100) NOT NULL,
  father_name VARCHAR(100),
  mother_name VARCHAR(100),
  course VARCHAR(100) NOT NULL,
  semester INTEGER NOT NULL CHECK (semester >= 1 AND semester <= 12),
  academic_session VARCHAR(50) NOT NULL,
  mobile VARCHAR(20) NOT NULL,
  email VARCHAR(100),
  date_of_birth VARCHAR(20),
  address TEXT,
  admission_date VARCHAR(20) NOT NULL,
  total_course_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
  status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE', 'PASSOUT', 'SUSPENDED')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Table 2: Fee Obligations & Demands
CREATE TABLE IF NOT EXISTS fees (
  fee_id VARCHAR(50) PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  academic_session VARCHAR(50) NOT NULL,
  course VARCHAR(100) NOT NULL,
  semester INTEGER NOT NULL,
  fee_type VARCHAR(50) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  due_date VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- Table 3: Verified Payment Transactions
CREATE TABLE IF NOT EXISTS payments (
  payment_id VARCHAR(50) PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  fee_id VARCHAR(50),
  receipt_number VARCHAR(50) UNIQUE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  razorpay_order_id VARCHAR(100) NOT NULL,
  razorpay_payment_id VARCHAR(100) UNIQUE NOT NULL,
  razorpay_signature VARCHAR(255) NOT NULL,
  payment_status VARCHAR(30) NOT NULL DEFAULT 'SUCCESS' CHECK (payment_status IN ('SUCCESS', 'REFUNDED', 'FAILED', 'PENDING')),
  payment_method VARCHAR(50) DEFAULT 'ONLINE',
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE RESTRICT,
  FOREIGN KEY (fee_id) REFERENCES fees(fee_id) ON DELETE SET NULL
);

-- Table 4: Razorpay Orders Initiated on Server
CREATE TABLE IF NOT EXISTS payment_orders (
  order_id VARCHAR(100) PRIMARY KEY,
  student_id VARCHAR(50) NOT NULL,
  fee_id VARCHAR(50),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
  currency VARCHAR(10) NOT NULL DEFAULT 'INR',
  status VARCHAR(30) NOT NULL DEFAULT 'CREATED' CHECK (status IN ('CREATED', 'PAID', 'EXPIRED', 'FAILED')),
  receipt VARCHAR(50) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE,
  FOREIGN KEY (fee_id) REFERENCES fees(fee_id) ON DELETE SET NULL
);

-- Table 5: Users & Authentication (Admin & Student logins)
CREATE TABLE IF NOT EXISTS users (
  user_id VARCHAR(50) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('ADMIN', 'STUDENT')),
  student_id VARCHAR(50),
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (student_id) REFERENCES students(student_id) ON DELETE CASCADE
);

-- Table 6: Sequence Generator for Atomic IDs
CREATE TABLE IF NOT EXISTS sequences (
  name VARCHAR(50) PRIMARY KEY,
  next_val INTEGER NOT NULL DEFAULT 1
);

-- Indexes for Fast Lookups and Strict Uniqueness
CREATE INDEX IF NOT EXISTS idx_students_enrollment ON students(enrollment_number);
CREATE INDEX IF NOT EXISTS idx_students_mobile ON students(mobile);
CREATE INDEX IF NOT EXISTS idx_students_course ON students(course);
CREATE INDEX IF NOT EXISTS idx_fees_student ON fees(student_id);
CREATE INDEX IF NOT EXISTS idx_fees_status ON fees(status);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments(student_id);
CREATE INDEX IF NOT EXISTS idx_payments_fee ON payments(fee_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_order ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_razorpay_payment ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_student ON payment_orders(student_id);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
