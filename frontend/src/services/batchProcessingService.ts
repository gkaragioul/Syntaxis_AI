/**
 * Batch Processing Service
 * Handles batch upload, processing, and export of invoices
 * Ensures all invoices in a batch are of the same type
 */

import { Invoice } from './invoiceStorage';
import { InvoiceType, InvoiceTypeDetector } from './invoiceTypeDetector';
import { ocrService } from './ocrService';
import { invoiceStorage } from './invoiceStorage';
import { v4 as uuidv4 } from 'uuid';
import AnchorExtractionService from './anchorExtractionService';
import ValidationService, { parseAmount } from './validationService';
import ReliabilityEnhancer from './reliabilityEnhancer';

export interface BatchJob {
  id: string;
  name: string;
  invoiceType: InvoiceType;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  totalFiles: number;
  processedFiles: number;
  failedFiles: number;
  invoices: Invoice[];
  validatedInvoices: Invoice[];
  needsReviewInvoices: Invoice[];
  errors: BatchError[];
  createdAt: Date;
  completedAt?: Date;
  // Sprint 1
  minConfidenceScore: number; // 0..1
  exportable: boolean;
}

export interface BatchError {
  filename: string;
  error: string;
  timestamp: Date;
}

export interface BatchProcessingOptions {
  enforceTypeConsistency?: boolean;
  minConfidenceScore?: number;
  autoRetry?: boolean;
  maxRetries?: number;
}

export class BatchProcessingService {
  private static jobs: Map<string, BatchJob> = new Map();

  /**
   * Create a new batch job
   */
  static createBatchJob(
    files: File[],
    invoiceType?: InvoiceType,
    _options: BatchProcessingOptions = {}
  ): BatchJob {
    const jobId = uuidv4();
    const minC = _options.minConfidenceScore ?? 0.7;
    const job: BatchJob = {
      id: jobId,
      name: `Batch_${new Date().toISOString().split('T')[0]}_${jobId.substring(0, 8)}`,
      invoiceType: invoiceType || 'standard',
      status: 'pending',
      totalFiles: files.length,
      processedFiles: 0,
      failedFiles: 0,
      invoices: [],
      validatedInvoices: [],
      needsReviewInvoices: [],
      errors: [],
      createdAt: new Date(),
      completedAt: undefined,
      minConfidenceScore: minC,
      exportable: false,
    };

    this.jobs.set(jobId, job);
    return job;
  }

