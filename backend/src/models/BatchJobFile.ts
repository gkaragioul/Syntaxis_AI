import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { BatchJob } from './BatchJob';
import { FileUpload } from './FileUpload';

// Batch job file status types
export type BatchJobFileStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

// Interface for BatchJobFile attributes
interface BatchJobFileAttributes {
  batchJobId: string;
  fileUploadId: string;
  position: number;
  status: BatchJobFileStatus;
  errorMessage?: string;
  createdAt: Date;
}

// Interface for BatchJobFile creation attributes
interface BatchJobFileCreationAttributes
  extends Optional<BatchJobFileAttributes, 'errorMessage'> {}

// BatchJobFile model class
export class BatchJobFile
  extends Model<BatchJobFileAttributes, BatchJobFileCreationAttributes>
  implements BatchJobFileAttributes
{
  public batchJobId!: string;
  public fileUploadId!: string;
  public position!: number;
  public status!: BatchJobFileStatus;
  public errorMessage?: string;
  public createdAt!: Date;

  // Timestamps
  public readonly created_at!: Date;

  // Associations
  public batchJob?: BatchJob;
  public fileUpload?: FileUpload;
}

// Initialize BatchJobFile model
BatchJobFile.init(
  {
    batchJobId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'batch_job_id',
      primaryKey: true,
      references: {
        model: BatchJob,
        key: 'id',
      },
    },
    fileUploadId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'file_upload_id',
      primaryKey: true,
      references: {
        model: FileUpload,
        key: 'id',
      },
    },
    position: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
      },
    },
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: 'created_at',
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'batch_job_files',
    timestamps: false, // We only use created_at
    underscored: true,
    indexes: [
      {
        fields: ['batch_job_id'],
      },
      {
        fields: ['file_upload_id'],
      },
    ],
  },
);

// Define associations
BatchJobFile.belongsTo(BatchJob, {
  foreignKey: 'batch_job_id',
  as: 'batchJob',
});

BatchJobFile.belongsTo(FileUpload, {
  foreignKey: 'file_upload_id',
  as: 'fileUpload',
});

export default BatchJobFile;
