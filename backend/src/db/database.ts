import fs from 'fs';
import path from 'path';
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import bcrypt from 'bcryptjs';
import { config } from '../config/env';

let dbInstance: SqlJsDatabase | null = null;
let isInitializing = false;

export class Database {
  private static db: SqlJsDatabase;

  public static async getDb(): Promise<SqlJsDatabase> {
    if (this.db) {
      return this.db;
    }
    if (dbInstance) {
      this.db = dbInstance;
      return this.db;
    }
    await this.init();
    return this.db;
  }

  public static async init(customDbPath?: string): Promise<SqlJsDatabase> {
    if (this.db) return this.db;

    const SQL = await initSqlJs();
    const dbFilePath = customDbPath || config.DATABASE_FILE;
    const dbDir = path.dirname(dbFilePath);

    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    if (fs.existsSync(dbFilePath)) {
      const fileBuffer = fs.readFileSync(dbFilePath);
      this.db = new SQL.Database(fileBuffer);
    } else {
      this.db = new SQL.Database();
    }

    dbInstance = this.db;

    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON;');

    // Apply schema
    const schemaPath = path.resolve(process.cwd(), 'backend', 'database', 'schema', 'schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      this.db.run(schemaSql);
    }

    // Initialize sequences if not present
    this.run(`
      INSERT OR IGNORE INTO sequences (name, next_val) VALUES ('student_id', 1);
      INSERT OR IGNORE INTO sequences (name, next_val) VALUES ('fee_id', 1);
      INSERT OR IGNORE INTO sequences (name, next_val) VALUES ('payment_id', 1);
      INSERT OR IGNORE INTO sequences (name, next_val) VALUES ('receipt_number', 1);
    `);

    // Ensure default admin user exists
    const adminCheck = this.query<{ count: number }>(
      "SELECT COUNT(*) as count FROM users WHERE role = 'ADMIN'"
    );
    if (!adminCheck || adminCheck.length === 0 || adminCheck[0].count === 0) {
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync('Admin@GIIT2026', salt);
      this.run(
        `INSERT INTO users (user_id, username, password_hash, role, student_id, is_active)
         VALUES (?, ?, ?, ?, NULL, 1)`,
        ['USR_ADMIN01', 'admin@giit.ac.in', passwordHash, 'ADMIN']
      );
    }

    this.persist(customDbPath);
    return this.db;
  }

  public static persist(customDbPath?: string): void {
    if (!this.db) return;
    try {
      const dbFilePath = customDbPath || config.DATABASE_FILE;
      const data = this.db.export();
      const buffer = Buffer.from(data);
      const dir = path.dirname(dbFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(dbFilePath, buffer);
    } catch (err) {
      console.error('Failed to persist database to disk:', err);
    }
  }

  public static query<T = any>(sql: string, params: any[] = []): T[] {
    if (!this.db) throw new Error('Database not initialized. Call Database.init() first.');
    const stmt = this.db.prepare(sql);
    try {
      if (params.length > 0) {
        stmt.bind(params);
      }
      const results: T[] = [];
      while (stmt.step()) {
        results.push(stmt.getAsObject() as unknown as T);
      }
      return results;
    } finally {
      stmt.free();
    }
  }

  public static queryOne<T = any>(sql: string, params: any[] = []): T | null {
    const results = this.query<T>(sql, params);
    return results.length > 0 ? results[0] : null;
  }

  private static transactionDepth = 0;

  public static run(sql: string, params: any[] = []): void {
    if (!this.db) throw new Error('Database not initialized. Call Database.init() first.');
    if (params.length === 0) {
      this.db.run(sql);
    } else {
      this.db.run(sql, params);
    }
    if (this.transactionDepth === 0) {
      this.persist();
    }
  }

  /**
   * Atomically executes callback inside a transaction.
   * Supports nested transactions via SQLite SAVEPOINTS.
   * If any error is thrown, the entire operation is rolled back.
   */
  public static transaction<T>(callback: () => T): T {
    if (!this.db) throw new Error('Database not initialized.');
    
    const depth = this.transactionDepth++;
    const savepoint = `sp_${depth}`;

    if (depth === 0) {
      this.db.run('BEGIN TRANSACTION;');
    } else {
      this.db.run(`SAVEPOINT ${savepoint};`);
    }

    try {
      const result = callback();
      if (depth === 0) {
        this.db.run('COMMIT;');
        this.persist();
      } else {
        this.db.run(`RELEASE SAVEPOINT ${savepoint};`);
      }
      this.transactionDepth--;
      return result;
    } catch (error) {
      if (depth === 0) {
        try {
          this.db.run('ROLLBACK;');
        } catch (rollbackErr) {
          console.error('Rollback error:', rollbackErr);
        }
      } else {
        try {
          this.db.run(`ROLLBACK TO SAVEPOINT ${savepoint};`);
        } catch (rollbackErr) {
          console.error('Rollback error:', rollbackErr);
        }
      }
      this.transactionDepth--;
      throw error;
    }
  }

  /**
   * Gets next sequential integer for atomic identifier generation
   */
  public static getNextSequence(seqName: string): number {
    return this.transaction(() => {
      const row = this.queryOne<{ next_val: number }>(
        'SELECT next_val FROM sequences WHERE name = ?',
        [seqName]
      );
      if (!row) {
        this.run('INSERT INTO sequences (name, next_val) VALUES (?, 2)', [seqName]);
        return 1;
      }
      const currentVal = row.next_val;
      this.run('UPDATE sequences SET next_val = ? WHERE name = ?', [currentVal + 1, seqName]);
      return currentVal;
    });
  }

  public static close(): void {
    if (this.db) {
      this.persist();
      this.db.close();
      dbInstance = null;
      (this as any).db = null;
    }
  }
}
