export type ExtractedDataType = 'table' | 'text' | 'metadata';

export interface ExtractedDataAttributes {
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

export class ExtractedData implements ExtractedDataAttributes {
  public id!: string;
  public fileUploadId!: string;
  public batchJobId!: string;
  public dataType!: ExtractedDataType;
  public content!: Record<string, any>;
  public confidenceScore?: number;
  public encryptionKeyId!: string;
  public createdAt!: Date;
  public updatedAt!: Date;

  static create(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static findOne(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static findAll(data: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static update(data: any, options: any) { throw new Error('Sequelize models are deprecated. Use Prisma.'); }
  static belongsTo(model: any, options: any) { }

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

export default ExtractedData;
