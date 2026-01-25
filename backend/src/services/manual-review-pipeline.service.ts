// @ts-nocheck

import { PrismaClient } from '@prisma/client';
import { ManualReviewComponentService } from './manual-review-component.service';
import { InvoiceProcessingService } from './InvoiceProcessingService';
import { logger } from '../utils/logger';

export interface PipelineIntegrationOptions {
  confidenceThreshold: number;
  autoCreateReviewTasks?: boolean;
  includeValidationFailures?: boolean;
  priorityRules?: {
    highValueThreshold?: number;
    lowConfidenceThreshold?: number;
  };
}

export interface PipelineIntegrationResult {
  requiresReview: boolean;
  reviewTaskCreated: boolean;
  reviewTaskId?: string;
  priority: 'high' | 'medium' | 'low' | 'none';
  reason: string;
  estimatedReviewTime?: number;
  fieldsRequiringReview?: string[];
  nextStage: 'manual_review' | 'processing' | 'rejected';
}

export interface ReviewCompletionOptions {
  approved: boolean;
  finalConfidence?: number;
  reviewNotes?: string;
  rejectionReason?: string;
  continueProcessing?: boolean;
}

export interface ReviewCompletionResult {
  success: boolean;
  invoiceId: string;
  nextStage: 'processing' | 'rejected' | 'completed';
  updatedConfidence?: number;
  processingContinued: boolean;
  rejectionReason?: string;
}

export interface ReviewPipelineStatus {
  totalInvoicesInReview: number;
  completedReviews: number;
  pendingReviews: number;
  averageReviewTime: number;
  priorityBreakdown: {
    high: number;
    medium: number;
    low: number;
  };
  throughputMetrics: {
    reviewsPerDay: number;
    averageConfidence: number;
  };
}

export class ManualReviewPipelineService {
  constructor(
    private prisma: PrismaClient,
    private manualReviewService: ManualReviewComponentService,
    private processingService: InvoiceProcessingService,
  ) {}

  async integrateWithProcessingPipeline(
    invoiceId: string,
    options: PipelineIntegrationOptions,
  ): Promise<PipelineIntegrationResult> {
    try {
      // Get invoice details
      const invoice = await this.prisma.invoice.findUnique({
        where: { id: invoiceId },
        include: {
          validationResults: true,
        },
      });

      if (!invoice) {
        throw new Error('Invoice not found');
      }

      // Determine if review is required
      const reviewDecision = this.determineReviewRequirement(invoice, options);

      if (!reviewDecision.requiresReview) {
        return {
          requiresReview: false,
          reviewTaskCreated: false,
          priority: 'none',
          reason: reviewDecision.reason,
          nextStage: 'processing',
        };
      }

      // Create review task if auto-creation is enabled
      let reviewTaskId: string | undefined;
      let estimatedReviewTime: number | undefined;
      let fieldsRequiringReview: string[] | undefined;

      if (options.autoCreateReviewTasks) {
        const reviewTaskResult =
          await this.manualReviewService.createReviewTask(invoiceId, {
            priority: reviewDecision.priority,
            reviewType: this.getReviewType(reviewDecision.reason),
            instructions: this.getReviewInstructions(reviewDecision.reason),
            dueDate: this.calculateDueDate(reviewDecision.priority),
          });

        if (reviewTaskResult.success) {
          reviewTaskId = reviewTaskResult.reviewTaskId;
          estimatedReviewTime = reviewTaskResult.estimatedReviewTime;
          fieldsRequiringReview = reviewTaskResult.fieldsRequiringReview;

          // Update invoice status to indicate it's under review
          await this.prisma.invoice.update({
            where: { id: invoiceId },
            data: { status: 'under_review' },
          });
        }
      }

      return {
        requiresReview: true,
        reviewTaskCreated: !!reviewTaskId,
        reviewTaskId,
        priority: reviewDecision.priority,
        reason: reviewDecision.reason,
        estimatedReviewTime,
        fieldsRequiringReview,
        nextStage: 'manual_review',
      };
    } catch (error) {
      logger.error('Failed to integrate invoice with review pipeline', {
        error,
        invoiceId,
      });
      throw error;
    }
  }

  async processReviewCompletion(
    reviewTaskId: string,
    options: ReviewCompletionOptions,
  ): Promise<ReviewCompletionResult> {
    try {
      // Get review task and associated invoice
      const reviewTask = await this.prisma.reviewTask.findUnique({
        where: { id: reviewTaskId },
        include: { invoice: true },
      });

      if (!reviewTask) {
        throw new Error('Review task not found');
      }

      const invoiceId = reviewTask.invoiceId;

      if (options.approved) {
        // Update invoice with review results
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'validated',
            extractionConfidence: options.finalConfidence,
            validationStatus: 'passed',
          },
        });

        // Continue processing if requested
        let processingContinued = false;
        if (options.continueProcessing) {
          // Here we would trigger the next stage of processing
          // For now, we'll just mark it as ready for processing
          processingContinued = true;
        }

