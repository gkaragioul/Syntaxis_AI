/**
 * Excel Export Service
 * Exports invoices to Excel (.xlsx) format with proper formatting
 * Requires: npm install xlsx
 */

import * as XLSX from 'xlsx';
import { Invoice } from './invoiceStorage';
import { InvoiceType } from './invoiceTypeDetector';
import { ColumnMappingService } from './columnMappingService';

export interface ExcelExportOptions {
  filename?: string;
  sheetName?: string;
  includeHeaders?: boolean;
  freezeHeader?: boolean;
  autoFilter?: boolean;
  columnWidths?: boolean;
}

export class ExcelExportService {
  /**
   * Export invoices to Excel file
   */
  static exportToExcel(
    invoices: Invoice[],
    invoiceType: InvoiceType,
    options: ExcelExportOptions = {}
  ): void {
    const {
      filename = this.generateFilename(invoiceType),
      sheetName = ColumnMappingService.getMapping(invoiceType).description,
      includeHeaders = true,
      freezeHeader = true,
      autoFilter = true,
      columnWidths = true,
    } = options;

    // Get column mapping for invoice type
    const mapping = ColumnMappingService.getMapping(invoiceType);

    // Prepare data
    const data: any[] = [];

    // Add headers if requested
    if (includeHeaders) {
      const headers = mapping.columns.map(col => col.header);
      data.push(headers);
    }

    // Add invoice rows
    invoices.forEach(invoice => {
      const row = ColumnMappingService.extractRowData(invoice, mapping);
      const rowData = mapping.columns.map(col => row[col.header] || '');
      data.push(rowData);
    });

    // Create workbook
    const ws = XLSX.utils.aoa_to_sheet(data);

    // Apply column widths
    if (columnWidths) {
      ws['!cols'] = mapping.columns.map(col => ({
        wch: col.width || 15,
      }));
    }

    // Freeze header row
    if (freezeHeader && includeHeaders) {
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
    }

    // Add autofilter
    if (autoFilter && includeHeaders) {
      ws['!autofilter'] = {
        ref: XLSX.utils.encode_range({
          s: { c: 0, r: 0 },
          e: { c: mapping.columns.length - 1, r: invoices.length },
        }),
      };
    }

    // Create workbook and add sheet
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Write file
    XLSX.writeFile(wb, filename);
  }

  /**
   * Export multiple invoice types to separate sheets
   */
  static exportMultipleTypesToExcel(
    invoicesByType: Map<InvoiceType, Invoice[]>,
    options: ExcelExportOptions = {}
  ): void {
    const filename = options.filename || `invoices_${new Date().toISOString().split('T')[0]}.xlsx`;

    const wb = XLSX.utils.book_new();

    // Add sheet for each invoice type
    invoicesByType.forEach((invoices, invoiceType) => {
      const mapping = ColumnMappingService.getMapping(invoiceType);
      const sheetName = options.sheetName || mapping.description;

      // Prepare data
      const data: any[] = [];

      // Add headers
      const headers = mapping.columns.map(col => col.header);
      data.push(headers);

      // Add rows
      invoices.forEach(invoice => {
        const row = ColumnMappingService.extractRowData(invoice, mapping);
        const rowData = mapping.columns.map(col => row[col.header] || '');
        data.push(rowData);
      });

      // Create sheet
      const ws = XLSX.utils.aoa_to_sheet(data);

      // Apply formatting
      if (options.columnWidths !== false) {
        ws['!cols'] = mapping.columns.map(col => ({
          wch: col.width || 15,
        }));
      }

      if (options.freezeHeader !== false) {
        ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      }

      if (options.autoFilter !== false) {
        ws['!autofilter'] = {
          ref: XLSX.utils.encode_range({
            s: { c: 0, r: 0 },
            e: { c: mapping.columns.length - 1, r: invoices.length },
          }),
        };
      }

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });

    // Write file
    XLSX.writeFile(wb, filename);
  }

  /**
   * Generate filename with timestamp
   */
  private static generateFilename(invoiceType: InvoiceType): string {
    const timestamp = new Date().toISOString().split('T')[0];
    const typePrefix = invoiceType.replace('_', '-');
    return `${typePrefix}-invoices_${timestamp}.xlsx`;
  }

  /**
   * Validate invoices before export
   */
  static validateInvoicesForExport(
    invoices: Invoice[],
    invoiceType: InvoiceType
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const mapping = ColumnMappingService.getMapping(invoiceType);

    invoices.forEach((invoice, index) => {
      const validation = ColumnMappingService.validateRow(invoice, mapping);
      if (!validation.valid) {
        errors.push(
          `Row ${index + 1}: Missing required fields: ${validation.missingFields.join(', ')}`
        );
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get export summary
   */
  static getExportSummary(
    invoices: Invoice[],
    invoiceType: InvoiceType
  ): {
    totalRecords: number;
    totalAmount: number;
    invoiceType: string;
    columns: number;
  } {
    const mapping = ColumnMappingService.getMapping(invoiceType);
    const totalAmount = invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);

    return {
      totalRecords: invoices.length,
      totalAmount,
      invoiceType: mapping.description,
      columns: mapping.columns.length,
    };
  }
}

export default ExcelExportService;

