/**
 * Export Service
 * Handles exporting invoices to CSV and PDF formats
 */

import { jsPDF } from 'jspdf';
import Papa from 'papaparse';
import { Invoice } from './invoiceStorage';

export class ExportService {
  /**
   * Export invoices to CSV
   */
  static exportToCSV(invoices: Invoice[], filename: string = 'invoices.csv'): void {
    const data = invoices.map(invoice => ({
      'Invoice Number': invoice.invoiceNumber || '',
      'Vendor Name': invoice.vendorName || '',
      'Invoice Date': invoice.invoiceDate || '',
      'Due Date': invoice.dueDate || '',
      'Subtotal': invoice.subtotal || '',
      'Tax Amount': invoice.taxAmount || '',
      'Total Amount': invoice.totalAmount || '',
      'Status': invoice.status || '',
      'Confidence': invoice.confidenceScore ? (invoice.confidenceScore * 100).toFixed(1) + '%' : '',
      'Notes': invoice.notes || '',
    }));

    const csv = Papa.unparse(data);
    this.downloadFile(csv, filename, 'text/csv');
  }

  /**
   * Export single invoice to PDF
   */
  static exportToPDF(invoice: Invoice, filename: string = 'invoice.pdf'): void {
    const doc = new jsPDF();
    let yPosition = 20;

    // Title
    doc.setFontSize(16);
    doc.text('Invoice', 20, yPosition);
    yPosition += 15;

    // Invoice details
    doc.setFontSize(11);
    const details = [
      ['Invoice Number:', invoice.invoiceNumber || 'N/A'],
      ['Vendor Name:', invoice.vendorName || 'N/A'],
      ['Invoice Date:', invoice.invoiceDate || 'N/A'],
      ['Due Date:', invoice.dueDate || 'N/A'],
      ['Status:', invoice.status || 'N/A'],
    ];

    details.forEach(([label, value]) => {
      doc.text(`${label} ${value}`, 20, yPosition);
      yPosition += 8;
    });

    yPosition += 5;

    // Amount information
    doc.setFontSize(12);
    doc.text('Amount Information', 20, yPosition);
    yPosition += 8;

    doc.setFontSize(11);
    const amounts = [
      ['Subtotal:', `$${(invoice.subtotal || 0).toFixed(2)}`],
      ['Tax Amount:', `$${(invoice.taxAmount || 0).toFixed(2)}`],
      ['Total Amount:', `$${(invoice.totalAmount || 0).toFixed(2)}`],
    ];

    amounts.forEach(([label, value]) => {
      doc.text(`${label} ${value}`, 20, yPosition);
      yPosition += 8;
    });

    // Notes
    if (invoice.notes) {
      yPosition += 5;
      doc.setFontSize(12);
      doc.text('Notes', 20, yPosition);
      yPosition += 8;

      doc.setFontSize(11);
      const noteLines = doc.splitTextToSize(invoice.notes, 170);
      doc.text(noteLines, 20, yPosition);
    }

    // Save PDF
    doc.save(filename);
  }

  /**
   * Export multiple invoices to PDF
   */
  static exportMultipleToPDF(invoices: Invoice[], filename: string = 'invoices.pdf'): void {
    const doc = new jsPDF();
    let pageNumber = 1;

    invoices.forEach((invoice, index) => {
      if (index > 0) {
        doc.addPage();
        pageNumber++;
      }

      let yPosition = 20;

      // Title
      doc.setFontSize(16);
      doc.text('Invoice', 20, yPosition);
      yPosition += 15;

      // Invoice details
      doc.setFontSize(11);
      const details = [
        ['Invoice Number:', invoice.invoiceNumber || 'N/A'],
        ['Vendor Name:', invoice.vendorName || 'N/A'],
        ['Invoice Date:', invoice.invoiceDate || 'N/A'],
        ['Due Date:', invoice.dueDate || 'N/A'],
        ['Status:', invoice.status || 'N/A'],
      ];

      details.forEach(([label, value]) => {
        doc.text(`${label} ${value}`, 20, yPosition);
        yPosition += 8;
      });

      yPosition += 5;

      // Amount information
      doc.setFontSize(12);
      doc.text('Amount Information', 20, yPosition);
      yPosition += 8;

      doc.setFontSize(11);
      const amounts = [
        ['Subtotal:', `$${(invoice.subtotal || 0).toFixed(2)}`],
        ['Tax Amount:', `$${(invoice.taxAmount || 0).toFixed(2)}`],
        ['Total Amount:', `$${(invoice.totalAmount || 0).toFixed(2)}`],
      ];

      amounts.forEach(([label, value]) => {
        doc.text(`${label} ${value}`, 20, yPosition);
        yPosition += 8;
      });

      // Page number
      doc.setFontSize(10);
      doc.text(`Page ${pageNumber}`, 20, 280);
    });

    doc.save(filename);
  }

  /**
   * Download file helper
   */
  private static downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Generate filename with timestamp
   */
  static generateFilename(prefix: string, extension: string): string {
    const timestamp = new Date().toISOString().split('T')[0];
    return `${prefix}_${timestamp}.${extension}`;
  }
}

export default ExportService;

