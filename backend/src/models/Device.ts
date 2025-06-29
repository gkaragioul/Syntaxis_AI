import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { BaseModel } from './BaseModel';
import { ValidationError } from '../utils/errors';

export interface Device {
  id: string;
  license_id: string;
  user_id: string;
  device_fingerprint: string;
  device_name?: string;
  device_type?: string;
  browser_info?: Record<string, any>;
  ip_address?: string;
  is_active: boolean;
  last_active_at?: Date;
  activated_at: Date;
  deactivated_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface CreateDeviceInput {
  license_id: string;
  user_id: string;
  device_fingerprint: string;
  device_name?: string;
  device_type?: string;
  browser_info?: Record<string, any>;
  ip_address?: string;
}

export interface UpdateDeviceInput {
  device_name?: string;
  device_type?: string;
  browser_info?: Record<string, any>;
  ip_address?: string;
  is_active?: boolean;
  last_active_at?: Date;
  deactivated_at?: Date;
}

export class DeviceModel extends BaseModel {
  constructor(pool: Pool) {
    super(pool);
  }

  async create(input: CreateDeviceInput): Promise<Device> {
    const id = uuidv4();

    const query = `
            INSERT INTO devices (
                id, license_id, user_id, device_fingerprint,
                device_name, device_type, browser_info, ip_address
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `;

    const values = [
      id,
      input.license_id,
      input.user_id,
      input.device_fingerprint,
      input.device_name,
      input.device_type,
      input.browser_info ? JSON.stringify(input.browser_info) : null,
      input.ip_address,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async findById(id: string): Promise<Device | null> {
    const query = `
            SELECT * FROM devices
            WHERE id = $1
        `;

    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByFingerprint(device_fingerprint: string): Promise<Device | null> {
    const query = `
            SELECT * FROM devices
            WHERE device_fingerprint = $1 AND is_active = true
        `;

    const result = await this.pool.query(query, [device_fingerprint]);
    return result.rows[0] || null;
  }

  async findByLicenseId(license_id: string): Promise<Device[]> {
    const query = `
            SELECT * FROM devices
            WHERE license_id = $1
            ORDER BY created_at DESC
        `;

    const result = await this.pool.query(query, [license_id]);
    return result.rows;
  }

  async findByUserId(user_id: string): Promise<Device[]> {
    const query = `
            SELECT * FROM devices
            WHERE user_id = $1
            ORDER BY created_at DESC
        `;

    const result = await this.pool.query(query, [user_id]);
    return result.rows;
  }

  async update(id: string, input: UpdateDeviceInput): Promise<Device> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (input.device_name !== undefined) {
      updates.push(`device_name = $${paramCount}`);
      values.push(input.device_name);
      paramCount++;
    }

    if (input.device_type !== undefined) {
      updates.push(`device_type = $${paramCount}`);
      values.push(input.device_type);
      paramCount++;
    }

    if (input.browser_info !== undefined) {
      updates.push(`browser_info = $${paramCount}`);
      values.push(JSON.stringify(input.browser_info));
      paramCount++;
    }

    if (input.ip_address !== undefined) {
      updates.push(`ip_address = $${paramCount}`);
      values.push(input.ip_address);
      paramCount++;
    }

    if (input.is_active !== undefined) {
      updates.push(`is_active = $${paramCount}`);
      values.push(input.is_active);
      if (!input.is_active) {
        updates.push(`deactivated_at = CURRENT_TIMESTAMP`);
      }
      paramCount++;
    }

    if (input.last_active_at !== undefined) {
      updates.push(`last_active_at = $${paramCount}`);
      values.push(input.last_active_at);
      paramCount++;
    }

    if (updates.length === 0) {
      throw new ValidationError('No valid updates provided');
    }

    values.push(id);
    const query = `
            UPDATE devices
            SET ${updates.join(', ')}
            WHERE id = $${paramCount}
            RETURNING *
        `;

    const result = await this.pool.query(query, values);
    if (result.rows.length === 0) {
      throw new ValidationError('Device not found');
    }

    return result.rows[0];
  }

  async deactivate(id: string): Promise<Device> {
    const query = `
            UPDATE devices
            SET is_active = false, deactivated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND is_active = true
            RETURNING *
        `;

    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) {
      throw new ValidationError('Device not found or already deactivated');
    }

    return result.rows[0];
  }

  async updateLastActive(id: string): Promise<Device> {
    const query = `
            UPDATE devices
            SET last_active_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND is_active = true
            RETURNING *
        `;

    const result = await this.pool.query(query, [id]);
    if (result.rows.length === 0) {
      throw new ValidationError('Device not found or not active');
    }

    return result.rows[0];
  }

  async isDeviceActive(device: Device): Promise<boolean> {
    return device.is_active;
  }

  async getActiveDeviceCount(license_id: string): Promise<number> {
    const query = `
            SELECT COUNT(*) as count
            FROM devices
            WHERE license_id = $1 AND is_active = true
        `;

    const result = await this.pool.query(query, [license_id]);
    return parseInt(result.rows[0].count, 10);
  }
}
