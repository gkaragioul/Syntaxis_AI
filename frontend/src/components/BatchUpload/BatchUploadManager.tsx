/**
 * Batch Upload Manager Component
 * Handles batch upload, processing, and Excel export of invoices
 */

import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { BatchProcessingService, BatchJob } from '../../services/batchProcessingService';
import { InvoiceTypeDetector, InvoiceType } from '../../services/invoiceTypeDetector';
import { ExcelExportService } from '../../services/excelExportService';
import { ColumnMappingService } from '../../services/columnMappingService';
import type { Invoice } from '../../services/invoiceStorage';

export const BatchUploadManager: React.FC = () => {
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('standard');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [currentBatchJob, setCurrentBatchJob] = useState<BatchJob | null>(null);
  const [minConfidence, setMinConfidence] = useState(0.7);
  const [enforceTypeConsistency, setEnforceTypeConsistency] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Review & Fix drawer state
  const [reviewingInvoice, setReviewingInvoice] = useState<Invoice | null>(null);
  const [editForm, setEditForm] = useState<Partial<Invoice>>({});

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
  };

  const handleStartBatch = async () => {
    if (selectedFiles.length === 0) {
      toast.error('Please select at least one file');
      return;
    }

    try {
      setIsProcessing(true);
      setProgress(0);

      // Create batch job
      const batchJob = BatchProcessingService.createBatchJob(
        selectedFiles,
        invoiceType,
        {
          enforceTypeConsistency,
          minConfidenceScore: minConfidence,
        }
      );

      setCurrentBatchJob(batchJob);
      toast.loading(`Processing ${selectedFiles.length} files...`);

      // Process batch
      const completedJob = await BatchProcessingService.processBatch(
        batchJob.id,
        selectedFiles,
        {
          enforceTypeConsistency,
          minConfidenceScore: minConfidence,
        },
        (prog, message) => {
          setProgress(prog);
          setProgressMessage(message);
        }
      );

      setCurrentBatchJob(completedJob);

      // Show summary
      const summary = BatchProcessingService.getBatchSummary(batchJob.id);
      if (summary) {
        toast.success(
          `Batch complete: ${summary.processedFiles}/${summary.totalFiles} processed`
        );
      }

      // Redirect to Detail Page for Analysis Review
      navigate(`/batch/${completedJob.id}`);

      // Reset
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Batch processing failed';
      toast.error(message);
      console.error('Batch processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExportToExcel = () => {
    if (!currentBatchJob || currentBatchJob.invoices.length === 0) {
      toast.error('No invoices to export');
      return;
    }

    try {
      ExcelExportService.exportToExcel(
        currentBatchJob.invoices,
        currentBatchJob.invoiceType,
        {
          filename: `${currentBatchJob.name}.xlsx`,
          freezeHeader: true,
          autoFilter: true,
          columnWidths: true,
        }
      );
      toast.success('Invoices exported to Excel');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      toast.error(message);
      console.error('Export error:', error);
    }
  };

  // Review drawer handlers
  const handleOpenReview = (inv: Invoice) => {
    setReviewingInvoice(inv);
    setEditForm({
      invoiceNumber: inv.invoiceNumber || '',
      vendorName: inv.vendorName || '',
      invoiceDate: inv.invoiceDate || '',
      dueDate: inv.dueDate || '',
      subtotal: inv.subtotal,
      taxAmount: inv.taxAmount,
      totalAmount: inv.totalAmount,
    });
  };

  const handleEditChange = (field: keyof Invoice, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveAndRevalidate = async () => {
    if (!currentBatchJob || !reviewingInvoice) return;
    try {
      const updatedJob = await BatchProcessingService.revalidateInvoice(
        currentBatchJob.id,
        reviewingInvoice.id,
        editForm
      );
      setCurrentBatchJob({ ...updatedJob });
      toast.success('Invoice updated and re-validated');
      setReviewingInvoice(null);
    } catch (e) {
      toast.error('Failed to re-validate invoice');
      console.error(e);
    }
  };

  const handleValidateBeforeExport = () => {
    if (!currentBatchJob) {
      toast.error('No batch job to validate');
      return;
    }

    const validated = currentBatchJob.validatedInvoices?.length || 0;
    const needs = currentBatchJob.needsReviewInvoices?.length || 0;
    const failed = currentBatchJob.failedFiles || 0;

    if (currentBatchJob.exportable) {
      toast.success(`Ready to export: ${validated} validated, ${needs} needs review, ${failed} failed`);
    } else {
      toast.error(`Not ready: ${validated} validated, ${needs} needs review, ${failed} failed. Fix issues before export.`);
    }
  };


  const invoiceTypes = InvoiceTypeDetector.getSupportedTypes();
  const mapping = ColumnMappingService.getMapping(invoiceType);

  return (
    <div className="bg-white rounded-lg shadow p-6 max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold mb-6">Batch Invoice Upload & Export</h2>

      {/* File Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select PDF Files
        </label>
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-500 transition">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Click to select files
          </button>
          <p className="text-gray-500 text-sm mt-2">or drag and drop PDF files</p>
          {selectedFiles.length > 0 && (
            <p className="text-green-600 font-medium mt-2">
              {selectedFiles.length} file(s) selected
            </p>
          )}
        </div>
      </div>

      {/* Invoice Type Selection */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Invoice Type
          </label>
          <select
            value={invoiceType}
            onChange={(e) => setInvoiceType(e.target.value as InvoiceType)}
            disabled={isProcessing}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500"
          >
            {invoiceTypes.map((type) => (
              <option key={type} value={type}>
                {InvoiceTypeDetector.getTypeName(type)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Min. Confidence: {(minConfidence * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={minConfidence}
            onChange={(e) => setMinConfidence(parseFloat(e.target.value))}
            disabled={isProcessing}
            className="w-full"
          />
        </div>
      </div>

      {/* Options */}
      <div className="mb-6">
        <label className="flex items-center">
          <input
            type="checkbox"
            checked={enforceTypeConsistency}
            onChange={(e) => setEnforceTypeConsistency(e.target.checked)}
            disabled={isProcessing}
            className="rounded"
          />
          <span className="ml-2 text-sm text-gray-700">
            Enforce type consistency (all invoices must match selected type)
          </span>
        </label>
      </div>

      {/* Column Preview */}
      <div className="mb-6 bg-gray-50 p-4 rounded">
        <h3 className="font-medium text-gray-900 mb-2">Export Columns:</h3>
        <div className="flex flex-wrap gap-2">
          {mapping.columns.map((col) => (
            <span
              key={col.key}
              className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs"
            >
              {col.header}
              {col.required && <span className="text-red-600 ml-1">*</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">{progressMessage}</span>
            <span className="text-sm font-medium text-gray-700">{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Batch Summary */}
      {currentBatchJob && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded p-4">
          <h3 className="font-medium text-blue-900 mb-2">Batch Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Total Files:</span>
              <span className="ml-2 font-medium">{currentBatchJob.totalFiles}</span>
            </div>
            <div>
              <span className="text-gray-600">Processed:</span>
              <span className="ml-2 font-medium text-green-600">{currentBatchJob.processedFiles}</span>
            </div>
            <div>
              <span className="text-gray-600">Failed:</span>
              <span className="ml-2 font-medium text-red-600">{currentBatchJob.failedFiles}</span>
            </div>
            <div>
              <span className="text-gray-600">Type:</span>
              <span className="ml-2 font-medium">
                {InvoiceTypeDetector.getTypeName(currentBatchJob.invoiceType)}
              </span>
            </div>
          </div>

          {currentBatchJob.errors.length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded p-3">
              <h4 className="font-medium text-red-900 mb-2">Errors:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                {currentBatchJob.errors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>
                    {err.filename}: {err.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Validation Results */}
      {currentBatchJob && (currentBatchJob.validatedInvoices || currentBatchJob.needsReviewInvoices) && (
        <div className="mb-6 bg-gray-50 border border-gray-200 rounded p-4">
          <h3 className="font-medium text-gray-900 mb-3">Validation Results</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-green-600">✓</span>
                <span className="font-medium">Validated</span>
                <span className="ml-2 text-gray-600">({currentBatchJob.validatedInvoices?.length || 0})</span>
              </div>
              <ul className="space-y-1 max-h-40 overflow-auto pr-2">
                {(currentBatchJob.validatedInvoices || []).slice(0, 10).map(inv => (
                  <li key={inv.id} className="flex justify-between">
                    <span className="truncate">
                      {(inv.invoiceNumber || inv.filename) as string} — {inv.vendorName}
                    </span>
                    <span className="text-gray-600 ml-2">{Math.round((inv.confidenceScore || 0) * 100)}%</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-yellow-600">⚠</span>
                <span className="font-medium">Needs Review</span>
                <span className="ml-2 text-gray-600">({currentBatchJob.needsReviewInvoices?.length || 0})</span>
              </div>
              <ul className="space-y-1 max-h-40 overflow-auto pr-2">
                {(currentBatchJob.needsReviewInvoices || []).slice(0, 10).map(inv => (
                  <li key={inv.id} className="flex justify-between items-center">
                    <span className="truncate">
                      {(inv.invoiceNumber || inv.filename) as string} — {inv.vendorName}
                    </span>
                    <div className="flex items-center gap-2 ml-2">
                      <span className="text-gray-600">{Math.round((inv.confidenceScore || 0) * 100)}%</span>
                      <button
                        className="text-blue-600 hover:underline"
                        onClick={() => handleOpenReview(inv)}
                      >
                        Review
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {!currentBatchJob.exportable && (
            <p className="mt-3 text-sm text-gray-700">
              Export is disabled until all invoices are validated. Fix items in "Needs Review".
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={handleStartBatch}
          disabled={isProcessing || selectedFiles.length === 0}
          className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          {isProcessing ? 'Processing...' : 'Start Batch Processing'}
        </button>

        <button
          onClick={handleValidateBeforeExport}
          disabled={!currentBatchJob || currentBatchJob.invoices.length === 0}
          className="bg-yellow-600 text-white px-4 py-2 rounded-md hover:bg-yellow-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          Validate
        </button>

        <button
          onClick={handleExportToExcel}
          disabled={!currentBatchJob || !currentBatchJob.exportable || currentBatchJob.invoices.length === 0}
          className="flex-1 bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
        >
          Export to Excel
        </button>
      </div>
      {/* Review & Fix Drawer */}
      {reviewingInvoice && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setReviewingInvoice(null)} />
          <div className="absolute right-0 top-0 h-full w-full sm:w-[28rem] bg-white shadow-xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Review & Fix</h3>
              <button className="text-gray-600" onClick={() => setReviewingInvoice(null)}>✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-gray-600">Invoice Number</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={String(editForm.invoiceNumber ?? '')} onChange={e => handleEditChange('invoiceNumber', e.target.value)} />
              </div>
              <div>
                <label className="block text-sm text-gray-600">Vendor</label>
                <input className="mt-1 w-full border rounded px-2 py-1" value={String(editForm.vendorName ?? '')} onChange={e => handleEditChange('vendorName', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600">Invoice Date</label>
                  <input className="mt-1 w-full border rounded px-2 py-1" value={String(editForm.invoiceDate ?? '')} onChange={e => handleEditChange('invoiceDate', e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Due Date</label>
                  <input className="mt-1 w-full border rounded px-2 py-1" value={String(editForm.dueDate ?? '')} onChange={e => handleEditChange('dueDate', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm text-gray-600">Subtotal</label>
                  <input className="mt-1 w-full border rounded px-2 py-1" value={String(editForm.subtotal ?? '')} onChange={e => handleEditChange('subtotal' as any, e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Tax</label>
                  <input className="mt-1 w-full border rounded px-2 py-1" value={String(editForm.taxAmount ?? '')} onChange={e => handleEditChange('taxAmount' as any, e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm text-gray-600">Total</label>
                  <input className="mt-1 w-full border rounded px-2 py-1" value={String(editForm.totalAmount ?? '')} onChange={e => handleEditChange('totalAmount' as any, e.target.value)} />
                </div>
              </div>

              {reviewingInvoice.validationErrors && reviewingInvoice.validationErrors.length > 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-sm text-yellow-800">
                  <div className="font-medium mb-1">Current Issues</div>
                  <ul className="list-disc list-inside space-y-0.5">
                    {reviewingInvoice.validationErrors.map((err, idx) => (
                      <li key={idx}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button onClick={handleSaveAndRevalidate} className="flex-1 bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700">Save & Re-validate</button>
                <button onClick={() => setReviewingInvoice(null)} className="px-3 py-2 border rounded">Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default BatchUploadManager;

