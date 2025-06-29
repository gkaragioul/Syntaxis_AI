import { Pool } from 'pg';
import { BaseError } from '../utils/errors';
import { sanitizeData } from '../utils/sanitize';

// Template type definitions
export type TemplateType = 'invoice' | 'receipt' | 'statement' | 'custom';
export type TemplateStatus = 'active' | 'archived' | 'deleted';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
  dataType: 'string' | 'number' | 'date' | 'currency';
  required: boolean;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    format?: string;
  };
}

export interface TemplateFilter {
  field: string;
  operator: 'equals' | 'contains' | 'startsWith' | 'endsWith' | 'regex';
  value: string | number;
  caseSensitive?: boolean;
}

export interface TemplateLogic {
  pageNumbers: number[];
  tableIndex: number;
  headerRow: number;
  columnMappings: Record<string, ColumnMapping>;
  filters: TemplateFilter[];
  preprocessing?: {
    deskew?: boolean;
    denoise?: boolean;
    enhance?: boolean;
  };
  postprocessing?: {
    validateTotals?: boolean;
    validateDates?: boolean;
    validateRequired?: boolean;
  };
}

export interface Template {
  id: string;
  userId: string;
  name: string;
  description?: string;
  type: TemplateType;
  status: TemplateStatus;
  logic: TemplateLogic;
  vendorName?: string;
  vendorPattern?: string;
  successRate: number;
  usageCount: number;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  type?: TemplateType;
  logic: TemplateLogic;
  vendorName?: string;
  vendorPattern?: string;
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string;
  type?: TemplateType;
  status?: TemplateStatus;
  logic?: TemplateLogic;
  vendorName?: string;
  vendorPattern?: string;
}

export interface TemplateApplication {
  id: string;
  templateId: string;
  userId: string;
  batchJobId?: string;
  fileId?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  errorDetails?: Record<string, any>;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

export class TemplateError extends BaseError {
  constructor(message: string, code: string, statusCode: number = 400) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

export class TemplateModel {
  private pool: Pool;
  private encryptionKey: string;

  constructor(pool: Pool, encryptionKey: string) {
    this.pool = pool;
    this.encryptionKey = encryptionKey;
  }

  private async encryptLogic(
    logic: TemplateLogic,
  ): Promise<{ encrypted: Buffer; iv: Buffer }> {
    const result = await this.pool.query(
      'SELECT * FROM templates.encrypt_template_logic($1, $2)',
      [JSON.stringify(logic), this.encryptionKey],
    );
    return {
      encrypted: result.rows[0].encrypted,
      iv: result.rows[0].iv,
    };
  }

  private async decryptLogic(
    encrypted: Buffer,
    iv: Buffer,
  ): Promise<TemplateLogic> {
    const result = await this.pool.query(
      'SELECT templates.decrypt_template_logic($1, $2, $3) as logic',
      [encrypted, iv, this.encryptionKey],
    );
    return JSON.parse(result.rows[0].logic);
  }

  private mapRowToTemplate(row: any): Template {
    return {
      id: row.id,
      userId: row.user_id,
      name: row.name,
      description: row.description,
      type: row.type,
      status: row.status,
      logic: row.logic, // This will be decrypted when needed
      vendorName: row.vendor_name,
      vendorPattern: row.vendor_pattern,
      successRate: parseFloat(row.success_rate),
      usageCount: parseInt(row.usage_count),
      lastUsedAt: row.last_used_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      deletedAt: row.deleted_at,
    };
  }

  async create(input: CreateTemplateInput, userId: string): Promise<Template> {
    const { encrypted, iv } = await this.encryptLogic(input.logic);

    const result = await this.pool.query(
      `INSERT INTO templates.templates (
                user_id, name, description, type, logic_encrypted, logic_iv,
                vendor_name, vendor_pattern, page_numbers, table_index,
                header_row, column_mappings, filters
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            RETURNING *`,
      [
        userId,
        input.name,
        input.description,
        input.type || 'custom',
        encrypted,
        iv,
        input.vendorName,
        input.vendorPattern,
        input.logic.pageNumbers,
        input.logic.tableIndex,
        input.logic.headerRow,
        input.logic.columnMappings,
        input.logic.filters,
      ],
    );

    const template = this.mapRowToTemplate(result.rows[0]);
    template.logic = input.logic; // Use the original logic since we just created it
    return template;
  }

