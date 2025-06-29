import { Pool } from 'pg';
import { BaseError } from '../utils/errors';
import { sanitizeData } from '../utils/sanitize';

// Enums
export enum ExportStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  VIRUS_SCANNING = 'virus_scanning',
  VIRUS_SCAN_FAILED = 'virus_scan_failed',
  EXPIRED = 'expired',
}

export enum ExportFormat {
  XLSX = 'xlsx',
  CSV = 'csv',
}

export enum ExportEventType {
  EXPORT_STARTED = 'export_started',
  EXPORT_COMPLETED = 'export_completed',
  EXPORT_FAILED = 'export_failed',
  VIRUS_SCAN_STARTED = 'virus_scan_started',
  VIRUS_SCAN_COMPLETED = 'virus_scan_completed',
  VIRUS_SCAN_FAILED = 'virus_scan_failed',
  DOWNLOAD_STARTED = 'download_started',
  DOWNLOAD_COMPLETED = 'download_completed',
  ERROR_REPORT_DOWNLOADED = 'error_report_downloaded',
}

// Interfaces
export interface Export {
  id: string;
  userId: string;
  batchJobId?: string;
  fileId: string;
  templateId?: string;
  format: ExportFormat;
  status: ExportStatus;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  virusScanStatus?: string;
  virusScanResult?: Record<string, any>;
  includeHeaders: boolean;
  includeMetadata: boolean;
  customFilename?: string;
  downloadCount: number;
  downloadLimit?: number;
  expiresAt: Date;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface ExportEvent {
  id: string;
  exportId: string;
  eventType: ExportEventType;
  eventData?: Record<string, any>;
  createdAt: Date;
}

export interface CreateExportInput {
  userId: string;
  batchJobId?: string;
  fileId: string;
  templateId?: string;
  format: ExportFormat;
  includeHeaders?: boolean;
  includeMetadata?: boolean;
  customFilename?: string;
  downloadLimit?: number;
  expiresAt?: Date;
}

export interface UpdateExportInput {
  status?: ExportStatus;
  filePath?: string;
  fileSize?: number;
  mimeType?: string;
  virusScanStatus?: string;
  virusScanResult?: Record<string, any>;
  errorCode?: string;
  errorMessage?: string;
  errorDetails?: Record<string, any>;
}

export interface ExportFilter {
  status?: ExportStatus;
  format?: ExportFormat;
  batchJobId?: string;
  fileId?: string;
  templateId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
  expiresAfter?: Date;
  expiresBefore?: Date;
}

// Custom error class
export class ExportError extends BaseError {
  constructor(
    message: string,
    public readonly code: string = 'EXPORT_ERROR',
    public readonly statusCode: number = 500,
    public readonly retryable: boolean = false,
  ) {
    super(message);
  }
}

export class ExportModel {
  constructor(private readonly pool: Pool) {}

  // Create a new export record
  async create(input: CreateExportInput): Promise<Export> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO export.exports (
                    user_id, batch_job_id, file_id, template_id, format,
                    include_headers, include_metadata, custom_filename,
                    download_limit, expires_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                RETURNING *`,
        [
          input.userId,
          input.batchJobId,
          input.fileId,
          input.templateId,
          input.format,
          input.includeHeaders ?? true,
          input.includeMetadata ?? true,
          input.customFilename,
          input.downloadLimit,
          input.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000),
        ],
      );

      await client.query('COMMIT');
      return this.mapExport(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new ExportError(
        `Failed to create export: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      client.release();
    }
  }

