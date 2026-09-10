import { Database } from '../db/database';
import { Fee, FeeStatus } from '../types';

export class FeeRepository {
  public static getNextSequence(): number {
    return Database.getNextSequence('fee_id');
  }

  public static create(fee: Fee): Fee {
    Database.run(
      `INSERT INTO fees (
        fee_id, student_id, academic_session, course, semester,
        fee_type, amount, due_date, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        fee.fee_id,
        fee.student_id,
        fee.academic_session,
        fee.course,
        fee.semester,
        fee.fee_type,
        fee.amount,
        fee.due_date,
        fee.status || 'PENDING',
      ]
    );
    return this.findById(fee.fee_id)!;
  }

  public static findById(feeId: string): Fee | null {
    return Database.queryOne<Fee>(
      'SELECT * FROM fees WHERE fee_id = ?',
      [feeId]
    );
  }

  public static findByStudent(studentId: string): Fee[] {
    return Database.query<Fee>(
      'SELECT * FROM fees WHERE student_id = ? ORDER BY due_date ASC, created_at DESC',
      [studentId]
    );
  }

  public static findAll(): Fee[] {
    return Database.query<Fee>('SELECT * FROM fees ORDER BY created_at DESC');
  }

  public static update(feeId: string, data: Partial<Fee>): Fee | null {
    const existing = this.findById(feeId);
    if (!existing) return null;

    const fields: string[] = [];
    const params: any[] = [];

    const allowedFields: (keyof Fee)[] = [
      'academic_session',
      'course',
      'semester',
      'fee_type',
      'amount',
      'due_date',
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
    params.push(feeId);

    const sql = `UPDATE fees SET ${fields.join(', ')} WHERE fee_id = ?`;
    Database.run(sql, params);

    return this.findById(feeId);
  }

  public static delete(feeId: string): boolean {
    const existing = this.findById(feeId);
    if (!existing) return false;

    Database.run('DELETE FROM fees WHERE fee_id = ?', [feeId]);
    return true;
  }

  public static getTotalFeeAmount(): number {
    const res = Database.queryOne<{ total: number }>(
      'SELECT COALESCE(SUM(amount), 0) as total FROM fees'
    );
    return res ? Number(res.total) : 0;
  }

  public static getPendingFeeCount(): number {
    const res = Database.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM fees WHERE status IN ('PENDING', 'PARTIAL', 'OVERDUE')"
    );
    return res ? res.count : 0;
  }
}
