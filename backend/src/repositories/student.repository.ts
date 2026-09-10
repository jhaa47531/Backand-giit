import { Database } from '../db/database';
import { Student, StudentStatus } from '../types';

export class StudentRepository {
  public static getNextSequence(): number {
    return Database.getNextSequence('student_id');
  }

  public static create(student: Student): Student {
    Database.run(
      `INSERT INTO students (
        student_id, enrollment_number, student_name, father_name, mother_name,
        course, semester, academic_session, mobile, email, date_of_birth,
        address, admission_date, total_course_fee, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        student.student_id,
        student.enrollment_number,
        student.student_name,
        student.father_name || null,
        student.mother_name || null,
        student.course,
        student.semester,
        student.academic_session,
        student.mobile,
        student.email || null,
        student.date_of_birth || null,
        student.address || null,
        student.admission_date,
        student.total_course_fee,
        student.status || 'ACTIVE',
      ]
    );
    return this.findById(student.student_id)!;
  }

  public static findById(studentId: string): Student | null {
    return Database.queryOne<Student>(
      'SELECT * FROM students WHERE student_id = ?',
      [studentId]
    );
  }

  public static findByEnrollment(enrollmentNumber: string): Student | null {
    return Database.queryOne<Student>(
      'SELECT * FROM students WHERE enrollment_number = ?',
      [enrollmentNumber]
    );
  }

  public static findAll(filter?: { status?: StudentStatus; course?: string }): Student[] {
    let sql = 'SELECT * FROM students WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      sql += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.course) {
      sql += ' AND course = ?';
      params.push(filter.course);
    }

    sql += ' ORDER BY created_at DESC';
    return Database.query<Student>(sql, params);
  }

  public static update(studentId: string, data: Partial<Student>): Student | null {
    const existing = this.findById(studentId);
    if (!existing) return null;

    const fields: string[] = [];
    const params: any[] = [];

    const allowedFields: (keyof Student)[] = [
      'student_name',
      'father_name',
      'mother_name',
      'course',
      'semester',
      'academic_session',
      'mobile',
      'email',
      'date_of_birth',
      'address',
      'admission_date',
      'total_course_fee',
      'status',
    ];

    for (const field of allowedFields) {
      if (data[field] !== undefined) {
        fields.push(`${field} = ?`);
        params.push(data[field]);
      }
    }

    if (fields.length === 0) return existing;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    params.push(studentId);

    const sql = `UPDATE students SET ${fields.join(', ')} WHERE student_id = ?`;
    Database.run(sql, params);

    return this.findById(studentId);
  }

  public static delete(studentId: string): boolean {
    const existing = this.findById(studentId);
    if (!existing) return false;

    Database.run('DELETE FROM students WHERE student_id = ?', [studentId]);
    return true;
  }

  public static search(term: string): Student[] {
    const cleanTerm = `%${term.trim()}%`;
    return Database.query<Student>(
      `SELECT * FROM students 
       WHERE student_id LIKE ? 
          OR enrollment_number LIKE ? 
          OR student_name LIKE ? 
          OR mobile LIKE ? 
          OR course LIKE ?
       ORDER BY student_id ASC`,
      [cleanTerm, cleanTerm, cleanTerm, cleanTerm, cleanTerm]
    );
  }

  public static count(): number {
    const res = Database.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM students');
    return res ? res.count : 0;
  }
}