  // Get export by ID
  async findById(id: string, userId: string): Promise<Export> {
    const result = await this.pool.query(
      `SELECT * FROM export.exports 
            WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      throw new ExportError('Export not found', 'EXPORT_NOT_FOUND', 404);
    }

    return this.mapExport(result.rows[0]);
  }

  // List exports with filtering
  async findMany(
    userId: string,
    filter: ExportFilter = {},
    limit = 50,
    offset = 0,
  ): Promise<{ exports: Export[]; total: number }> {
    const conditions = ['user_id = $1', 'deleted_at IS NULL'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (filter.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(filter.status);
      paramIndex++;
    }

    if (filter.format) {
      conditions.push(`format = $${paramIndex}`);
      params.push(filter.format);
      paramIndex++;
    }

    if (filter.batchJobId) {
      conditions.push(`batch_job_id = $${paramIndex}`);
      params.push(filter.batchJobId);
      paramIndex++;
    }

    if (filter.fileId) {
      conditions.push(`file_id = $${paramIndex}`);
      params.push(filter.fileId);
      paramIndex++;
    }

    if (filter.templateId) {
      conditions.push(`template_id = $${paramIndex}`);
      params.push(filter.templateId);
      paramIndex++;
    }

    if (filter.createdAfter) {
      conditions.push(`created_at >= $${paramIndex}`);
      params.push(filter.createdAfter);
      paramIndex++;
    }

    if (filter.createdBefore) {
      conditions.push(`created_at <= $${paramIndex}`);
      params.push(filter.createdBefore);
      paramIndex++;
    }

    if (filter.expiresAfter) {
      conditions.push(`expires_at >= $${paramIndex}`);
      params.push(filter.expiresAfter);
      paramIndex++;
    }

    if (filter.expiresBefore) {
      conditions.push(`expires_at <= $${paramIndex}`);
      params.push(filter.expiresBefore);
      paramIndex++;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const [exportsResult, totalResult] = await Promise.all([
      this.pool.query(
        `SELECT * FROM export.exports 
                ${whereClause}
                ORDER BY created_at DESC
                LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
        [...params, limit, offset],
      ),
      this.pool.query(
        `SELECT COUNT(*) FROM export.exports ${whereClause}`,
        params,
      ),
    ]);

    return {
      exports: exportsResult.rows.map(this.mapExport),
      total: parseInt(totalResult.rows[0].count, 10),
    };
  }

  // Update export
  async update(
    id: string,
    userId: string,
    input: UpdateExportInput,
  ): Promise<Export> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const updates: string[] = [];
      const params: any[] = [id, userId];
      let paramIndex = 3;

      if (input.status !== undefined) {
        updates.push(`status = $${paramIndex}`);
        params.push(input.status);
        paramIndex++;
      }

      if (input.filePath !== undefined) {
        updates.push(`file_path = $${paramIndex}`);
        params.push(input.filePath);
        paramIndex++;
      }

      if (input.fileSize !== undefined) {
        updates.push(`file_size = $${paramIndex}`);
        params.push(input.fileSize);
        paramIndex++;
      }

      if (input.mimeType !== undefined) {
        updates.push(`mime_type = $${paramIndex}`);
        params.push(input.mimeType);
        paramIndex++;
      }

      if (input.virusScanStatus !== undefined) {
        updates.push(`virus_scan_status = $${paramIndex}`);
        params.push(input.virusScanStatus);
        paramIndex++;
      }

      if (input.virusScanResult !== undefined) {
        updates.push(`virus_scan_result = $${paramIndex}`);
        params.push(input.virusScanResult);
        paramIndex++;
      }

      if (input.errorCode !== undefined) {
        updates.push(`error_code = $${paramIndex}`);
        params.push(input.errorCode);
        paramIndex++;
      }

      if (input.errorMessage !== undefined) {
        updates.push(`error_message = $${paramIndex}`);
        params.push(input.errorMessage);
        paramIndex++;
      }

      if (input.errorDetails !== undefined) {
        updates.push(`error_details = $${paramIndex}`);
        params.push(input.errorDetails);
        paramIndex++;
      }

      if (updates.length === 0) {
        throw new ExportError('No updates provided', 'INVALID_UPDATE', 400);
      }

      const result = await client.query(
        `UPDATE export.exports 
                SET ${updates.join(', ')}
                WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
                RETURNING *`,
        params,
      );

      if (result.rows.length === 0) {
        throw new ExportError('Export not found', 'EXPORT_NOT_FOUND', 404);
      }

      await client.query('COMMIT');
      return this.mapExport(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof ExportError) throw error;
      throw new ExportError(
        `Failed to update export: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      client.release();
    }
  }

  // Delete export (soft delete)
  async delete(id: string, userId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE export.exports 
            SET deleted_at = NOW()
            WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
            RETURNING id`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      throw new ExportError('Export not found', 'EXPORT_NOT_FOUND', 404);
    }
  }

  // Increment download count
  async incrementDownloadCount(id: string, userId: string): Promise<Export> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE export.exports 
                SET download_count = download_count + 1
                WHERE id = $1 AND user_id = $2 
                AND deleted_at IS NULL 
                AND status = 'completed'
                AND (download_limit IS NULL OR download_count < download_limit)
                AND expires_at > NOW()
                RETURNING *`,
        [id, userId],
      );

      if (result.rows.length === 0) {
        throw new ExportError(
          'Export not found, expired, or download limit reached',
          'EXPORT_NOT_AVAILABLE',
          404,
        );
      }

      await client.query('COMMIT');
      return this.mapExport(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      if (error instanceof ExportError) throw error;
      throw new ExportError(
        `Failed to increment download count: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      client.release();
    }
  }

  // Create export event
  async createEvent(
    exportId: string,
    eventType: ExportEventType,
    eventData?: Record<string, any>,
  ): Promise<ExportEvent> {
    const result = await this.pool.query(
      `INSERT INTO export.export_events (export_id, event_type, event_data)
            VALUES ($1, $2, $3)
            RETURNING *`,
      [exportId, eventType, eventData],
    );

    return this.mapExportEvent(result.rows[0]);
  }

  // Get export events
  async getEvents(exportId: string, userId: string): Promise<ExportEvent[]> {
    const result = await this.pool.query(
      `SELECT e.* FROM export.export_events e
            JOIN export.exports ex ON e.export_id = ex.id
            WHERE ex.id = $1 AND ex.user_id = $2 AND ex.deleted_at IS NULL
            ORDER BY e.created_at DESC`,
      [exportId, userId],
    );

    return result.rows.map(this.mapExportEvent);
  }

  // Clean up expired exports
  async cleanupExpired(): Promise<number> {
    const result = await this.pool.query(
      `SELECT export.cleanup_expired_exports()`,
    );
    return result.rowCount;
  }

  // Private mapping functions
  private mapExport(row: any): Export {
    return {
      id: row.id,
      userId: row.user_id,
      batchJobId: row.batch_job_id,
      fileId: row.file_id,
      templateId: row.template_id,
      format: row.format,
      status: row.status,
      filePath: row.file_path,
      fileSize: row.file_size,
      mimeType: row.mime_type,
      virusScanStatus: row.virus_scan_status,
      virusScanResult: row.virus_scan_result,
      includeHeaders: row.include_headers,
      includeMetadata: row.include_metadata,
      customFilename: row.custom_filename,
      downloadCount: row.download_count,
      downloadLimit: row.download_limit,
      expiresAt: row.expires_at,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      errorDetails: row.error_details,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  private mapExportEvent(row: any): ExportEvent {
    return {
      id: row.id,
      exportId: row.export_id,
      eventType: row.event_type,
      eventData: row.event_data,
      createdAt: row.created_at,
    };
  }
}