        return {
          success: true,
          invoiceId,
          nextStage: 'processing',
          updatedConfidence: options.finalConfidence,
          processingContinued,
        };
      } else {
        // Handle rejection
        await this.prisma.invoice.update({
          where: { id: invoiceId },
          data: {
            status: 'rejected',
            validationStatus: 'failed',
          },
        });

        return {
          success: true,
          invoiceId,
          nextStage: 'rejected',
          processingContinued: false,
          rejectionReason: options.rejectionReason,
        };
      }
    } catch (error) {
      logger.error('Failed to process review completion', {
        error,
        reviewTaskId,
      });
      throw error;
    }
  }

  async getReviewPipelineStatus(userId: string): Promise<ReviewPipelineStatus> {
    try {
      // Get invoices in review
      const invoicesInReview = await this.prisma.invoice.findMany({
        where: {
          userId,
          status: 'under_review',
        },
      });

      // Get all review tasks for the user
      const reviewTasks = await this.prisma.reviewTask.findMany({
        where: {
          invoice: { userId },
        },
        include: {
          invoice: true,
        },
      });

      const pendingTasks = reviewTasks.filter(
        (task) => task.status === 'pending',
      );
      const completedTasks = reviewTasks.filter(
        (task) => task.status === 'completed',
      );

      // Calculate average review time
      const completedTasksWithTime = completedTasks.filter(
        (task) => task.completedAt && task.createdAt,
      );
      const averageReviewTime =
        completedTasksWithTime.length > 0
          ? completedTasksWithTime.reduce((sum, task) => {
              const reviewTime =
                task.completedAt!.getTime() - task.createdAt.getTime();
              return sum + reviewTime;
            }, 0) / completedTasksWithTime.length
          : 0;

      // Priority breakdown
      const priorityBreakdown = {
        high: reviewTasks.filter((task) => task.priority === 'high').length,
        medium: reviewTasks.filter((task) => task.priority === 'medium').length,
        low: reviewTasks.filter((task) => task.priority === 'low').length,
      };

      // Calculate throughput metrics
      const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recentCompletedTasks = completedTasks.filter(
        (task) => task.completedAt && task.completedAt > last7Days,
      );
      const reviewsPerDay = recentCompletedTasks.length / 7;

      // Average confidence of invoices in review
      const averageConfidence =
        invoicesInReview.length > 0
          ? invoicesInReview.reduce(
              (sum, inv) =>
                sum + this.getNumericValue(inv.extractionConfidence),
              0,
            ) / invoicesInReview.length
          : 0;

      return {
        totalInvoicesInReview: invoicesInReview.length,
        completedReviews: completedTasks.length,
        pendingReviews: pendingTasks.length,
        averageReviewTime,
        priorityBreakdown,
        throughputMetrics: {
          reviewsPerDay,
          averageConfidence,
        },
      };
    } catch (error) {
      logger.error('Failed to get review pipeline status', { error, userId });
      throw error;
    }
  }

  private determineReviewRequirement(
    invoice: any,
    options: PipelineIntegrationOptions,
  ): {
    requiresReview: boolean;
    priority: 'high' | 'medium' | 'low';
    reason: string;
  } {
    const confidence = this.getNumericValue(invoice.extractionConfidence);
    const amount = this.getNumericValue(invoice.totalAmount);
    const validationStatus = invoice.validationStatus;

    // Check validation failures first
    if (options.includeValidationFailures && validationStatus === 'failed') {
      return {
        requiresReview: true,
        priority: 'high',
        reason: 'Validation failed',
      };
    }

    // Check high-value invoices
    const highValueThreshold =
      options.priorityRules?.highValueThreshold || 10000;
    if (
      amount > highValueThreshold &&
      confidence < options.confidenceThreshold
    ) {
      return {
        requiresReview: true,
        priority: 'high',
        reason: 'High value invoice with moderate confidence',
      };
    }

    // Check low confidence
    const lowConfidenceThreshold =
      options.priorityRules?.lowConfidenceThreshold || 0.5;
    if (confidence < lowConfidenceThreshold) {
      return {
        requiresReview: true,
        priority: 'high',
        reason: 'Very low extraction confidence',
      };
    }

    // Check moderate confidence
    if (confidence < options.confidenceThreshold) {
      return {
        requiresReview: true,
        priority: 'medium',
        reason: 'Low extraction confidence',
      };
    }

    // High confidence - no review needed
    return {
      requiresReview: false,
      priority: 'low',
      reason: 'High confidence extraction',
    };
  }

  private getReviewType(reason: string): string {
    if (reason.includes('High value')) {
      return 'high_value_review';
    }
    if (reason.includes('confidence')) {
      return 'confidence_review';
    }
    if (reason.includes('validation')) {
      return 'validation_review';
    }
    return 'general_review';
  }

  private getReviewInstructions(reason: string): string {
    if (reason.includes('High value')) {
      return 'Review high-value invoice for accuracy';
    }
    if (reason.includes('confidence')) {
      return 'Review fields with low extraction confidence';
    }
    if (reason.includes('validation')) {
      return 'Review and correct validation errors';
    }
    return 'General review required';
  }

  private calculateDueDate(priority: 'high' | 'medium' | 'low'): Date {
    const now = new Date();
    const hoursToAdd =
      priority === 'high' ? 4 : priority === 'medium' ? 24 : 72;
    return new Date(now.getTime() + hoursToAdd * 60 * 60 * 1000);
  }

  private getNumericValue(value: any): number {
    if (value === null || value === undefined) {
      return 0;
    }
    // Handle Prisma Decimal type
    if (typeof value === 'object' && typeof value.toNumber === 'function') {
      return value.toNumber();
    }
    // Handle regular number
    if (typeof value === 'number') {
      return value;
    }
    return 0;
  }
}
