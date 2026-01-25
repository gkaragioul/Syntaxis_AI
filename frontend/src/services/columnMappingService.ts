/**
 * Column Mapping Service
 * Defines and manages column mappings for different invoice types
 * Allows customization of which fields appear in Excel export
 */

import { InvoiceType } from './invoiceTypeDetector';
import { Invoice } from './invoiceStorage';

export interface ColumnMapping {
  key: string;
  header: string;
  width?: number;
  format?: 'text' | 'currency' | 'date' | 'percentage' | 'number';
  required?: boolean;
}

export interface InvoiceTypeMapping {
  type: InvoiceType;
  columns: ColumnMapping[];
  description: string;
}

export class ColumnMappingService {
  /**
   * Default column mappings for each invoice type
   */
  private static readonly DEFAULT_MAPPINGS: Record<InvoiceType, InvoiceTypeMapping> = {
    standard: {
      type: 'standard',
      description: 'Standard Invoice',
      columns: [
        { key: 'invoiceNumber', header: 'Invoice #', width: 15, required: true },
        { key: 'vendorName', header: 'Vendor', width: 25, required: true },
        { key: 'invoiceDate', header: 'Invoice Date', width: 15, format: 'date' },
        { key: 'dueDate', header: 'Due Date', width: 15, format: 'date' },
        { key: 'subtotal', header: 'Subtotal', width: 15, format: 'currency' },
        { key: 'taxAmount', header: 'Tax', width: 15, format: 'currency' },
        { key: 'totalAmount', header: 'Total', width: 15, format: 'currency', required: true },
        { key: 'status', header: 'Status', width: 12 },
        { key: 'confidenceScore', header: 'Confidence', width: 12, format: 'percentage' },
        { key: 'notes', header: 'Notes', width: 30 },
      ],
    },
    purchase_order: {
      type: 'purchase_order',
      description: 'Purchase Order',
      columns: [
        { key: 'invoiceNumber', header: 'PO Number', width: 15, required: true },
        { key: 'vendorName', header: 'Vendor', width: 25, required: true },
        { key: 'invoiceDate', header: 'PO Date', width: 15, format: 'date' },
        { key: 'dueDate', header: 'Delivery Date', width: 15, format: 'date' },
        { key: 'subtotal', header: 'Subtotal', width: 15, format: 'currency' },
        { key: 'taxAmount', header: 'Tax', width: 15, format: 'currency' },
        { key: 'totalAmount', header: 'Total Amount', width: 15, format: 'currency', required: true },
        { key: 'status', header: 'Status', width: 12 },
        { key: 'confidenceScore', header: 'Confidence', width: 12, format: 'percentage' },
      ],
    },
    receipt: {
      type: 'receipt',
      description: 'Receipt',
      columns: [
        { key: 'invoiceNumber', header: 'Receipt #', width: 15, required: true },
        { key: 'vendorName', header: 'Vendor', width: 25, required: true },
        { key: 'invoiceDate', header: 'Date', width: 15, format: 'date', required: true },
        { key: 'totalAmount', header: 'Amount', width: 15, format: 'currency', required: true },
        { key: 'status', header: 'Status', width: 12 },
        { key: 'confidenceScore', header: 'Confidence', width: 12, format: 'percentage' },
        { key: 'notes', header: 'Notes', width: 30 },
      ],
    },
    credit_note: {
      type: 'credit_note',
      description: 'Credit Note',
      columns: [
        { key: 'invoiceNumber', header: 'Credit Note #', width: 15, required: true },
        { key: 'vendorName', header: 'Vendor', width: 25, required: true },
        { key: 'invoiceDate', header: 'Date', width: 15, format: 'date' },
        { key: 'totalAmount', header: 'Credit Amount', width: 15, format: 'currency', required: true },
        { key: 'status', header: 'Status', width: 12 },
        { key: 'confidenceScore', header: 'Confidence', width: 12, format: 'percentage' },
        { key: 'notes', header: 'Reason', width: 30 },
      ],
    },
    debit_note: {
      type: 'debit_note',
      description: 'Debit Note',
      columns: [
        { key: 'invoiceNumber', header: 'Debit Note #', width: 15, required: true },
        { key: 'vendorName', header: 'Vendor', width: 25, required: true },
        { key: 'invoiceDate', header: 'Date', width: 15, format: 'date' },
        { key: 'totalAmount', header: 'Debit Amount', width: 15, format: 'currency', required: true },
        { key: 'status', header: 'Status', width: 12 },
        { key: 'confidenceScore', header: 'Confidence', width: 12, format: 'percentage' },
        { key: 'notes', header: 'Reason', width: 30 },
      ],
    },
    unknown: {
      type: 'unknown',
      description: 'Unknown Type',
      columns: [
        { key: 'invoiceNumber', header: 'Document #', width: 15 },
        { key: 'vendorName', header: 'Vendor', width: 25 },
        { key: 'invoiceDate', header: 'Date', width: 15, format: 'date' },
        { key: 'totalAmount', header: 'Amount', width: 15, format: 'currency' },
        { key: 'status', header: 'Status', width: 12 },
      ],
    },
  };

  /**
   * Get column mapping for invoice type
   */
  static getMapping(type: InvoiceType): InvoiceTypeMapping {
    return this.DEFAULT_MAPPINGS[type] || this.DEFAULT_MAPPINGS.standard;
  }

  /**
   * Get all available mappings
   */
  static getAllMappings(): InvoiceTypeMapping[] {
    return Object.values(this.DEFAULT_MAPPINGS);
  }

  /**
   * Format value based on column format type
   */
  static formatValue(value: any, format?: string): any {
    if (value === null || value === undefined) {
      return '';
    }

    switch (format) {
      case 'currency':
        return typeof value === 'number' ? `$${value.toFixed(2)}` : value;
      case 'percentage':
        return typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : value;
      case 'date':
        if (typeof value === 'string') {
          return new Date(value).toLocaleDateString();
        }
        return value;
      case 'number':
        return typeof value === 'number' ? value.toFixed(2) : value;
      default:
        return value;
    }
  }

  /**
   * Extract data from invoice based on column mapping
   */
  static extractRowData(invoice: Invoice, mapping: InvoiceTypeMapping): Record<string, any> {
    const row: Record<string, any> = {};

    mapping.columns.forEach(column => {
      const value = (invoice as any)[column.key];
      row[column.header] = this.formatValue(value, column.format);
    });

    return row;
  }

  /**
   * Validate that all required columns have data
   */
  static validateRow(invoice: Invoice, mapping: InvoiceTypeMapping): { valid: boolean; missingFields: string[] } {
    const missingFields: string[] = [];

    mapping.columns.forEach(column => {
      if (column.required) {
        const value = (invoice as any)[column.key];
        if (!value) {
          missingFields.push(column.header);
        }
      }
    });

    return {
      valid: missingFields.length === 0,
      missingFields,
    };
  }

  /**
   * Create custom mapping (allows user to customize columns)
   */
  static createCustomMapping(
    type: InvoiceType,
    customColumns: ColumnMapping[]
  ): InvoiceTypeMapping {
    const baseMapping = this.getMapping(type);
    return {
      ...baseMapping,
      columns: customColumns,
    };
  }
}

export default ColumnMappingService;

