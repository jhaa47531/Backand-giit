import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import { config } from '../config/env';
import { AuthTokenPayload, UserRole } from '../types';

export class AuthService {
  public static async login(
    username: string,
    passwordPlain: string
  ): Promise<{
    token: string;
    user: {
      user_id: string;
      username: string;
      role: UserRole;
      student_id: string | null;
    };
  }> {
    if (!username || !passwordPlain) {
      throw new Error('Username and password are required');
    }

    const user = UserRepository.findByUsername(username.trim());
    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.is_active) {
      throw new Error('This user account has been deactivated');
    }

    const isMatch = bcrypt.compareSync(passwordPlain, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const payload: AuthTokenPayload = {
      user_id: user.user_id,
      username: user.username,
      role: user.role,
      student_id: user.student_id,
    };

    const token = jwt.sign(payload, config.JWT_SECRET, {
      expiresIn: '24h',
    });

    return {
      token,
      user: {
        user_id: user.user_id,
        username: user.username,
        role: user.role,
        student_id: user.student_id,
      },
    };
  }

  public static verifyToken(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, config.JWT_SECRET) as AuthTokenPayload;
      return decoded;
    } catch {
      throw new Error('Invalid or expired authentication token');
    }
  }

  public static changePassword(userId: string, currentPasswordPlain: string, newPasswordPlain: string): void {
    const user = UserRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = bcrypt.compareSync(currentPasswordPlain, user.password_hash);
    if (!isMatch) {
      throw new Error('Current password is incorrect');
    }

    if (!newPasswordPlain || newPasswordPlain.length < 6) {
      throw new Error('New password must be at least 6 characters in length');
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(newPasswordPlain, salt);
    UserRepository.updatePassword(userId, newHash);
  }
}
