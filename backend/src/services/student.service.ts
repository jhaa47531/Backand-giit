import { StudentRepository } from '../repositories/student.repository';
import { FeeRepository } from '../repositories/fee.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { UserRepository } from '../repositories/user.repository';
import { Student, StudentFeeSummary } from '../types';
import { generateStudentId, generateUserId } from '../utils/id_generator';
import bcrypt from 'bcryptjs';

export interface CreateStudentDTO {
  enrollment_number: string;
  student_name: string;
  father_name?: string;
  mother_name?: string;
  course: string;
  semester: number;
  academic_session: string;
  mobile: string;
  email?: string;
  date_of_birth?: string;
  address?: string;
  admission_date?: string;
  total_course_fee?: number;
  initial_password?: string;
}

export interface UpdateStudentDTO {
  student_name?: string;
  father_name?: string;
  mother_name?: string;
  course?: string;
  semester?: number;
  academic_session?: string;
  mobile?: string;
  email?: string;
  date_of_birth?: string;
  address?: string;
  admission_date?: string;
  total_course_fee?: number;
  status?: 'ACTIVE' | 'INACTIVE' | 'PASSOUT' | 'SUSPENDED';
}

export class StudentService {
  /**
   * Creates a new student record.
   * GUARANTEE: Every student receives an independent unique student_id.
   * Two students with identical names will NEVER be merged.
   */
  public static createStudent(data: CreateStudentDTO): { student: Student; tempPassword?: string } {
    const existingEnrollment = StudentRepository.findByEnrollment(data.enrollment_number.trim());
    if (existingEnrollment) {
      throw new Error(`A student with enrollment number '${data.enrollment_number}' already exists`);
    }

    const seq = StudentRepository.getNextSequence();
    const studentId = generateStudentId(seq);

    const now = new Date().toISOString().split('T')[0];
    const newStudent: Student = {
      student_id: studentId,
      enrollment_number: data.enrollment_number.trim(),
      student_name: data.student_name.trim(),
      father_name: data.father_name?.trim() || null,
      mother_name: data.mother_name?.trim() || null,
      course: data.course.trim(),
      semester: data.semester,
      academic_session: data.academic_session.trim(),
      mobile: data.mobile.trim(),
      email: data.email?.trim() || null,
      date_of_birth: data.date_of_birth?.trim() || null,
      address: data.address?.trim() || null,
      admission_date: data.admission_date?.trim() || now,
      total_course_fee: Number(data.total_course_fee) || 0,
      status: 'ACTIVE',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const student = StudentRepository.create(newStudent);

    // Create student login credentials
    const password = data.initial_password || `${data.enrollment_number}@giit`;
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    UserRepository.create({
      user_id: generateUserId(),
      username: data.enrollment_number.trim(),
      password_hash: passwordHash,
      role: 'STUDENT',
      student_id: student.student_id,
    });

    return { student, tempPassword: password };
  }

  public static getStudentById(studentId: string): Student {
    const student = StudentRepository.findById(studentId);
    if (!student) {
      throw new Error(`Student not found with ID '${studentId}'`);
    }
    return student;
  }

  public static getStudentByEnrollment(enrollmentNumber: string): Student {
    const student = StudentRepository.findByEnrollment(enrollmentNumber.trim());
    if (!student) {
      throw new Error(`Student not found with enrollment number '${enrollmentNumber}'`);
    }
    return student;
  }

  public static getAllStudents(filter?: { status?: any; course?: string }): Student[] {
    return StudentRepository.findAll(filter);
  }

  /**
   * Updates an existing student.
   * GUARANTEE: Only the specified student_id is modified. Other students remain intact.
   */
  public static updateStudent(studentId: string, data: UpdateStudentDTO): Student {
    const existing = StudentRepository.findById(studentId);
    if (!existing) {
      throw new Error(`Student not found with ID '${studentId}'`);
    }

    const updated = StudentRepository.update(studentId, data);
    if (!updated) {
      throw new Error(`Failed to update student with ID '${studentId}'`);
    }
    return updated;
  }

  public static deleteStudent(studentId: string): boolean {
    const existing = StudentRepository.findById(studentId);
    if (!existing) {
      throw new Error(`Student not found with ID '${studentId}'`);
    }
    return StudentRepository.delete(studentId);
  }

  public static searchStudents(term: string): Student[] {
    if (!term || term.trim() === '') {
      return StudentRepository.findAll();
    }
    return StudentRepository.search(term);
  }

  /**
   * Computes complete, real-time fee summary for a student based purely on backend database records.
   */
  public static getStudentFeeSummary(studentId: string): StudentFeeSummary {
    const student = this.getStudentById(studentId);
    const feeRecords = FeeRepository.findByStudent(studentId);
    const recentPayments = PaymentRepository.findByStudent(studentId);

    // Sum all fee obligations
    const totalFeeFromRecords = feeRecords.reduce((acc, f) => acc + Number(f.amount), 0);
    // Use the higher of total_course_fee or total allocated fees
    const total_fee = Math.max(Number(student.total_course_fee), totalFeeFromRecords);

    // Sum all verified payments
    const total_paid = PaymentRepository.getTotalPaidByStudent(studentId);

    // Real due amount
    const total_due = Math.max(0, total_fee - total_paid);

    return {
      student,
      total_fee,
      total_paid,
      total_due,
      fee_records: feeRecords,
      recent_payments: recentPayments,
    };
  }
}
