import { PrismaClient, Prisma } from '@prisma/client';
import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';

interface FieldUpdateResult {
  success: boolean;
  updatedValue?: any;
  validationResult?: FieldValidationResult;
  validationErrors?: string[];
  changeTracked?: boolean;
  changeId?: string;
}

interface MultiFieldUpdateResult {
  success: boolean;
  updatedFields: string[];
  validationResults: { [field: string]: FieldValidationResult };
  validationErrors?: { [field: string]: string[] };
  changeIds: string[];
}

interface LineItemResult {
  success: boolean;
  lineItem?: any;
  calculationValid?: boolean;
  validationErrors?: string[];
  deletedAmount?: number;
}

interface FieldValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
  suggestions?: string[];
  expectedAmount?: number;
  actualAmount?: number;
  discrepancy?: number;
}

interface LineItemCalculationResult {
  isValid: boolean;
  expectedAmount: number;
  actualAmount: number;
  discrepancy: number;
  errors: string[];
}

interface EnhancedInvoiceDetail {
  invoice: any;
  editingCapabilities: {
    canEdit: boolean;
    editableFields: string[];
    readOnlyFields: string[];
    editingRestrictions: string[];
  };
  validationInfo: {
    overallStatus: string;
    fieldValidations: { [field: string]: FieldValidationResult };
    businessRuleValidations: any[];
  };
  changeHistory: any[];
  draftChanges?: any;
}

interface UpdateOptions {
  validateField?: boolean;
  validateFields?: boolean;
  trackChanges?: boolean;
  continueOnError?: boolean;
  validateCalculation?: boolean;
  updateInvoiceTotal?: boolean;
}

interface BulkUpdateResult {
  success: boolean;
  updatedCount: number;
  failedUpdates: Array<{
    invoiceId: string;
    error: string;
  }>;
}

export class EnhancedInvoiceDetailService {
  private readonly editableFields = [
    'invoiceNumber',
    'invoiceDate',
    'dueDate',
    'vendorName',
    'vendorAddress',
    'vendorTaxId',
    'customerName',
    'customerAddress',
    'customerTaxId',
    'subtotal',
    'taxAmount',
    'totalAmount',
    'currency',
    'paymentTerms',
    'paymentStatus',
    'notes',
  ];

  private readonly readOnlyFields = [
    'id',
    'userId',
    'extractionId',
    'extractionConfidence',
    'templateId',
    'templateConfidence',
    'ocrQuality',
    'createdAt',
    'updatedAt',
  ];

  constructor(private prisma: PrismaClient) {}

