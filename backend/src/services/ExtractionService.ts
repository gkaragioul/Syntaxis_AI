// @ts-nocheck

import {
  ExtractionTableModel,
  ExtractedTable,
  TableEdit,
  ErrorReport,
} from '../models/ExtractionTable';
import { BaseError } from '../utils/errors';
import { Queue } from 'bull';
import { Redis } from 'ioredis';
import { sanitizeData } from '../utils/sanitization';

export class ExtractionService {
  private tableModel: ExtractionTableModel;
  private extractionQueue: Queue;
  private redis: Redis;

  constructor(
    tableModel: ExtractionTableModel,
    extractionQueue: Queue,
    redis: Redis,
  ) {
    this.tableModel = tableModel;
    this.extractionQueue = extractionQueue;
    this.redis = redis;
  }

  async extractTable(
    fileId: string,
    options: {
      batchJobId?: string;
      templateId?: string;
      forceReextraction?: boolean;
    } = {},
  ): Promise<ExtractedTable> {
    // Check if table already exists and reextraction is not forced
    if (!options.forceReextraction) {
      const existingTables = await this.tableModel.findByFileId(fileId);
      if (existingTables.length > 0) {
        throw new BaseError(
          'TABLE_ALREADY_EXISTS',
          'Table already exists. Use forceReextraction to override.',
          409,
        );
      }
    }

    // Create initial table record
    const table = await this.tableModel.create({
      fileId,
      batchJobId: options.batchJobId,
      tableIndex: 0, // Will be updated by the extraction worker
      pageNumber: 1, // Will be updated by the extraction worker
      confidenceScore: 0,
      extractionMetadata: {
        templateId: options.templateId,
        extractionOptions: options,
      },
      rawData: {
        headers: [],
        rows: [],
      },
    });

    // Queue extraction job
    await this.extractionQueue.add(
      'extract-table',
      {
        tableId: table.id,
        fileId,
        templateId: options.templateId,
        options,
      },
      {
        jobId: `extract-${table.id}`,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    );

    return table;
  }

  async extractBatch(
    batchJobId: string,
    fileIds: string[],
    options: {
      templateId?: string;
      forceReextraction?: boolean;
    } = {},
  ): Promise<ExtractedTable[]> {
    const tables: ExtractedTable[] = [];

    for (const fileId of fileIds) {
      try {
        const table = await this.extractTable(fileId, {
          ...options,
          batchJobId,
        });
        tables.push(table);
      } catch (error) {
        if (
          error instanceof BaseError &&
          error.code === 'TABLE_ALREADY_EXISTS'
        ) {
          // Skip existing tables unless forceReextraction is true
          if (options.forceReextraction) {
            const existingTables = await this.tableModel.findByFileId(fileId);
            for (const existingTable of existingTables) {
              await this.tableModel.updateStatus(existingTable.id, 'pending');
              await this.extractionQueue.add(
                'extract-table',
                {
                  tableId: existingTable.id,
                  fileId,
                  templateId: options.templateId,
                  options: { ...options, forceReextraction: true },
                },
                {
                  jobId: `reextract-${existingTable.id}`,
                  attempts: 3,
                },
              );
              tables.push(existingTable);
            }
          }
        } else {
          throw error;
        }
      }
    }

    return tables;
  }

  async getTableWithEdits(tableId: string): Promise<{
    table: ExtractedTable;
    edits: TableEdit | null;
    editedData: ExtractedTable['rawData'];
  }> {
    const [table, latestEdit] = await Promise.all([
      this.tableModel.findById(tableId),
      this.tableModel.getLatestEdit(tableId),
    ]);

    if (!table) {
      throw new BaseError('TABLE_NOT_FOUND', 'Table not found', 404);
    }

    // Apply edits to raw data if they exist
    const editedData = this.applyEditsToTableData(
      table.rawData,
      latestEdit?.editedCells,
    );

    return {
      table,
      edits: latestEdit,
      editedData,
    };
  }

  async saveTableEdit(input: {
    tableId: string;
    userId: string;
    editedCells: TableEdit['editedCells'];
    editMetadata?: Record<string, any>;
  }): Promise<TableEdit> {
    // Validate table exists
    const table = await this.tableModel.findById(input.tableId);
    if (!table) {
      throw new BaseError('TABLE_NOT_FOUND', 'Table not found', 404);
    }

    // Create edit record
    const edit = await this.tableModel.createEdit({
      tableId: input.tableId,
      userId: input.userId,
      editedCells: input.editedCells,
      editMetadata: {
        ...input.editMetadata,
        originalConfidence: table.confidenceScore,
      },
    });

    // Cache the edited data for quick access
    const editedData = this.applyEditsToTableData(
      table.rawData,
      edit.editedCells,
    );
    await this.cacheEditedData(input.tableId, editedData);

    return edit;
  }

  async commitTableEdit(editId: string): Promise<TableEdit> {
    const edit = await this.tableModel.commitEdit(editId);

    // Update cache with committed data
    const table = await this.tableModel.findById(edit.tableId);
    if (table) {
      const editedData = this.applyEditsToTableData(
        table.rawData,
        edit.editedCells,
      );
      await this.cacheEditedData(edit.tableId, editedData);
    }

    return edit;
  }

  async createErrorReport(input: {
    tableId?: string;
    batchJobId?: string;
    error: Error;
    context?: Record<string, any>;
  }): Promise<ErrorReport> {
    const errorType =
      input.error instanceof BaseError ? input.error.code : 'UNKNOWN_ERROR';
    const errorDetails = {
      message: input.error.message,
      stack: input.error.stack,
      ...(input.error instanceof BaseError
        ? { statusCode: input.error.statusCode }
        : {}),
      context: input.context,
    };

    // Generate suggested actions based on error type
    const suggestedActions = this.generateSuggestedActions(
      errorType,
      errorDetails,
    );

    // Sanitize data for error report
    const reportData = sanitizeData({
      errorType,
      errorDetails,
      context: input.context,
    });

    return this.tableModel.createErrorReport({
      tableId: input.tableId,
      batchJobId: input.batchJobId,
      errorType,
      errorDetails,
      suggestedActions,
      reportData,
    });
  }

  private applyEditsToTableData(
    originalData: ExtractedTable['rawData'],
    edits?: TableEdit['editedCells'],
  ): ExtractedTable['rawData'] {
    if (!edits) return originalData;

    const editedData = {
      headers: [...originalData.headers],
      rows: originalData.rows.map((row) => [...row]),
    };

    // Apply edits to cells
    Object.entries(edits).forEach(([rowIndex, colEdits]) => {
      const row = parseInt(rowIndex);
      if (row === -1) {
        // Header edits
        Object.entries(colEdits).forEach(([colIndex, value]) => {
          const col = parseInt(colIndex);
          if (col >= 0 && col < editedData.headers.length) {
            editedData.headers[col] = value;
          }
        });
      } else if (row >= 0 && row < editedData.rows.length) {
        // Row edits
        Object.entries(colEdits).forEach(([colIndex, value]) => {
          const col = parseInt(colIndex);
          if (col >= 0 && col < editedData.rows[row].length) {
            editedData.rows[row][col] = value;
          }
        });
      }
    });

    return editedData;
  }

  private async cacheEditedData(
    tableId: string,
    data: ExtractedTable['rawData'],
  ): Promise<void> {
    const cacheKey = `table:${tableId}:edited`;
    await this.redis.setex(cacheKey, 3600, JSON.stringify(data)); // Cache for 1 hour
  }

  private generateSuggestedActions(
    errorType: string,
    errorDetails: Record<string, any>,
  ): string[] {
    const actions: string[] = [];

    switch (errorType) {
      case 'EXTRACTION_FAILED':
        actions.push(
          'Try re-extracting the table with a different template',
          'Check if the PDF is properly scanned and readable',
          'Verify that the table structure is clear and well-defined',
        );
        break;

      case 'LOW_CONFIDENCE':
        actions.push(
          'Review the extracted data manually',
          'Consider using a template for this type of table',
          'Check if the table format matches expected patterns',
        );
        break;

      case 'INVALID_TABLE_STRUCTURE':
        actions.push(
          'Verify the table has clear headers and rows',
          'Check for merged cells or complex formatting',
          'Consider pre-processing the PDF to improve table structure',
        );
        break;

      default:
        actions.push(
          'Try re-extracting the table',
          'Contact support if the issue persists',
          'Check the error details for specific information',
        );
    }

    return actions;
  }
}
