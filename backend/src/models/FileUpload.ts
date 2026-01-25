export type FileUploadStatus =
  | 'uploaded'
  | 'processing'
  | 'completed'
  | 'failed';

export interface FileUploadAttributes {
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

// Stub class to avoid breaking imports, but without Sequelize
export class FileUpload implements FileUploadAttributes {
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

  // Static methods to mock Sequelize and prevent crashes during load
  static create(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static findOne(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static findAll(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static update(data: any, options: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static findByPk(id: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static increment(field: any, options: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
}

export default FileUpload;
