import { PrismaClient } from '@prisma/client';
import { EnhancedInvoiceDetailService } from '../../services/enhanced-invoice-detail.service';
import { v4 as uuidv4 } from 'uuid';

// Mock PrismaClient
const mockPrisma = {
  invoice: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  invoiceLineItem: {
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    findMany: jest.fn(),
  },
  invoiceValidationResult: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  invoiceChangeLog: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
  user: {
    findUnique: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Enhanced Invoice Detail Service', () => {
  let detailService: EnhancedInvoiceDetailService;
  let testUserId: string;
  let testInvoiceId: string;

  beforeEach(() => {
    jest.clearAllMocks();
    detailService = new EnhancedInvoiceDetailService(mockPrisma);
    testUserId = uuidv4();
    testInvoiceId = uuidv4();
  });

  describe('Invoice Detail Retrieval', () => {
    it('should retrieve enhanced invoice details with all related data', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        userId: testUserId,
        invoiceNumber: 'INV-2024-001',
        invoiceDate: new Date('2024-03-15'),
        vendorName: 'ABC Corporation',
        totalAmount: 1000,
        status: 'processed',
        extractionConfidence: 0.9,
        lineItems: [
          {
            id: uuidv4(),
            description: 'Product A',
            quantity: 2,
            unitPrice: 500,
            amount: 1000,
          },
        ],
        validationResults: [],
        changeLog: [],
        file: {
          id: uuidv4(),
          filename: 'invoice.pdf',
          filePath: '/uploads/invoice.pdf',
        },
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoiceChangeLog.findMany.mockResolvedValue([]);

      const result = await detailService.getEnhancedInvoiceDetail(testInvoiceId, testUserId);

      expect(result).toBeDefined();
      expect(result.invoice).toEqual(mockInvoice);
      expect(result.editingCapabilities).toBeDefined();
      expect(result.validationInfo).toBeDefined();
      expect(result.changeHistory).toBeDefined();
      expect(mockPrisma.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: testInvoiceId },
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
    });

    it('should throw error if invoice not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null);

      await expect(
        detailService.getEnhancedInvoiceDetail(testInvoiceId, testUserId)
      ).rejects.toThrow('Invoice not found');
    });

    it('should throw error if user not authorized', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        userId: 'different-user-id',
        invoiceNumber: 'INV-2024-001',
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      await expect(
        detailService.getEnhancedInvoiceDetail(testInvoiceId, testUserId)
      ).rejects.toThrow('Not authorized to view this invoice');
    });
  });

  describe('Inline Field Editing', () => {
    it('should update single invoice field with validation', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        userId: testUserId,
        invoiceNumber: 'INV-2024-001',
        vendorName: 'ABC Corporation',
        totalAmount: 1000,
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue({
        ...mockInvoice,
        vendorName: 'XYZ Corporation',
      });

      const result = await detailService.updateInvoiceField(
        testInvoiceId,
        testUserId,
        'vendorName',
        'XYZ Corporation',
        {
          validateField: true,
          trackChanges: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.updatedValue).toBe('XYZ Corporation');
      expect(result.validationResult).toBeDefined();
      expect(result.changeTracked).toBe(true);
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: testInvoiceId },
        data: { vendorName: 'XYZ Corporation' },
      });
    });

    it('should validate field before updating', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        userId: testUserId,
        invoiceNumber: 'INV-2024-001',
        totalAmount: 1000,
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);

      const result = await detailService.updateInvoiceField(
        testInvoiceId,
        testUserId,
        'totalAmount',
        -100, // Invalid negative amount
        {
          validateField: true,
        }
      );

      expect(result.success).toBe(false);
      expect(result.validationErrors).toBeDefined();
      expect(result.validationErrors).toContain('Total amount must be positive');
      expect(mockPrisma.invoice.update).not.toHaveBeenCalled();
    });

    it('should update multiple fields atomically', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        userId: testUserId,
        invoiceNumber: 'INV-2024-001',
        vendorName: 'ABC Corporation',
        totalAmount: 1000,
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue({
        ...mockInvoice,
        vendorName: 'XYZ Corporation',
        totalAmount: 1500,
      });

      const result = await detailService.updateMultipleFields(
        testInvoiceId,
        testUserId,
        {
          vendorName: 'XYZ Corporation',
          totalAmount: 1500,
        },
        {
          validateFields: true,
          trackChanges: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.updatedFields).toEqual(['vendorName', 'totalAmount']);
      expect(result.validationResults).toBeDefined();
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: testInvoiceId },
        data: {
          vendorName: 'XYZ Corporation',
          totalAmount: 1500,
        },
      });
    });
  });

  describe('Line Item Management', () => {
    it('should add new line item with validation', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        userId: testUserId,
        invoiceNumber: 'INV-2024-001',
      };

      const newLineItem = {
        description: 'New Product',
        quantity: 1,
        unitPrice: 500,
        amount: 500,
      };

      const mockCreatedLineItem = {
        id: uuidv4(),
        invoiceId: testInvoiceId,
        userId: testUserId,
        ...newLineItem,
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoiceLineItem.create.mockResolvedValue(mockCreatedLineItem);

      const result = await detailService.addLineItem(
        testInvoiceId,
        testUserId,
        newLineItem,
        {
          validateCalculation: true,
          updateInvoiceTotal: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.lineItem).toEqual(mockCreatedLineItem);
      expect(result.calculationValid).toBe(true);
      expect(mockPrisma.invoiceLineItem.create).toHaveBeenCalledWith({
        data: {
          invoiceId: testInvoiceId,
          userId: testUserId,
          ...newLineItem,
          calculationValid: true,
        },
      });
    });

    it('should update existing line item', async () => {
      const lineItemId = uuidv4();
      const mockLineItem = {
        id: lineItemId,
        invoiceId: testInvoiceId,
        userId: testUserId,
        description: 'Product A',
        quantity: 2,
        unitPrice: 500,
        amount: 1000,
      };

      const updatedData = {
        quantity: 3,
        amount: 1500,
      };

      mockPrisma.invoiceLineItem.update.mockResolvedValue({
        ...mockLineItem,
        ...updatedData,
      });

      const result = await detailService.updateLineItem(
        lineItemId,
        testUserId,
        updatedData,
        {
          validateCalculation: true,
          updateInvoiceTotal: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.lineItem.quantity).toBe(3);
      expect(result.lineItem.amount).toBe(1500);
      expect(result.calculationValid).toBe(true);
      expect(mockPrisma.invoiceLineItem.update).toHaveBeenCalledWith({
        where: { id: lineItemId },
        data: {
          ...updatedData,
          calculationValid: true,
        },
      });
    });

    it('should delete line item and update totals', async () => {
      const lineItemId = uuidv4();
      const mockLineItem = {
        id: lineItemId,
        invoiceId: testInvoiceId,
        userId: testUserId,
        amount: 500,
      };

      mockPrisma.invoiceLineItem.delete.mockResolvedValue(mockLineItem);

      const result = await detailService.deleteLineItem(
        lineItemId,
        testUserId,
        {
          updateInvoiceTotal: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.deletedAmount).toBe(500);
      expect(mockPrisma.invoiceLineItem.delete).toHaveBeenCalledWith({
        where: { id: lineItemId },
      });
    });

    it('should validate line item calculations', async () => {
      const lineItemData = {
        description: 'Product A',
        quantity: 2,
        unitPrice: 500,
        amount: 900, // Incorrect calculation (should be 1000)
      };

      const result = await detailService.validateLineItemCalculation(lineItemData);

      expect(result.isValid).toBe(false);
      expect(result.expectedAmount).toBe(1000);
      expect(result.actualAmount).toBe(900);
      expect(result.discrepancy).toBe(100);
      expect(result.errors).toContain('Line item calculation is incorrect');
    });
  });

  describe('Change Tracking', () => {
    it('should track field changes with metadata', async () => {
      const changeData = {
        invoiceId: testInvoiceId,
        userId: testUserId,
        fieldName: 'vendorName',
        oldValue: 'ABC Corporation',
        newValue: 'XYZ Corporation',
        changeReason: 'Vendor name correction',
      };

      const mockChangeLog = {
        id: uuidv4(),
        ...changeData,
        timestamp: new Date(),
      };

      mockPrisma.invoiceChangeLog.create.mockResolvedValue(mockChangeLog);

      const result = await detailService.trackFieldChange(changeData);

      expect(result).toEqual(mockChangeLog);
      expect(mockPrisma.invoiceChangeLog.create).toHaveBeenCalledWith({
        data: {
          ...changeData,
          timestamp: expect.any(Date),
          metadata: expect.any(Object),
        },
      });
    });

    it('should retrieve change history for invoice', async () => {
      const mockChangeHistory = [
        {
          id: uuidv4(),
          invoiceId: testInvoiceId,
          fieldName: 'vendorName',
          oldValue: 'ABC Corporation',
          newValue: 'XYZ Corporation',
          timestamp: new Date(),
          user: { email: 'user@example.com' },
        },
      ];

      mockPrisma.invoiceChangeLog.findMany.mockResolvedValue(mockChangeHistory);

      const result = await detailService.getChangeHistory(testInvoiceId, testUserId);

      expect(result).toEqual(mockChangeHistory);
      expect(mockPrisma.invoiceChangeLog.findMany).toHaveBeenCalledWith({
        where: { invoiceId: testInvoiceId },
        include: {
          user: { select: { email: true } },
        },
        orderBy: { timestamp: 'desc' },
      });
    });
  });

  describe('Field Validation', () => {
    it('should validate invoice number format', async () => {
      const result = await detailService.validateField('invoiceNumber', 'INV-2024-001');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject invalid invoice number format', async () => {
      const result = await detailService.validateField('invoiceNumber', 'invalid-format');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid invoice number format');
    });

    it('should validate date fields', async () => {
      const validDate = new Date('2024-03-15');
      const result = await detailService.validateField('invoiceDate', validDate);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject future dates for invoice date', async () => {
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
      const result = await detailService.validateField('invoiceDate', futureDate);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invoice date cannot be in the future');
    });

    it('should validate amount fields', async () => {
      const result = await detailService.validateField('totalAmount', 1000);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative amounts', async () => {
      const result = await detailService.validateField('totalAmount', -100);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Total amount must be positive');
    });

    it('should validate vendor name', async () => {
      const result = await detailService.validateField('vendorName', 'ABC Corporation');

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject empty vendor name', async () => {
      const result = await detailService.validateField('vendorName', '');

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Vendor name is required');
    });
  });

  describe('Auto-save and Draft Management', () => {
    it('should auto-save changes as draft', async () => {
      const draftData = {
        invoiceId: testInvoiceId,
        userId: testUserId,
        changes: {
          vendorName: 'XYZ Corporation',
          totalAmount: 1500,
        },
      };

      const result = await detailService.saveDraft(draftData);

      expect(result.success).toBe(true);
      expect(result.draftId).toBeDefined();
      expect(result.timestamp).toBeDefined();
    });

    it('should retrieve saved draft', async () => {
      const mockDraft = {
        id: uuidv4(),
        invoiceId: testInvoiceId,
        userId: testUserId,
        changes: {
          vendorName: 'XYZ Corporation',
          totalAmount: 1500,
        },
        timestamp: new Date(),
      };

      const result = await detailService.getDraft(testInvoiceId, testUserId);

      expect(result).toBeDefined();
      expect(result.changes).toEqual(mockDraft.changes);
    });

    it('should apply draft changes to invoice', async () => {
      const mockInvoice = {
        id: testInvoiceId,
        userId: testUserId,
        invoiceNumber: 'INV-2024-001',
        vendorName: 'ABC Corporation',
        totalAmount: 1000,
      };

      const draftChanges = {
        vendorName: 'XYZ Corporation',
        totalAmount: 1500,
      };

      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice);
      mockPrisma.invoice.update.mockResolvedValue({
        ...mockInvoice,
        ...draftChanges,
      });

      const result = await detailService.applyDraftChanges(testInvoiceId, testUserId);

      expect(result.success).toBe(true);
      expect(result.appliedChanges).toEqual(Object.keys(draftChanges));
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: testInvoiceId },
        data: draftChanges,
      });
    });
  });

  describe('Bulk Operations', () => {
    it('should perform bulk field updates', async () => {
      const invoiceIds = [testInvoiceId, uuidv4(), uuidv4()];
      const updateData = {
        status: 'reviewed',
        paymentStatus: 'pending',
      };

      const result = await detailService.bulkUpdateFields(
        invoiceIds,
        testUserId,
        updateData,
        {
          validateFields: true,
          trackChanges: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(3);
      expect(result.failedUpdates).toHaveLength(0);
    });

    it('should handle bulk operation failures gracefully', async () => {
      const invoiceIds = [testInvoiceId, 'invalid-id'];
      const updateData = {
        status: 'reviewed',
      };

      const result = await detailService.bulkUpdateFields(
        invoiceIds,
        testUserId,
        updateData,
        {
          validateFields: true,
          continueOnError: true,
        }
      );

      expect(result.success).toBe(true);
      expect(result.updatedCount).toBe(1);
      expect(result.failedUpdates).toHaveLength(1);
      expect(result.failedUpdates[0].invoiceId).toBe('invalid-id');
    });
  });
});
