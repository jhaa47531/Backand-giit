import { Database } from '../db/database';
import { User, UserRole } from '../types';

export class UserRepository {
  public static create(user: {
    user_id: string;
    username: string;
    password_hash: string;
    role: UserRole;
    student_id?: string | null;
  }): User {
    Database.run(
      `INSERT INTO users (
        user_id, username, password_hash, role, student_id, is_active, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        user.user_id,
        user.username.trim().toLowerCase(),
        user.password_hash,
        user.role,
        user.student_id || null,
      ]
    );
    return this.findById(user.user_id)!;
  }

  public static findById(userId: string): User | null {
    return Database.queryOne<User>(
      'SELECT * FROM users WHERE user_id = ?',
      [userId]
    );
  }

  public static findByUsername(username: string): User | null {
    return Database.queryOne<User>(
      'SELECT * FROM users WHERE LOWER(username) = ?',
      [username.trim().toLowerCase()]
    );
  }

  public static findByStudentId(studentId: string): User | null {
    return Database.queryOne<User>(
      'SELECT * FROM users WHERE student_id = ?',
      [studentId]
    );
  }

  public static updatePassword(userId: string, newPasswordHash: string): void {
    Database.run(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?',
      [newPasswordHash, userId]
    );
  }
}
