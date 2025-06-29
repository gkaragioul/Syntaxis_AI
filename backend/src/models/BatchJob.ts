import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// Batch job status types
export type BatchJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

// Interface for BatchJob attributes
interface BatchJobAttributes {
  id: string;
  userId: string;
  status: BatchJobStatus;
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  errorSummary?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

// Interface for BatchJob creation attributes
interface BatchJobCreationAttributes
  extends Optional<
    BatchJobAttributes,
    'id' | 'processedFiles' | 'failedFiles' | 'errorSummary' | 'completedAt'
  > {}

// BatchJob model class
export class BatchJob
  extends Model<BatchJobAttributes, BatchJobCreationAttributes>
  implements BatchJobAttributes
{
  public id!: string;
  public userId!: string;
  public status!: BatchJobStatus;
  public totalFiles!: number;
  public processedFiles!: number;
  public failedFiles!: number;
  public errorSummary?: Record<string, any>;
  public createdAt!: Date;
  public updatedAt!: Date;
  public completedAt?: Date;

  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Helper methods
  public incrementProcessedFiles(): Promise<this> {
    return this.increment('processed_files');
  }

  public incrementFailedFiles(): Promise<this> {
    return this.increment('failed_files');
  }

  public addError(fileId: string, error: string): Promise<this> {
    const errorSummary = this.errorSummary || {};
    errorSummary[fileId] = error;
    return this.update({ errorSummary });
  }

  public isComplete(): boolean {
    return this.processedFiles + this.failedFiles >= this.totalFiles;
  }

  public getProgress(): number {
    return Math.round(
      ((this.processedFiles + this.failedFiles) / this.totalFiles) * 100,
    );
  }
}

// Initialize BatchJob model
BatchJob.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'user_id',
      references: {
        model: 'users',
        key: 'id',
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    totalFiles: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'total_files',
      validate: {
        min: 1,
      },
    },
    processedFiles: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'processed_files',
      validate: {
        min: 0,
      },
    },
    failedFiles: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'failed_files',
      validate: {
        min: 0,
      },
    },
    errorSummary: {
      type: DataTypes.JSONB,
      allowNull: true,
      field: 'error_summary',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'updated_at',
      defaultValue: DataTypes.NOW,
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'completed_at',
    },
  },
  {
    sequelize,
    tableName: 'batch_jobs',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['user_id'],
      },
      {
        fields: ['status'],
      },
      {
        fields: ['created_at'],
      },
    ],
  },
);

export default BatchJob;
