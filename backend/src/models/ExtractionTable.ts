import { Pool } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { BaseError } from '../utils/errors';

export interface ExtractedTable {
  id: string;
  fileId: string;
  batchJobId?: string;
  tableIndex: number;
  pageNumber: number;
  confidenceScore: number;
  extractionMetadata: Record<string, any>;
  rawData: {
    headers: string[];
    rows: (string | null)[][];
  };
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'edited';
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  lastEditedAt?: Date;
}

export interface TableEdit {
  id: string;
  tableId: string;
  userId: string;
  editedCells: Record<number, Record<number, string>>;
  editMetadata: Record<string, any>;
  version: number;
  isCommitted: boolean;
  createdAt: Date;
  updatedAt: Date;
  committedAt?: Date;
}

export interface ErrorReport {
  id: string;
  tableId?: string;
  batchJobId?: string;
  errorType: string;
  errorDetails: Record<string, any>;
  suggestedActions: string[];
  reportData: Record<string, any>;
  createdAt: Date;
  downloadedAt?: Date;
  expiresAt: Date;
}

export class ExtractionTableModel {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async create(input: {
    fileId: string;
    batchJobId?: string;
    tableIndex: number;
    pageNumber: number;
    confidenceScore: number;
    extractionMetadata: Record<string, any>;
    rawData: ExtractedTable['rawData'];
  }): Promise<ExtractedTable> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO extraction.tables (
                    id, file_id, batch_job_id, table_index, page_number,
                    confidence_score, extraction_metadata, raw_data
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *`,
        [
          uuidv4(),
          input.fileId,
          input.batchJobId,
          input.tableIndex,
          input.pageNumber,
          input.confidenceScore,
          input.extractionMetadata,
          input.rawData,
        ],
      );

      await client.query('COMMIT');
      return this.mapTableFromDb(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async findById(id: string): Promise<ExtractedTable | null> {
    const result = await this.pool.query(
      'SELECT * FROM extraction.tables WHERE id = $1',
      [id],
    );
    return result.rows.length ? this.mapTableFromDb(result.rows[0]) : null;
  }

  async findByFileId(fileId: string): Promise<ExtractedTable[]> {
    const result = await this.pool.query(
      'SELECT * FROM extraction.tables WHERE file_id = $1 ORDER BY table_index',
      [fileId],
    );
    return result.rows.map(this.mapTableFromDb);
  }

  async findByBatchJobId(batchJobId: string): Promise<ExtractedTable[]> {
    const result = await this.pool.query(
      'SELECT * FROM extraction.tables WHERE batch_job_id = $1 ORDER BY created_at',
      [batchJobId],
    );
    return result.rows.map(this.mapTableFromDb);
  }

  async updateStatus(
    id: string,
    status: ExtractedTable['status'],
    errorMessage?: string,
  ): Promise<ExtractedTable> {
    const result = await this.pool.query(
      `UPDATE extraction.tables 
            SET status = $1, 
                error_message = $2,
                processed_at = CASE 
                    WHEN $1 IN ('completed', 'failed') THEN NOW()
                    ELSE processed_at
                END
            WHERE id = $3
            RETURNING *`,
      [status, errorMessage, id],
    );

    if (!result.rows.length) {
      throw new BaseError('TABLE_NOT_FOUND', 'Table not found', 404);
    }

    return this.mapTableFromDb(result.rows[0]);
  }

  async createEdit(input: {
    tableId: string;
    userId: string;
    editedCells: TableEdit['editedCells'];
    editMetadata?: Record<string, any>;
  }): Promise<TableEdit> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Create new edit record
      const editResult = await client.query(
        `INSERT INTO extraction.table_edits (
                    id, table_id, user_id, edited_cells, edit_metadata
                ) VALUES ($1, $2, $3, $4, $5)
                RETURNING *`,
        [
          uuidv4(),
          input.tableId,
          input.userId,
          input.editedCells,
          input.editMetadata || {},
        ],
      );

      // Update table's last_edited_at
      await client.query(
        `UPDATE extraction.tables 
                SET last_edited_at = NOW(),
                    status = 'edited'
                WHERE id = $1`,
        [input.tableId],
      );

      await client.query('COMMIT');
      return this.mapEditFromDb(editResult.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getLatestEdit(tableId: string): Promise<TableEdit | null> {
    const result = await this.pool.query(
      `SELECT * FROM extraction.table_edits 
            WHERE table_id = $1 
            ORDER BY version DESC 
            LIMIT 1`,
      [tableId],
    );
    return result.rows.length ? this.mapEditFromDb(result.rows[0]) : null;
  }

  async commitEdit(editId: string): Promise<TableEdit> {
    const result = await this.pool.query(
      `UPDATE extraction.table_edits 
            SET is_committed = true,
                committed_at = NOW()
            WHERE id = $1
            RETURNING *`,
      [editId],
    );

    if (!result.rows.length) {
      throw new BaseError('EDIT_NOT_FOUND', 'Edit not found', 404);
    }

    return this.mapEditFromDb(result.rows[0]);
  }

  async createErrorReport(input: {
    tableId?: string;
    batchJobId?: string;
    errorType: string;
    errorDetails: Record<string, any>;
    suggestedActions: string[];
    reportData: Record<string, any>;
  }): Promise<ErrorReport> {
    const result = await this.pool.query(
      `INSERT INTO extraction.error_reports (
                id, table_id, batch_job_id, error_type,
                error_details, suggested_actions, report_data
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
      [
        uuidv4(),
        input.tableId,
        input.batchJobId,
        input.errorType,
        input.errorDetails,
        input.suggestedActions,
        input.reportData,
      ],
    );

    return this.mapErrorReportFromDb(result.rows[0]);
  }

  async markErrorReportDownloaded(id: string): Promise<ErrorReport> {
    const result = await this.pool.query(
      `UPDATE extraction.error_reports 
            SET downloaded_at = NOW()
            WHERE id = $1
            RETURNING *`,
      [id],
    );

    if (!result.rows.length) {
      throw new BaseError('REPORT_NOT_FOUND', 'Error report not found', 404);
    }

    return this.mapErrorReportFromDb(result.rows[0]);
  }

  private mapTableFromDb(row: any): ExtractedTable {
    return {
      id: row.id,
      fileId: row.file_id,
      batchJobId: row.batch_job_id,
      tableIndex: row.table_index,
      pageNumber: row.page_number,
      confidenceScore: parseFloat(row.confidence_score),
      extractionMetadata: row.extraction_metadata,
      rawData: row.raw_data,
      status: row.status,
      errorMessage: row.error_message,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      processedAt: row.processed_at,
      lastEditedAt: row.last_edited_at,
    };
  }

  private mapEditFromDb(row: any): TableEdit {
    return {
      id: row.id,
      tableId: row.table_id,
      userId: row.user_id,
      editedCells: row.edited_cells,
      editMetadata: row.edit_metadata,
      version: row.version,
      isCommitted: row.is_committed,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      committedAt: row.committed_at,
    };
  }

  private mapErrorReportFromDb(row: any): ErrorReport {
    return {
      id: row.id,
      tableId: row.table_id,
      batchJobId: row.batch_job_id,
      errorType: row.error_type,
      errorDetails: row.error_details,
      suggestedActions: row.suggested_actions,
      reportData: row.report_data,
      createdAt: row.created_at,
      downloadedAt: row.downloaded_at,
      expiresAt: row.expires_at,
    };
  }
}
