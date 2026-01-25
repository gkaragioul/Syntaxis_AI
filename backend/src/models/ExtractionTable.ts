/**
 * @deprecated This model has no corresponding table in Prisma schema.
 * There is no 'ExtractionTable' or similar table in schema.prisma.
 * 
 * If you need extraction data, use:
 * - prisma.extraction for main extraction records
 * - prisma.invoice for processed invoice data
 * - prisma.invoiceLineItem for line items
 * 
 * This class is kept for backwards compatibility but will throw errors.
 */

export interface ExtractedTable {
  id: string;
  fileId: string;
  userId: string;
  data: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface TableEdit {
  id: string;
  tableId: string;
  userId: string;
  changes: any;
  createdAt: Date;
}

export interface ErrorReport {
  id: string;
  message: string;
  code?: string;
  details?: any;
}

/**
 * @deprecated No corresponding Prisma model exists.
 * Use prisma.extraction, prisma.invoice, or prisma.invoiceLineItem instead.
 */
export class ExtractionTableModel {
  static async create(data: any): Promise<never> {
    throw new Error(
      'ExtractionTableModel is deprecated. No "ExtractionTable" model exists in Prisma schema. ' +
      'Use prisma.extraction, prisma.invoice, or prisma.invoiceLineItem instead.'
    );
  }

  static async findById(id: string): Promise<never> {
    throw new Error(
      'ExtractionTableModel is deprecated. No "ExtractionTable" model exists in Prisma schema. ' +
      'Use prisma.extraction, prisma.invoice, or prisma.invoiceLineItem instead.'
    );
  }

  static async findAll(filters?: any): Promise<never> {
    throw new Error(
      'ExtractionTableModel is deprecated. No "ExtractionTable" model exists in Prisma schema. ' +
      'Use prisma.extraction, prisma.invoice, or prisma.invoiceLineItem instead.'
    );
  }

  static async update(id: string, data: any): Promise<never> {
    throw new Error(
      'ExtractionTableModel is deprecated. No "ExtractionTable" model exists in Prisma schema. ' +
      'Use prisma.extraction, prisma.invoice, or prisma.invoiceLineItem instead.'
    );
  }

  static async delete(id: string): Promise<never> {
    throw new Error(
      'ExtractionTableModel is deprecated. No "ExtractionTable" model exists in Prisma schema. ' +
      'Use prisma.extraction, prisma.invoice, or prisma.invoiceLineItem instead.'
    );
  }
}

/**
 * @deprecated Legacy class kept for backwards compatibility.
 */
export class ExtractionTable {
  constructor(data: any) {
    Object.assign(this, data);
  }

  static async create(data: any): Promise<never> {
    throw new Error(
      'ExtractionTable is deprecated. No corresponding model exists in Prisma schema. ' +
      'Use prisma.extraction, prisma.invoice, or prisma.invoiceLineItem instead.'
    );
  }

  static async findById(id: string): Promise<never> {
    throw new Error(
      'ExtractionTable is deprecated. No corresponding model exists in Prisma schema. ' +
      'Use prisma.extraction, prisma.invoice, or prisma.invoiceLineItem instead.'
    );
  }
}

export default ExtractionTableModel;
