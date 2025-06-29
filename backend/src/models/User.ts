import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { BaseModel } from './BaseModel';
import { ValidationError } from '../utils/errors';
import { Schema } from 'mongoose';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  email_verified: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date;
  onboardingCompleted: boolean;
  onboardingSkipped: boolean;
  onboardingStep: number;
  completedOnboardingSteps: string[];
}

export interface CreateUserInput {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface UpdateUserInput {
  email?: string;
  password?: string;
  first_name?: string;
  last_name?: string;
  is_active?: boolean;
  email_verified?: boolean;
}

const userSchema = new Schema<User>(
  {
    id: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
    },
    password_hash: {
      type: String,
      required: true,
    },
    first_name: {
      type: String,
    },
    last_name: {
      type: String,
    },
    is_active: {
      type: Boolean,
      required: true,
    },
    email_verified: {
      type: Boolean,
      required: true,
    },
    last_login_at: {
      type: Date,
    },
    onboardingCompleted: {
      type: Boolean,
      default: false,
    },
    onboardingSkipped: {
      type: Boolean,
      default: false,
    },
    onboardingStep: {
      type: Number,
      default: 0,
    },
    completedOnboardingSteps: [
      {
        type: String,
      },
    ],
  },
  {
    timestamps: true,
  },
);

export class UserModel extends BaseModel {
  constructor(pool: Pool) {
    super(pool);
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    return bcrypt.hash(password, saltRounds);
  }

  private async validatePassword(
    password: string,
    hash: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  private validateEmail(email: string): boolean {
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    return emailRegex.test(email);
  }

  async create(input: CreateUserInput): Promise<User> {
    if (!this.validateEmail(input.email)) {
      throw new ValidationError('Invalid email format');
    }

    const password_hash = await this.hashPassword(input.password);
    const id = uuidv4();

    const query = `
            INSERT INTO users (
                id, email, password_hash, first_name, last_name
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

    const values = [
      id,
      input.email.toLowerCase(),
      password_hash,
      input.first_name,
      input.last_name,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = `
            SELECT * FROM users
            WHERE email = $1 AND deleted_at IS NULL
        `;

    const result = await this.pool.query(query, [email.toLowerCase()]);
    return result.rows[0] || null;
  }

  async findById(id: string): Promise<User | null> {
    const query = `
            SELECT * FROM users
            WHERE id = $1 AND deleted_at IS NULL
        `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async update(id: string, input: UpdateUserInput): Promise<User> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.email !== undefined) {
      if (!this.validateEmail(input.email)) {
        throw new ValidationError('Invalid email format');
      }
      updates.push(`email = $${paramCount}`);
      values.push(input.email.toLowerCase());
      paramCount++;
    }

    if (input.password !== undefined) {
      const password_hash = await this.hashPassword(input.password);
      updates.push(`password_hash = $${paramCount}`);
      values.push(password_hash);
      paramCount++;
    }

    if (input.first_name !== undefined) {
      updates.push(`first_name = $${paramCount}`);
      values.push(input.first_name);
      paramCount++;
    }

    if (input.last_name !== undefined) {
      updates.push(`last_name = $${paramCount}`);
      values.push(input.last_name);
      paramCount++;
    }

    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(input.is_active);
      paramCount++;
    }

    if (input.email_verified !== undefined) {
      updates.push(`email_verified = $${paramCount}`);
      values.push(input.email_verified);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new ValidationError('No valid updates provided');
    }

    values.push(id);
    const query = `
            UPDATE users
            SET ${updates.join(', ')}
            WHERE id = $${paramCount} AND deleted_at IS NULL
            RETURNING *
        `;

    const result = await this.pool.query(query, values);
    if (result.rows.length === 0) {
      throw new ValidationError('User not found');
    }

    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    const query = `
            UPDATE users
            SET deleted_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND deleted_at IS NULL
        `;

    const result = await this.pool.query(query, [id]);
    if (result.rowCount === 0) {
      throw new ValidationError('User not found');
    }
  }

  async updateLastLogin(id: string): Promise<void> {
    const query = `
            UPDATE users
            SET last_login_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND deleted_at IS NULL
        `;

    await this.pool.query(query, [id]);
  }

  async verifyPassword(email: string, password: string): Promise<User | null> {
    const user = await this.findByEmail(email);
    if (!user) {
      return null;
    }

    const isValid = await this.validatePassword(password, user.password_hash);
    return isValid ? user : null;
  }

  async isEmailAvailable(email: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    return user === null;
  }
}
