export type BatchJobFileStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

export interface BatchJobFileAttributes {
  batchJobId: string;
  fileUploadId: string;
  position: number;
  status: BatchJobFileStatus;
  errorMessage?: string;
  createdAt: Date;
}

export class BatchJobFile implements BatchJobFileAttributes {
  public batchJobId!: string;
  public fileUploadId!: string;
  public position!: number;
  public status!: BatchJobFileStatus;
  public errorMessage?: string;
  public createdAt!: Date;

  static create(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static findOne(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static findAll(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static update(data: any, options: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static belongsTo(model: any, options: any) { }
}

export default BatchJobFile;