  async findById(id: string, userId: string): Promise<Template | null> {
    const result = await this.pool.query(
      `SELECT * FROM templates.templates 
            WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      return null;
    }

    const template = this.mapRowToTemplate(result.rows[0]);
    template.logic = await this.decryptLogic(
      result.rows[0].logic_encrypted,
      result.rows[0].logic_iv,
    );
    return template;
  }

  async findByUserId(
    userId: string,
    options: {
      status?: TemplateStatus;
      type?: TemplateType;
      search?: string;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ templates: Template[]; total: number }> {
    const conditions = ['user_id = $1', 'deleted_at IS NULL'];
    const params: any[] = [userId];
    let paramIndex = 2;

    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    if (options.type) {
      conditions.push(`type = $${paramIndex}`);
      params.push(options.type);
      paramIndex++;
    }

    if (options.search) {
      conditions.push(
        `(name ILIKE $${paramIndex} OR vendor_name ILIKE $${paramIndex})`,
      );
      params.push(`%${options.search}%`);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM templates.templates WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count);

    // Get templates with pagination
    const result = await this.pool.query(
      `SELECT * FROM templates.templates 
            WHERE ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, options.limit || 10, options.offset || 0],
    );

    const templates = await Promise.all(
      result.rows.map(async (row) => {
        const template = this.mapRowToTemplate(row);
        template.logic = await this.decryptLogic(
          row.logic_encrypted,
          row.logic_iv,
        );
        return template;
      }),
    );

    return { templates, total };
  }

  async update(
    id: string,
    userId: string,
    input: UpdateTemplateInput,
  ): Promise<Template> {
    const template = await this.findById(id, userId);
    if (!template) {
      throw new TemplateError('Template not found', 'TEMPLATE_NOT_FOUND', 404);
    }

    const updates: string[] = [];
    const params: any[] = [id, userId];
    let paramIndex = 3;

    if (input.name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      params.push(input.name);
      paramIndex++;
    }

    if (input.description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      params.push(input.description);
      paramIndex++;
    }

    if (input.type !== undefined) {
      updates.push(`type = $${paramIndex}`);
      params.push(input.type);
      paramIndex++;
    }

    if (input.status !== undefined) {
      updates.push(`status = $${paramIndex}`);
      params.push(input.status);
      paramIndex++;
    }

    if (input.vendorName !== undefined) {
      updates.push(`vendor_name = $${paramIndex}`);
      params.push(input.vendorName);
      paramIndex++;
    }

    if (input.vendorPattern !== undefined) {
      updates.push(`vendor_pattern = $${paramIndex}`);
      params.push(input.vendorPattern);
      paramIndex++;
    }

    if (input.logic !== undefined) {
      const { encrypted, iv } = await this.encryptLogic(input.logic);
      updates.push(
        `logic_encrypted = $${paramIndex}, logic_iv = $${paramIndex + 1}`,
      );
      params.push(encrypted, iv);
      paramIndex += 2;

      updates.push(`page_numbers = $${paramIndex}`);
      params.push(input.logic.pageNumbers);
      paramIndex++;

      updates.push(`table_index = $${paramIndex}`);
      params.push(input.logic.tableIndex);
      paramIndex++;

      updates.push(`header_row = $${paramIndex}`);
      params.push(input.logic.headerRow);
      paramIndex++;

      updates.push(`column_mappings = $${paramIndex}`);
      params.push(input.logic.columnMappings);
      paramIndex++;

      updates.push(`filters = $${paramIndex}`);
      params.push(input.logic.filters);
      paramIndex++;
    }

    if (updates.length === 0) {
      return template;
    }

    const result = await this.pool.query(
      `UPDATE templates.templates 
            SET ${updates.join(', ')}
            WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
            RETURNING *`,
      params,
    );

    const updatedTemplate = this.mapRowToTemplate(result.rows[0]);
    updatedTemplate.logic = input.logic || template.logic;
    return updatedTemplate;
  }