  async getEnhancedInvoiceDetail(
    invoiceId: string,
    userId: string
  ): Promise<EnhancedInvoiceDetail> {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        file: true,
        user: { select: { id: true, email: true } },
        lineItems: {
          orderBy: { createdAt: 'asc' },
        },
        validationResults: {
          orderBy: { createdAt: 'desc' },
        },
        attachments: true,
      },
    });

    if (!invoice) {
      throw new ValidationError('Invoice not found');
    }

    if (invoice.userId !== userId) {
      throw new ValidationError('Not authorized to view this invoice');
    }

    // Get change history
    const changeHistory = await this.getChangeHistory(invoiceId, userId);

    // Get draft changes if any
    const draftChanges = await this.getDraft(invoiceId, userId);

    // Determine editing capabilities
    const editingCapabilities = this.determineEditingCapabilities(invoice);

    // Get validation info
    const validationInfo = await this.getValidationInfo(invoice);

    return {
      invoice,
      editingCapabilities,
      validationInfo,
      changeHistory,
      draftChanges,
    };
  }

  async updateInvoiceField(
    invoiceId: string,
    userId: string,
    fieldName: string,
    value: any,
    options: UpdateOptions = {}
  ): Promise<FieldUpdateResult> {
    // Check if field is editable
    if (!this.editableFields.includes(fieldName)) {
      return {
        success: false,
        validationErrors: [`Field '${fieldName}' is not editable`],
      };
    }

    // Get current invoice
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new ValidationError('Invoice not found');
    }

    if (invoice.userId !== userId) {
      throw new ValidationError('Not authorized to update this invoice');
    }

    // Validate field if requested
    if (options.validateField) {
      const validationResult = await this.validateField(fieldName, value);
      if (!validationResult.isValid) {
        return {
          success: false,
          validationResult,
          validationErrors: validationResult.errors,
        };
      }
    }

    try {
      // Track change if requested
      let changeId: string | undefined;
      if (options.trackChanges) {
        const changeLog = await this.trackFieldChange({
          invoiceId,
          userId,
          fieldName,
          oldValue: invoice[fieldName as keyof typeof invoice],
          newValue: value,
          changeReason: 'Manual edit',
        });
        changeId = changeLog.id;
      }

      // Update the field
      const updatedInvoice = await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: { [fieldName]: value },
      });

      logger.info('Invoice field updated', {
        invoiceId,
        userId,
        fieldName,
        changeId,
      });

      return {
        success: true,
        updatedValue: updatedInvoice[fieldName as keyof typeof updatedInvoice],
        changeTracked: !!changeId,
        changeId,
      };
    } catch (error) {
      logger.error('Failed to update invoice field', { error, invoiceId, fieldName });
      return {
        success: false,
        validationErrors: ['Failed to update field'],
      };
    }
  }

  async updateMultipleFields(
    invoiceId: string,
    userId: string,
    updateData: { [key: string]: any },
    options: UpdateOptions = {}
  ): Promise<MultiFieldUpdateResult> {
    const validationResults: { [field: string]: FieldValidationResult } = {};
    const validationErrors: { [field: string]: string[] } = {};
    const changeIds: string[] = [];

    // Validate all fields if requested
    if (options.validateFields) {
      for (const [fieldName, value] of Object.entries(updateData)) {
        const validationResult = await this.validateField(fieldName, value);
        validationResults[fieldName] = validationResult;
        
        if (!validationResult.isValid) {
          validationErrors[fieldName] = validationResult.errors;
        }
      }

      // If any validation failed, return early
      if (Object.keys(validationErrors).length > 0) {
        return {
          success: false,
          updatedFields: [],
          validationResults,
          validationErrors,
          changeIds: [],
        };
      }
    }

    // Get current invoice for change tracking
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
    });

    if (!invoice) {
      throw new ValidationError('Invoice not found');
    }

    if (invoice.userId !== userId) {
      throw new ValidationError('Not authorized to update this invoice');
    }

    try {
      // Track changes if requested
      if (options.trackChanges) {
        for (const [fieldName, newValue] of Object.entries(updateData)) {
          const changeLog = await this.trackFieldChange({
            invoiceId,
            userId,
            fieldName,
            oldValue: invoice[fieldName as keyof typeof invoice],
            newValue,
            changeReason: 'Bulk edit',
          });
          changeIds.push(changeLog.id);
        }
      }

      // Update all fields atomically
      await this.prisma.invoice.update({
        where: { id: invoiceId },
        data: updateData,
      });

      logger.info('Multiple invoice fields updated', {
        invoiceId,
        userId,
        updatedFields: Object.keys(updateData),
        changeCount: changeIds.length,
      });

      return {
        success: true,
        updatedFields: Object.keys(updateData),
        validationResults,
        changeIds,
      };
    } catch (error) {
      logger.error('Failed to update multiple fields', { error, invoiceId });
      return {
        success: false,
        updatedFields: [],
        validationResults,
        validationErrors: { general: ['Failed to update fields'] },
        changeIds: [],
      };
    }
  }

  async addLineItem(
    invoiceId: string,
    userId: string,
    lineItemData: any,
    options: UpdateOptions = {}
  ): Promise<LineItemResult> {
    // Validate calculation if requested
    if (options.validateCalculation) {
      const calculationResult = await this.validateLineItemCalculation(lineItemData);
      if (!calculationResult.isValid) {
        return {
          success: false,
          validationErrors: calculationResult.errors,
        };
      }
    }

    try {
      const lineItem = await this.prisma.invoiceLineItem.create({
        data: {
          invoiceId,
          userId,
          ...lineItemData,
          calculationValid: true,
        },
      });

      // Update invoice total if requested
      if (options.updateInvoiceTotal) {
        await this.recalculateInvoiceTotal(invoiceId);
      }

      logger.info('Line item added', { invoiceId, lineItemId: lineItem.id });

      return {
        success: true,
        lineItem,
        calculationValid: true,
      };
    } catch (error) {
      logger.error('Failed to add line item', { error, invoiceId });
      return {
        success: false,
        validationErrors: ['Failed to add line item'],
      };
    }
  }

  async updateLineItem(
    lineItemId: string,
    userId: string,
    updateData: any,
    options: UpdateOptions = {}
  ): Promise<LineItemResult> {
    // Validate calculation if requested
    if (options.validateCalculation && updateData.quantity && updateData.unitPrice) {
      const calculationResult = await this.validateLineItemCalculation({
        ...updateData,
        amount: updateData.amount || updateData.quantity * updateData.unitPrice,
      });
      
      if (!calculationResult.isValid) {
        return {
          success: false,
          validationErrors: calculationResult.errors,
        };
      }
    }

    try {
      const lineItem = await this.prisma.invoiceLineItem.update({
        where: { id: lineItemId },
        data: {
          ...updateData,
          calculationValid: true,
        },
      });

      // Update invoice total if requested
      if (options.updateInvoiceTotal) {
        await this.recalculateInvoiceTotal(lineItem.invoiceId);
      }

      logger.info('Line item updated', { lineItemId });

      return {
        success: true,
        lineItem,
        calculationValid: true,
      };
    } catch (error) {
      logger.error('Failed to update line item', { error, lineItemId });
      return {
        success: false,
        validationErrors: ['Failed to update line item'],
      };
    }
  }

  async deleteLineItem(
    lineItemId: string,
    userId: string,
    options: UpdateOptions = {}
  ): Promise<LineItemResult> {
    try {
      const lineItem = await this.prisma.invoiceLineItem.delete({
        where: { id: lineItemId },
      });

      // Update invoice total if requested
      if (options.updateInvoiceTotal) {
        await this.recalculateInvoiceTotal(lineItem.invoiceId);
      }

      logger.info('Line item deleted', { lineItemId });

      return {
        success: true,
        deletedAmount: Number(lineItem.amount),
      };
    } catch (error) {
      logger.error('Failed to delete line item', { error, lineItemId });
      return {
        success: false,
        validationErrors: ['Failed to delete line item'],
      };
    }
  }

  async validateField(fieldName: string, value: any): Promise<FieldValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    switch (fieldName) {
      case 'invoiceNumber':
        if (!value || typeof value !== 'string') {
          errors.push('Invoice number is required');
        } else if (!/^[A-Z]{2,4}-\d{4}-\d{3,4}$/.test(value)) {
          errors.push('Invalid invoice number format');
          suggestions.push('Use format: INV-YYYY-NNN (e.g., INV-2024-001)');
        }
        break;

      case 'invoiceDate':
        if (!value) {
          errors.push('Invoice date is required');
        } else {
          const date = new Date(value);
          if (isNaN(date.getTime())) {
            errors.push('Invalid date format');
          } else if (date > new Date()) {
            errors.push('Invoice date cannot be in the future');
          }
        }
        break;

      case 'totalAmount':
      case 'taxAmount':
      case 'subtotal':
        if (value === null || value === undefined) {
          errors.push(`${fieldName} is required`);
        } else if (typeof value !== 'number' || value < 0) {
          errors.push(`${fieldName.replace(/([A-Z])/g, ' $1').toLowerCase()} must be positive`);
        }
        break;

      case 'vendorName':
        if (!value || typeof value !== 'string' || value.trim().length === 0) {
          errors.push('Vendor name is required');
        } else if (value.length < 2) {
          errors.push('Vendor name must be at least 2 characters');
        }
        break;

      default:
        // Generic validation for other fields
        if (typeof value === 'string' && value.length > 1000) {
          warnings.push('Field value is very long');
        }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
    };
  }

  async validateLineItemCalculation(lineItemData: any): Promise<LineItemCalculationResult> {
    const { quantity, unitPrice, amount } = lineItemData;
    const expectedAmount = quantity * unitPrice;
    const actualAmount = amount;
    const discrepancy = Math.abs(expectedAmount - actualAmount);
    const tolerance = 0.01; // 1 cent tolerance

    const errors: string[] = [];
    
    if (discrepancy > tolerance) {
      errors.push('Line item calculation is incorrect');
      errors.push(`Expected: ${expectedAmount}, Actual: ${actualAmount}`);
    }

    return {
      isValid: errors.length === 0,
      expectedAmount,
      actualAmount,
      discrepancy,
      errors,
    };
  }

  async trackFieldChange(changeData: {
    invoiceId: string;
    userId: string;
    fieldName: string;
    oldValue: any;
    newValue: any;
    changeReason?: string;
  }): Promise<any> {
    return this.prisma.invoiceChangeLog.create({
      data: {
        ...changeData,
        timestamp: new Date(),
        metadata: {
          userAgent: 'web-app',
          ipAddress: '127.0.0.1', // Would be passed from request
        },
      },
    });
  }

  async getChangeHistory(invoiceId: string, userId: string): Promise<any[]> {
    return this.prisma.invoiceChangeLog.findMany({
      where: { invoiceId },
      include: {
        user: { select: { email: true } },
      },
      orderBy: { timestamp: 'desc' },
    });
  }

  async saveDraft(draftData: {
    invoiceId: string;
    userId: string;
    changes: any;
  }): Promise<{ success: boolean; draftId?: string; timestamp?: Date }> {
    // TODO: Implement draft saving functionality
    return {
      success: true,
      draftId: 'draft-' + Date.now(),
      timestamp: new Date(),
    };
  }

  async getDraft(invoiceId: string, userId: string): Promise<any> {
    // TODO: Implement draft retrieval functionality
    return null;
  }

  async applyDraftChanges(invoiceId: string, userId: string): Promise<{
    success: boolean;
    appliedChanges: string[];
  }> {
    // TODO: Implement draft application functionality
    return {
      success: true,
      appliedChanges: [],
    };
  }

  async bulkUpdateFields(
    invoiceIds: string[],
    userId: string,
    updateData: any,
    options: UpdateOptions = {}
  ): Promise<BulkUpdateResult> {
    const failedUpdates: Array<{ invoiceId: string; error: string }> = [];
    let updatedCount = 0;

    for (const invoiceId of invoiceIds) {
      try {
        const result = await this.updateMultipleFields(invoiceId, userId, updateData, options);
        if (result.success) {
          updatedCount++;
        } else {
          failedUpdates.push({
            invoiceId,
            error: 'Validation failed',
          });
        }
      } catch (error) {
        failedUpdates.push({
          invoiceId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        
        if (!options.continueOnError) {
          break;
        }
      }
    }

    return {
      success: failedUpdates.length === 0 || options.continueOnError,
      updatedCount,
      failedUpdates,
    };
  }

  private determineEditingCapabilities(invoice: any): any {
    const canEdit = invoice.status !== 'archived' && invoice.status !== 'locked';
    const editingRestrictions: string[] = [];

    if (invoice.status === 'archived') {
      editingRestrictions.push('Invoice is archived');
    }
    if (invoice.status === 'locked') {
      editingRestrictions.push('Invoice is locked');
    }

    return {
      canEdit,
      editableFields: canEdit ? this.editableFields : [],
      readOnlyFields: this.readOnlyFields,
      editingRestrictions,
    };
  }

  private async getValidationInfo(invoice: any): Promise<any> {
    // TODO: Implement comprehensive validation info gathering
    return {
      overallStatus: 'valid',
      fieldValidations: {},
      businessRuleValidations: [],
    };
  }

  private async recalculateInvoiceTotal(invoiceId: string): Promise<void> {
    const lineItems = await this.prisma.invoiceLineItem.findMany({
      where: { invoiceId },
    });

    const subtotal = lineItems.reduce((sum, item) => sum + Number(item.amount), 0);
    
    // Get current tax amount to calculate new total
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: { taxAmount: true },
    });

    const taxAmount = Number(invoice?.taxAmount) || 0;
    const totalAmount = subtotal + taxAmount;

    await this.prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        subtotal,
        totalAmount,
      },
    });
  }
}
