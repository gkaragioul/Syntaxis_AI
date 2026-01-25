export type BatchJobStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface BatchJobAttributes {
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

export class BatchJob implements BatchJobAttributes {
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

  static create(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static findOne(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static findAll(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static update(data: any, options: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static findByPk(id: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static increment(field: any, options: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }

  public incrementProcessedFiles(): Promise<this> {
    throw new Error('Sequelize models are deprecated. Use Prisma.');
  }

  public incrementFailedFiles(): Promise<this> {
    throw new Error('Sequelize models are deprecated. Use Prisma.');
  }

  public addError(fileId: string, error: string): Promise<this> {
    throw new Error('Sequelize models are deprecated. Use Prisma.');
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

export default BatchJob;