  /**
   * Process batch of files
   */
  static async processBatch(
    jobId: string,
    files: File[],
    options: BatchProcessingOptions = {},
    onProgress?: (progress: number, message: string) => void
  ): Promise<BatchJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`Batch job ${jobId} not found`);
    }

    job.status = 'processing';
    const { enforceTypeConsistency = true } = options;

    // Load existing invoices once for duplicate detection
    let existingInvoices: Invoice[] = [];
    try {
      const existing = await invoiceStorage.list({ page: 1, limit: 10000 });
      existingInvoices = existing.invoices || [];
    } catch (e) {
      console.warn('Could not load existing invoices for duplicate detection');
    }

    let processedCount = 0;

    for (const file of files) {
      try {
        onProgress?.(
          (processedCount / files.length) * 100,
          `Processing ${file.name}...`
        );

        // Process invoice (text + layout)
        const extractedData = await ocrService.processInvoice(file);

        // Detect invoice type
        const typeDetection = InvoiceTypeDetector.detectType(extractedData.rawText);

        // Check type consistency
        if (enforceTypeConsistency && typeDetection.type !== job.invoiceType) {
          if (typeDetection.confidence < 0.7) {
            console.warn(`Type detection low confidence for ${file.name}, using batch type ${job.invoiceType}`);
          } else {
            // High-confidence mismatch: record error and skip
            job.errors.push({
              filename: file.name,
              error: `Invoice type mismatch: Expected ${job.invoiceType}, got ${typeDetection.type}`,
              timestamp: new Date(),
            });
            job.failedFiles++;
            processedCount++;
            continue;
          }
        }

        // Anchor-based extraction (pass 1)
        let anchorRes = AnchorExtractionService.extractFields(
          extractedData.rawText,
          extractedData.layout,
          job.invoiceType
        );
        // If we got a vendor candidate, try vendor-specific anchors (pass 2)
        const vendorCandidate = anchorRes.fields.vendorName || extractedData.vendorName;
        if (vendorCandidate) {
          const refined = AnchorExtractionService.extractFields(
            extractedData.rawText,
            extractedData.layout,
            job.invoiceType,
            vendorCandidate
          );
          // Prefer refined values/confidence when present
          const mergedFields = { ...anchorRes.fields, ...refined.fields } as any;
          const mergedConf: Record<string, number> = { ...anchorRes.fieldConfidence };
          for (const k of Object.keys(refined.fieldConfidence)) {
            mergedConf[k] = Math.max(refined.fieldConfidence[k], mergedConf[k] || 0);
          }
          anchorRes = { fields: mergedFields, fieldConfidence: mergedConf } as any;
        }

        // Reliability enhancement: if key fields missing/low-confidence, try enhanced OCR pass
        const lowOrMissing = (k: string) => !((anchorRes.fields as any)[k]) || ((anchorRes.fieldConfidence[k] || 0) < job.minConfidenceScore);
        if (lowOrMissing('invoiceNumber') || lowOrMissing('invoiceDate') || lowOrMissing('totalAmount')) {
          try {
            const vendorName = (anchorRes.fields.vendorName as string) || extractedData.vendorName;
            const enh = await ReliabilityEnhancer.improveFullPageText(
              file,
              extractedData.rawText,
              job.invoiceType,
              vendorName
            );
            if (enh.improvedText && enh.extracted) {
              for (const [k, v] of Object.entries(enh.extracted.fields)) {
                if (v == null) continue;
                const oldConf = anchorRes.fieldConfidence[k] || 0;
                const newConf = enh.extracted.fieldConfidence[k] || 0;
                if (!(anchorRes.fields as any)[k] || newConf >= Math.max(oldConf, job.minConfidenceScore)) {
                  (anchorRes.fields as any)[k] = v as any;
                  anchorRes.fieldConfidence[k] = Math.max(newConf, oldConf);
                }
              }
              // Update raw text for downstream type detection and logging
              extractedData.rawText = enh.improvedText;
            }
          } catch (e) {
            console.warn('Reliability enhancement failed', e);
          }
        }

        // Merge OCR + anchored fields, normalizing amounts
        const invoice: Invoice = {
          id: uuidv4(),
          filename: file.name,
          invoiceNumber: anchorRes.fields.invoiceNumber || extractedData.invoiceNumber,
          vendorName: anchorRes.fields.vendorName || extractedData.vendorName,
          invoiceDate: anchorRes.fields.invoiceDate || extractedData.invoiceDate,
          dueDate: anchorRes.fields.dueDate || extractedData.dueDate,
          subtotal: anchorRes.fields.subtotal !== undefined ? parseAmount(anchorRes.fields.subtotal as any) : extractedData.subtotal,
          taxAmount: anchorRes.fields.taxAmount !== undefined ? parseAmount(anchorRes.fields.taxAmount as any) : extractedData.taxAmount,
          totalAmount: anchorRes.fields.totalAmount !== undefined ? parseAmount(anchorRes.fields.totalAmount as any) : extractedData.totalAmount,
          status: 'processing',
          confidenceScore: extractedData.confidence,
          notes: `Batch: ${job.name}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          invoiceType: job.invoiceType,
          fieldConfidence: { ...anchorRes.fieldConfidence },
        };

        // Validate with quality gates
        const vres = ValidationService.validateInvoice(invoice, {
          amountTolerance: 0.01,
          minConfidenceThreshold: job.minConfidenceScore,
          existingInvoices,
          batchInvoices: job.invoices,
        });

        invoice.validationErrors = vres.errors;
        invoice.fieldConfidence = vres.fieldConfidence;
        invoice.confidenceScore = vres.qualityScore;

        // Categorize
        const category = vres.valid ? 'validated' : (vres.requiredFieldsPassed ? 'needs_review' : 'failed');
        if (category === 'validated') {
          invoice.status = 'completed';
          job.validatedInvoices.push(invoice);
        } else if (category === 'needs_review') {
          invoice.status = 'processing';
          job.needsReviewInvoices.push(invoice);
        } else {
          invoice.status = 'failed';
          job.failedFiles++;
          job.errors.push({ filename: file.name, error: 'Validation failed: ' + vres.errors.join('; '), timestamp: new Date() });
        }

        // Save invoice
        await invoiceStorage.create(invoice);
        job.invoices.push(invoice);
        job.processedFiles++;
        processedCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        job.errors.push({
          filename: file.name,
          error: errorMessage,
          timestamp: new Date(),
        });
        job.failedFiles++;
        processedCount++;
      }
    }

    job.exportable = job.failedFiles === 0 && job.needsReviewInvoices.length === 0;
    job.status = 'completed';
    job.completedAt = new Date();

    onProgress?.(100, 'Batch processing completed');

    return job;
  }

  /**
   * Revalidate a single invoice in a batch after user edits
   */
  static async revalidateInvoice(
    jobId: string,
    invoiceId: string,
    updates: Partial<Invoice>
  ): Promise<BatchJob> {
    const job = this.jobs.get(jobId);
    if (!job) throw new Error(`Batch job ${jobId} not found`);

    // Find invoice in job
    const invIdx = job.invoices.findIndex(i => i.id === invoiceId);
    if (invIdx === -1) throw new Error(`Invoice ${invoiceId} not found in job`);
    const invoice = job.invoices[invIdx];

    // Apply updates with normalization
    const num = (v: any) => (typeof v === 'number' ? v : parseAmount(v));
    const patch: Partial<Invoice> = { ...updates };
    if (patch.subtotal !== undefined) patch.subtotal = num(patch.subtotal);
    if (patch.taxAmount !== undefined) patch.taxAmount = num(patch.taxAmount);
    if (patch.totalAmount !== undefined) patch.totalAmount = num(patch.totalAmount);
    Object.assign(invoice, patch, { updatedAt: new Date().toISOString() });

    // Validate with existing batch context
    const vres = ValidationService.validateInvoice(invoice, {
      amountTolerance: 0.01,
      minConfidenceThreshold: job.minConfidenceScore,
      existingInvoices: [], // optional here
      batchInvoices: job.invoices.filter(i => i.id !== invoice.id),
    });

    invoice.validationErrors = vres.errors;
    invoice.confidenceScore = vres.qualityScore;
    invoice.status = vres.valid ? 'completed' : (vres.requiredFieldsPassed ? 'processing' : 'failed');

    // Move between categories
    job.validatedInvoices = job.validatedInvoices.filter(i => i.id !== invoice.id);
    job.needsReviewInvoices = job.needsReviewInvoices.filter(i => i.id !== invoice.id);
    if (invoice.status === 'completed') job.validatedInvoices.push(invoice);
    else if (invoice.status === 'processing') job.needsReviewInvoices.push(invoice);

    // Recompute exportable
    job.exportable = job.failedFiles === 0 && job.needsReviewInvoices.length === 0;

    // Persist
    await invoiceStorage.update(invoice.id, invoice);

    return job;
  }

  /**
   * Get batch job by ID
   */
  static getBatchJob(jobId: string): BatchJob | undefined {
    return this.jobs.get(jobId);
  }

  /**
   * Get all batch jobs
   */
  static getAllBatchJobs(): BatchJob[] {
    return Array.from(this.jobs.values());
  }

  /**
   * Get batch job summary
   */
  static getBatchSummary(jobId: string): {
    totalFiles: number;
    processedFiles: number;
    failedFiles: number;
    successRate: number;
    invoiceType: string;
    totalAmount: number;
  } | null {
    const job = this.jobs.get(jobId);
    if (!job) return null;

    const totalAmount = job.invoices.reduce((sum, inv) => sum + (inv.totalAmount || 0), 0);
    const successRate =
      job.totalFiles > 0 ? ((job.processedFiles / job.totalFiles) * 100).toFixed(1) : '0';

    return {
      totalFiles: job.totalFiles,
      processedFiles: job.processedFiles,
      failedFiles: job.failedFiles,
      successRate: parseFloat(successRate as string),
      invoiceType: job.invoiceType,
      totalAmount,
    };
  }

  /**
   * Clear batch job
   */
  static clearBatchJob(jobId: string): void {
    this.jobs.delete(jobId);
  }

  /**
   * Clear all batch jobs
   */
  static clearAllBatchJobs(): void {
    this.jobs.clear();
  }
}

export default BatchProcessingService;

