import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { BaseModel } from './BaseModel';
import { ValidationError } from '../utils/errors';

export type LicenseType = 'trial' | 'subscription' | 'lifetime';
export type LicenseStatus = 'active' | 'expired' | 'revoked';

export interface License {
  id: string;
  license_key: string;
  type: LicenseType;
  status: LicenseStatus;
  user_id?: string;
  max_devices: number;
  activated_devices: number;
  valid_from: Date;
  valid_until?: Date;
  created_at: Date;
  updated_at: Date;
  revoked_at?: Date;
}

export interface CreateLicenseInput {
  type: LicenseType;
  max_devices?: number;
  valid_until?: Date;
}

export interface UpdateLicenseInput {
  status?: LicenseStatus;
  user_id?: string;
  max_devices?: number;
  valid_until?: Date;
  revoked_at?: Date;
}

export class LicenseModel extends BaseModel {
  constructor(pool: Pool) {
    super(pool);
  }

  private generateLicenseKey(): string {
    // Generate a license key in format: XXXX-XXXX-XXXX-XXXX
    const segments = Array(4)
      .fill(0)
      .map(() => Math.random().toString(36).substring(2, 6).toUpperCase());
    return segments.join('-');
  }

  async create(input: CreateLicenseInput): Promise<License> {
    const id = uuidv4();
    const license_key = this.generateLicenseKey();

    const query = `
            INSERT INTO licenses (
                id, license_key, type, max_devices, valid_until
            ) VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;

    const values = [
      id,
      license_key,
      input.type,
      input.max_devices || 1,
      input.valid_until,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findByLicenseKey(license_key: string): Promise<License | null> {
    const query = `
            SELECT * FROM licenses
            WHERE license_key = $1
        `;

    const result = await this.pool.query(query, [license_key]);
    return result.rows[0] || null;
  }

  async findById(id: string): Promise<License | null> {
    const query = `
            SELECT * FROM licenses
            WHERE id = $1
        `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByUserId(user_id: string): Promise<License[]> {
    const query = `
            SELECT * FROM licenses
            WHERE user_id = $1
            ORDER BY created_at DESC
        `;

    const result = await this.pool.query(query, [user_id]);
    return result.rows;
  }

  async update(id: string, input: UpdateLicenseInput): Promise<License> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(input.status);
      paramCount++;
    }

    if (input.user_id !== undefined) {
      updates.push(`user_id = $${paramCount}`);
      values.push(input.user_id);
      paramCount++;
    }

    if (input.max_devices !== undefined) {
      updates.push(`max_devices = $${paramCount}`);
      values.push(input.max_devices);
      paramCount++;
    }

    if (input.valid_until !== undefined) {
      updates.push(`valid_until = $${paramCount}`);
      values.push(input.valid_until);
      paramCount++;
    }

    if (input.revoked_at !== undefined) {
      updates.push(`revoked_at = $${paramCount}`);
      values.push(input.revoked_at);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new ValidationError('No valid updates provided');
    }

    values.push(id);
    const query = `
            UPDATE licenses
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;

    const result = await this.pool.query(query, values);
    if (result.rows.length === 0) {
      throw new ValidationError('License not found');
    }

    return result.rows[0];
  }

  async incrementActivatedDevices(id: string): Promise<License> {
    const query = `
            UPDATE licenses
            SET activated_devices = activated_devices + 1
            WHERE id = $1 AND activated_devices < max_devices
            RETURNING *
        `;

    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) {
      throw new ValidationError('License not found or device limit reached');
    }

    return result.rows[0];
  }

  async decrementActivatedDevices(id: string): Promise<License> {
    const query = `
            UPDATE licenses
            SET activated_devices = GREATEST(activated_devices - 1, 0)
            WHERE id = $1
            RETURNING *
        `;

    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) {
      throw new ValidationError('License not found');
    }

    return result.rows[0];
  }

  async revoke(id: string): Promise<License> {
    const query = `
            UPDATE licenses
            SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND status != 'revoked'
            RETURNING *
        `;

    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) {
      throw new ValidationError('License not found or already revoked');
    }

    return result.rows[0];
  }

  async isLicenseValid(license: License): Promise<boolean> {
    if (license.status !== 'active') {
      return false;
    }

    if (license.valid_until && new Date(license.valid_until) < new Date()) {
      return false;
    }

    return true;
  }

  async canActivateDevice(license: License): Promise<boolean> {
    return license.activated_devices < license.max_devices;
  }
}