  async delete(id: string, userId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE templates.templates 
            SET deleted_at = NOW(), status = 'deleted'
            WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL
            RETURNING id`,
      [id, userId],
    );

    if (result.rows.length === 0) {
      throw new TemplateError('Template not found', 'TEMPLATE_NOT_FOUND', 404);
    }
  }

  async createApplication(
    templateId: string,
    userId: string,
    options: { fileId?: string; batchJobId?: string },
  ): Promise<TemplateApplication> {
    if (!options.fileId && !options.batchJobId) {
      throw new TemplateError(
        'Either fileId or batchJobId must be provided',
        'INVALID_APPLICATION_INPUT',
      );
    }

    const result = await this.pool.query(
      `INSERT INTO templates.template_applications (
                template_id, user_id, file_id, batch_job_id
            ) VALUES ($1, $2, $3, $4)
            RETURNING *`,
      [templateId, userId, options.fileId, options.batchJobId],
    );

    return {
      id: result.rows[0].id,
      templateId: result.rows[0].template_id,
      userId: result.rows[0].user_id,
      batchJobId: result.rows[0].batch_job_id,
      fileId: result.rows[0].file_id,
      status: result.rows[0].status,
      errorMessage: result.rows[0].error_message,
      errorDetails: result.rows[0].error_details,
      startedAt: result.rows[0].started_at,
      completedAt: result.rows[0].completed_at,
      createdAt: result.rows[0].created_at,
    };
  }

  async updateApplicationStatus(
    applicationId: string,
    status: TemplateApplication['status'],
    options: {
      errorMessage?: string;
      errorDetails?: Record<string, any>;
    } = {},
  ): Promise<TemplateApplication> {
    const updates: string[] = ['status = $1'];
    const params: any[] = [status];
    let paramIndex = 2;

    if (status === 'processing') {
      updates.push(`started_at = NOW()`);
    } else if (status === 'completed' || status === 'failed') {
      updates.push(`completed_at = NOW()`);
    }

    if (options.errorMessage !== undefined) {
      updates.push(`error_message = $${paramIndex}`);
      params.push(options.errorMessage);
      paramIndex++;
    }

    if (options.errorDetails !== undefined) {
      updates.push(`error_details = $${paramIndex}`);
      params.push(options.errorDetails);
      paramIndex++;
    }

    const result = await this.pool.query(
      `UPDATE templates.template_applications 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
            RETURNING *`,
      [...params, applicationId],
    );

    if (result.rows.length === 0) {
      throw new TemplateError(
        'Application not found',
        'APPLICATION_NOT_FOUND',
        404,
      );
    }

    return {
      id: result.rows[0].id,
      templateId: result.rows[0].template_id,
      userId: result.rows[0].user_id,
      batchJobId: result.rows[0].batch_job_id,
      fileId: result.rows[0].file_id,
      status: result.rows[0].status,
      errorMessage: result.rows[0].error_message,
      errorDetails: result.rows[0].error_details,
      startedAt: result.rows[0].started_at,
      completedAt: result.rows[0].completed_at,
      createdAt: result.rows[0].created_at,
    };
  }

  async getApplicationHistory(
    templateId: string,
    userId: string,
    options: {
      status?: TemplateApplication['status'];
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ applications: TemplateApplication[]; total: number }> {
    const conditions = ['template_id = $1', 'user_id = $2'];
    const params: any[] = [templateId, userId];
    let paramIndex = 3;

    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) FROM templates.template_applications WHERE ${whereClause}`,
      params,
    );
    const total = parseInt(countResult.rows[0].count);

    // Get applications with pagination
    const result = await this.pool.query(
      `SELECT * FROM templates.template_applications 
            WHERE ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, options.limit || 10, options.offset || 0],
    );

    const applications = result.rows.map((row) => ({
      id: row.id,
      templateId: row.template_id,
      userId: row.user_id,
      batchJobId: row.batch_job_id,
      fileId: row.file_id,
      status: row.status,
      errorMessage: row.error_message,
      errorDetails: row.error_details,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
    }));

    return { applications, total };
  }
}
