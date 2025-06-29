import { Model, DataTypes, Optional } from 'sequelize';
import { sequelize } from '../config/database';

// File upload status types
export type FileUploadStatus =
  | 'uploaded'
  | 'processing'
  | 'completed'
  | 'failed';

// Interface for FileUpload attributes
interface FileUploadAttributes {
  id: string;
  userId: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  storagePath: string;
  encryptionKeyId: string;
  status: FileUploadStatus;
  errorMessage?: string;
  retryCount: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt?: Date;
  deletedAt?: Date;
}

// Interface for FileUpload creation attributes
interface FileUploadCreationAttributes
  extends Optional<
    FileUploadAttributes,
    'id' | 'retryCount' | 'errorMessage' | 'processedAt' | 'deletedAt'
  > {}

// FileUpload model class
export class FileUpload
  extends Model<FileUploadAttributes, FileUploadCreationAttributes>
  implements FileUploadAttributes
{
  public id!: string;
  public userId!: string;
  public originalFilename!: string;
  public fileSize!: number;
  public mimeType!: string;
  public storagePath!: string;
  public encryptionKeyId!: string;
  public status!: FileUploadStatus;
  public errorMessage?: string;
  public retryCount!: number;
  public createdAt!: Date;
  public updatedAt!: Date;
  public processedAt?: Date;
  public deletedAt?: Date;

  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

// Initialize FileUpload model
FileUpload.init(
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
    originalFilename: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'original_filename',
    },
    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: 'file_size',
      validate: {
        min: 1,
        max: 104857600, // 100MB
      },
    },
    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: 'mime_type',
      validate: {
        is: /^application\/pdf$/,
      },
    },
    storagePath: {
      type: DataTypes.STRING(500),
      allowNull: false,
      field: 'storage_path',
    },
    encryptionKeyId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'encryption_key_id',
    },
    status: {
      type: DataTypes.ENUM('uploaded', 'processing', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'uploaded',
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: 'error_message',
    },
    retryCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: 'retry_count',
      validate: {
        min: 0,
      },
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
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'processed_at',
    },
    deletedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'deleted_at',
    },
  },
  {
    sequelize,
    tableName: 'file_uploads',
    timestamps: true,
    paranoid: true, // Enables soft deletes
    underscored: true, // Uses snake_case for fields
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

export default FileUpload;
