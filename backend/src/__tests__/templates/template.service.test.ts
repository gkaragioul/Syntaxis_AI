import { PrismaClient } from '@prisma/client';
import { TemplateService } from '../../services/template.service';
import { ValidationError, ServiceError } from '../../utils/errors';

// Mock PrismaClient
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    template: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    extraction: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    vendorMapping: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    templatePattern: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  })),
}));

describe('TemplateService', () => {
  let templateService: TemplateService;
  let prisma: jest.Mocked<PrismaClient>;
  const mockUserId = 'user-123';
  const mockTemplateId = 'template-123';
  const mockExtractionId = 'extraction-123';

  beforeEach(() => {
    prisma = new PrismaClient() as jest.Mocked<PrismaClient>;
    templateService = new TemplateService(prisma);
  });

  describe('createTemplate', () => {
    const mockTemplateData = {
      name: 'Standard Invoice Template',
      vendorName: 'ABC Company',
      patterns: {
        vendor: ['From:', 'Vendor:', 'Supplier:'],
        invoiceNumber: ['Invoice #:', 'Invoice Number:', 'Bill #:'],
        totalAmount: ['Total Amount:', 'Total:', 'Amount Due:'],
      },
      fieldMappings: {
        vendor: { type: 'string', required: true },
        invoiceNumber: {
          type: 'string',
          required: true,
          pattern: '^[A-Z0-9-]+$',
        },
        totalAmount: { type: 'number', required: true, min: 0 },
      },
    };

    it('should create a new template', async () => {
      (prisma.template.create as jest.Mock).mockResolvedValueOnce({
        id: mockTemplateId,
        userId: mockUserId,
        ...mockTemplateData,
        successRate: 0,
        usageCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const result = await templateService.createTemplate(
        mockUserId,
        mockTemplateData,
      );

      expect(result).toHaveProperty('id', mockTemplateId);
      expect(result.name).toBe(mockTemplateData.name);
      expect(result.vendorName).toBe(mockTemplateData.vendorName);
      expect(result.patterns).toEqual(mockTemplateData.patterns);
      expect(result.fieldMappings).toEqual(mockTemplateData.fieldMappings);
      expect(result.successRate).toBe(0);
      expect(result.usageCount).toBe(0);
    });

    it('should validate template data', async () => {
      const invalidData = {
        ...mockTemplateData,
        patterns: {}, // Empty patterns
      };

      await expect(
        templateService.createTemplate(mockUserId, invalidData),
      ).rejects.toThrow('Template must have at least one pattern');
    });
  });

  describe('getTemplate', () => {
    const mockTemplate = {
      id: mockTemplateId,
      userId: mockUserId,
      name: 'Standard Invoice Template',
      vendorName: 'ABC Company',
      patterns: {
        vendor: ['From:', 'Vendor:', 'Supplier:'],
        invoiceNumber: ['Invoice #:', 'Invoice Number:', 'Bill #:'],
        totalAmount: ['Total Amount:', 'Total:', 'Amount Due:'],
      },
      fieldMappings: {
        vendor: { type: 'string', required: true },
        invoiceNumber: {
          type: 'string',
          required: true,
          pattern: '^[A-Z0-9-]+$',
        },
        totalAmount: { type: 'number', required: true, min: 0 },
      },
      successRate: 0.95,
      usageCount: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    beforeEach(() => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
    });

    it('should return template for authorized user', async () => {
      const result = await templateService.getTemplate(
        mockTemplateId,
        mockUserId,
      );

      expect(result).toEqual(mockTemplate);
    });

    it('should reject unauthorized access', async () => {
      const otherUserId = 'other-user-123';

      await expect(
        templateService.getTemplate(mockTemplateId, otherUserId),
      ).rejects.toThrow('Not authorized to access this template');
    });

    it('should reject non-existent template', async () => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValueOnce(null);

      await expect(
        templateService.getTemplate(mockTemplateId, mockUserId),
      ).rejects.toThrow('Template not found');
    });
  });

  describe('applyTemplate', () => {
    const mockTemplate = {
      id: mockTemplateId,
      userId: mockUserId,
      patterns: {
        vendor: ['From:', 'Vendor:', 'Supplier:'],
        invoiceNumber: ['Invoice #:', 'Invoice Number:', 'Bill #:'],
        totalAmount: ['Total Amount:', 'Total:', 'Amount Due:'],
      },
      fieldMappings: {
        vendor: { type: 'string', required: true },
        invoiceNumber: {
          type: 'string',
          required: true,
          pattern: '^[A-Z0-9-]+$',
        },
        totalAmount: { type: 'number', required: true, min: 0 },
      },
    };

    const mockExtraction = {
      id: mockExtractionId,
      userId: mockUserId,
      fields: {
        vendor: 'ABC Company',
        invoiceNumber: 'INV-123',
        totalAmount: 1234.56,
      },
      confidence: 0.95,
      status: 'completed',
    };

    beforeEach(() => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
      (prisma.extraction.findUnique as jest.Mock).mockResolvedValue(
        mockExtraction,
      );
    });

    it('should apply template to extraction', async () => {
      const result = await templateService.applyTemplate(
        mockTemplateId,
        mockExtractionId,
        mockUserId,
      );

      expect(result).toHaveProperty('id');
      expect(result.templateId).toBe(mockTemplateId);
      expect(result.extractionId).toBe(mockExtractionId);
      expect(result.status).toBe('completed');
      expect(result.confidence).toBeGreaterThan(0.9);
    });

    it('should validate fields against template mappings', async () => {
      const invalidExtraction = {
        ...mockExtraction,
        fields: {
          vendor: 'ABC Company',
          invoiceNumber: 'invalid#', // Invalid pattern
          totalAmount: -100, // Invalid min value
        },
      };

      (prisma.extraction.findUnique as jest.Mock).mockResolvedValueOnce(
        invalidExtraction,
      );

      const result = await templateService.applyTemplate(
        mockTemplateId,
        mockExtractionId,
        mockUserId,
      );

      expect(result.status).toBe('validation_failed');
      expect(result.validationErrors).toHaveLength(2);
      expect(result.validationErrors).toContainEqual(
        expect.objectContaining({
          field: 'invoiceNumber',
          error: 'Value does not match required pattern',
        }),
      );
      expect(result.validationErrors).toContainEqual(
        expect.objectContaining({
          field: 'totalAmount',
          error: 'Value must be greater than 0',
        }),
      );
    });
  });

  describe('updateTemplate', () => {
    const mockTemplate = {
      id: mockTemplateId,
      userId: mockUserId,
      name: 'Standard Invoice Template',
      vendorName: 'ABC Company',
      patterns: {
        vendor: ['From:', 'Vendor:', 'Supplier:'],
        invoiceNumber: ['Invoice #:', 'Invoice Number:', 'Bill #:'],
        totalAmount: ['Total Amount:', 'Total:', 'Amount Due:'],
      },
      fieldMappings: {
        vendor: { type: 'string', required: true },
        invoiceNumber: {
          type: 'string',
          required: true,
          pattern: '^[A-Z0-9-]+$',
        },
        totalAmount: { type: 'number', required: true, min: 0 },
      },
      successRate: 0.95,
      usageCount: 100,
    };

    beforeEach(() => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
    });

    it('should update template for authorized user', async () => {
      const updatedData = {
        name: 'Updated Template',
        patterns: {
          ...mockTemplate.patterns,
          newField: ['New Field:', 'New Value:'],
        },
      };

      (prisma.template.update as jest.Mock).mockResolvedValueOnce({
        ...mockTemplate,
        ...updatedData,
      });

      const result = await templateService.updateTemplate(
        mockTemplateId,
        mockUserId,
        updatedData,
      );

      expect(result.name).toBe(updatedData.name);
      expect(result.patterns).toHaveProperty('newField');
    });

    it('should reject unauthorized access', async () => {
      const otherUserId = 'other-user-123';

      await expect(
        templateService.updateTemplate(mockTemplateId, otherUserId, {
          name: 'New Name',
        }),
      ).rejects.toThrow('Not authorized to access this template');
    });
  });

  describe('deleteTemplate', () => {
    const mockTemplate = {
      id: mockTemplateId,
      userId: mockUserId,
    };

    beforeEach(() => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
    });

    it('should delete template for authorized user', async () => {
      await templateService.deleteTemplate(mockTemplateId, mockUserId);

      expect(prisma.template.delete).toHaveBeenCalledWith({
        where: { id: mockTemplateId },
      });
    });

    it('should reject unauthorized access', async () => {
      const otherUserId = 'other-user-123';

      await expect(
        templateService.deleteTemplate(mockTemplateId, otherUserId),
      ).rejects.toThrow('Not authorized to access this template');
    });
  });

  describe('getTemplateAnalytics', () => {
    const mockTemplates = [
      {
        id: 'template-1',
        userId: mockUserId,
        name: 'Template 1',
        successRate: 0.95,
        usageCount: 100,
      },
      {
        id: 'template-2',
        userId: mockUserId,
        name: 'Template 2',
        successRate: 0.85,
        usageCount: 50,
      },
    ];

    beforeEach(() => {
      (prisma.template.findMany as jest.Mock).mockResolvedValue(mockTemplates);
    });

    it('should return template analytics', async () => {
      const result = await templateService.getTemplateAnalytics(mockUserId);

      expect(result).toHaveProperty('totalTemplates', 2);
      expect(result).toHaveProperty('averageSuccessRate', 0.9);
      expect(result).toHaveProperty('totalUsage', 150);
      expect(result).toHaveProperty('templates');
      expect(result.templates).toHaveLength(2);
    });
  });

  describe('learnFromExtraction', () => {
    const mockTemplate = {
      id: mockTemplateId,
      userId: mockUserId,
      patterns: {
        vendor: ['From:', 'Vendor:', 'Supplier:'],
        invoiceNumber: ['Invoice #:', 'Invoice Number:', 'Bill #:'],
        totalAmount: ['Total Amount:', 'Total:', 'Amount Due:'],
      },
      fieldMappings: {
        vendor: { type: 'string', required: true },
        invoiceNumber: {
          type: 'string',
          required: true,
          pattern: '^[A-Z0-9-]+$',
        },
        totalAmount: { type: 'number', required: true, min: 0 },
      },
      successRate: 0.95,
      usageCount: 100,
    };

    const mockExtraction = {
      id: mockExtractionId,
      userId: mockUserId,
      fields: {
        vendor: 'ABC Company',
        invoiceNumber: 'INV-123',
        totalAmount: 1234.56,
      },
      confidence: 0.95,
      status: 'completed',
    };

    beforeEach(() => {
      (prisma.template.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
      (prisma.extraction.findUnique as jest.Mock).mockResolvedValue(
        mockExtraction,
      );
    });

    it('should update template based on successful extraction', async () => {
      const result = await templateService.learnFromExtraction(
        mockTemplateId,
        mockExtractionId,
        mockUserId,
        true,
      );

      expect(result.successRate).toBeGreaterThan(mockTemplate.successRate);
      expect(result.usageCount).toBe(mockTemplate.usageCount + 1);
    });

    it('should update template based on failed extraction', async () => {
      const result = await templateService.learnFromExtraction(
        mockTemplateId,
        mockExtractionId,
        mockUserId,
        false,
      );

      expect(result.successRate).toBeLessThan(mockTemplate.successRate);
      expect(result.usageCount).toBe(mockTemplate.usageCount + 1);
    });
  });
});
