import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';
import { BatchJob } from './BatchJob';
import { FileUpload } from './FileUpload';

// Extracted data types
export type ExtractedDataType = 'table' | 'text' | 'metadata';

// Interface for ExtractedData attributes
interface ExtractedDataAttributes {
  id: string;
  fileUploadId: string;
  batchJobId: string;
  dataType: ExtractedDataType;
  content: Record<string, any>;
  confidenceScore?: number;
  encryptionKeyId: string;
  createdAt: Date;
  updatedAt: Date;
}

// Interface for ExtractedData creation attributes
interface ExtractedDataCreationAttributes
  extends Optional<ExtractedDataAttributes, 'id' | 'confidenceScore'> {}

// ExtractedData model class
export class ExtractedData
  extends Model<ExtractedDataAttributes, ExtractedDataCreationAttributes>
  implements ExtractedDataAttributes
{
  public id!: string;
  public fileUploadId!: string;
  public batchJobId!: string;
  public dataType!: ExtractedDataType;
  public content!: Record<string, any>;
  public confidenceScore?: number;
  public encryptionKeyId!: string;
  public createdAt!: Date;
  public updatedAt!: Date;

  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Associations
  public fileUpload?: FileUpload;
  public batchJob?: BatchJob;

  // Helper methods
  public getTableData(): Record<string, any> | null {
    if (this.dataType !== 'table') return null;
    return this.content;
  }

  public getTextData(): string | null {
    if (this.dataType !== 'text') return null;
    return this.content.text;
  }

  public getMetadata(): Record<string, any> | null {
    if (this.dataType !== 'metadata') return null;
    return this.content;
  }
}

// Initialize ExtractedData model
ExtractedData.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fileUploadId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'file_upload_id',
      references: {
        model: FileUpload,
        key: 'id',
      },
    },
    batchJobId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'batch_job_id',
      references: {
        model: BatchJob,
        key: 'id',
      },
    },
    dataType: {
      type: DataTypes.ENUM('table', 'text', 'metadata'),
      allowNull: false,
      field: 'data_type',
    },
    content: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    confidenceScore: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      field: 'confidence_score',
      validate: {
        min: 0,
        max: 1,
      },
    },
    encryptionKeyId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'encryption_key_id',
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
  },
  {
    sequelize,
    tableName: 'extracted_data',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ['file_upload_id'],
      },
      {
        fields: ['batch_job_id'],
      },
      {
        fields: ['data_type'],
      },
      {
        using: 'GIN',
        fields: ['content'],
      },
    ],
  },
);

// Define associations
ExtractedData.belongsTo(FileUpload, {
  foreignKey: 'file_upload_id',
  as: 'fileUpload',
});

ExtractedData.belongsTo(BatchJob, {
  foreignKey: 'batch_job_id',
  as: 'batchJob',
});

export default ExtractedData;
