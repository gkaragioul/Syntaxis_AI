import { EnhancedBusinessLogicValidationService } from '../../services/enhanced-business-logic-validation.service';
import { PrismaClient } from '@prisma/client';

// Mock PrismaClient
const mockPrisma = {
  extraction: {
    findUnique: jest.fn(),
  },
  fieldPattern: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  extractionRule: {
    create: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
  },
  template: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  businessRule: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
} as unknown as PrismaClient;

describe('Enhanced Business Logic Validation', () => {
  let fieldService: EnhancedBusinessLogicValidationService;

  beforeEach(() => {
    jest.clearAllMocks();
    fieldService = new EnhancedBusinessLogicValidationService(mockPrisma);
  });

  describe('Industry-Specific Rules', () => {
    it('should validate healthcare invoice requirements', async () => {
      const healthcareInvoiceText = `
        MEDICAL INVOICE
        Provider: ABC Medical Center
        Provider NPI: 1234567890
        Patient: John Doe
        Patient ID: P123456
        Service Date: 2024-03-15
        Procedure Code: 99213
        Diagnosis Code: Z00.00
        Total Amount: $250.00
        Insurance: Blue Cross
        Copay: $25.00
      `;

      const result = await fieldService.extractFields(healthcareInvoiceText, {
        type: 'invoice',
        industry: 'healthcare',
        requiredFields: ['vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
      });

      expect(result.validation.businessLogicValidation).toBeDefined();
      expect(result.validation.businessLogicValidation.industryCompliance.healthcare).toBeDefined();
      expect(result.validation.businessLogicValidation.industryCompliance.healthcare.npiValidation.isValid).toBe(true);
      expect(result.validation.businessLogicValidation.industryCompliance.healthcare.procedureCodeValidation.isValid).toBe(true);
    });

    it('should validate construction invoice requirements', async () => {
      const constructionInvoiceText = `
        CONSTRUCTION INVOICE
        Contractor: ABC Construction LLC
        License #: C-123456
        Project: Office Building Renovation
        Work Period: March 1-15, 2024
        Labor: $5,000.00
        Materials: $3,000.00
        Equipment: $1,000.00
        Subtotal: $9,000.00
        Tax: $720.00
        Total: $9,720.00
        Retention: 10%
      `;

      const result = await fieldService.extractFields(constructionInvoiceText, {
        type: 'invoice',
        industry: 'construction',
        requiredFields: ['vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
      });

      expect(result.validation.businessLogicValidation.industryCompliance.construction).toBeDefined();
      expect(result.validation.businessLogicValidation.industryCompliance.construction.licenseValidation.isValid).toBe(true);
      expect(result.validation.businessLogicValidation.industryCompliance.construction.retentionValidation.isValid).toBe(true);
    });

    it('should validate legal services invoice requirements', async () => {
      const legalInvoiceText = `
        LEGAL SERVICES INVOICE
        Law Firm: Smith & Associates
        Bar Number: 123456
        Client: ABC Corporation
        Matter: Contract Review
        Attorney: John Smith (Partner)
        Paralegal: Jane Doe
        
        Time Entries:
        03/15/24 - Contract Review - J.Smith - 2.5 hrs @ $500/hr = $1,250.00
        03/16/24 - Research - J.Doe - 4.0 hrs @ $150/hr = $600.00
        
        Total Professional Fees: $1,850.00
        Expenses: $50.00
        Total Amount: $1,900.00
      `;

      const result = await fieldService.extractFields(legalInvoiceText, {
        type: 'invoice',
        industry: 'legal',
        requiredFields: ['vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
      });

      expect(result.validation.businessLogicValidation.industryCompliance.legal).toBeDefined();
      expect(result.validation.businessLogicValidation.industryCompliance.legal.barNumberValidation.isValid).toBe(true);
      expect(result.validation.businessLogicValidation.industryCompliance.legal.timeEntryValidation.isValid).toBe(true);
    });
  });

  describe('Compliance Checks', () => {
    it('should validate tax compliance requirements', async () => {
      const taxCompliantInvoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Tax ID: 12-3456789
        Subtotal: $1,000.00
        Sales Tax (8.25%): $82.50
        Total: $1,082.50
        Tax Jurisdiction: California
      `;

      const result = await fieldService.extractFields(taxCompliantInvoiceText, {
        type: 'invoice',
        requiredFields: ['vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
        enableTaxCompliance: true,
      });

      expect(result.validation.businessLogicValidation.complianceChecks.tax).toBeDefined();
      expect(result.validation.businessLogicValidation.complianceChecks.tax.taxIdValidation.isValid).toBe(true);
      expect(result.validation.businessLogicValidation.complianceChecks.tax.taxRateCompliance.isValid).toBe(true);
    });

    it('should validate international trade compliance', async () => {
      const internationalInvoiceText = `
        COMMERCIAL INVOICE
        Exporter: ABC Export Co.
        Importer: XYZ Import Ltd.
        Country of Origin: USA
        Destination: Canada
        HS Code: 8471.30.01
        Incoterms: FOB
        Total Value: $5,000.00 USD
        Currency: USD
        Export License: EL123456
      `;

      const result = await fieldService.extractFields(internationalInvoiceText, {
        type: 'invoice',
        requiredFields: ['vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
        enableTradeCompliance: true,
      });

      expect(result.validation.businessLogicValidation.complianceChecks.trade).toBeDefined();
      expect(result.validation.businessLogicValidation.complianceChecks.trade.hsCodeValidation.isValid).toBe(true);
      expect(result.validation.businessLogicValidation.complianceChecks.trade.incotermsValidation.isValid).toBe(true);
    });

    it('should validate data privacy compliance', async () => {
      const privacyCompliantInvoiceText = `
        Invoice: INV-2024-001
        Data Processing Services
        GDPR Compliance: Yes
        Data Retention: 7 years
        Privacy Policy: Attached
        DPO Contact: privacy@company.com
        Total: $2,500.00
      `;

      const result = await fieldService.extractFields(privacyCompliantInvoiceText, {
        type: 'invoice',
        requiredFields: ['totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
        enablePrivacyCompliance: true,
      });

      expect(result.validation.businessLogicValidation.complianceChecks.privacy).toBeDefined();
      expect(result.validation.businessLogicValidation.complianceChecks.privacy.gdprCompliance.isValid).toBe(true);
    });
  });

  describe('Workflow Validations', () => {
    it('should validate purchase order matching', async () => {
      const poMatchingInvoiceText = `
        Invoice: INV-2024-001
        Purchase Order: PO-2024-500
        Vendor: ABC Supplies
        PO Date: 2024-03-01
        Invoice Date: 2024-03-15
        
        Ordered Items:
        Item A - Qty: 10 - Price: $50.00 - Total: $500.00
        Item B - Qty: 5 - Price: $100.00 - Total: $500.00
        
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(poMatchingInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
        enablePOMatching: true,
        purchaseOrderData: {
          poNumber: 'PO-2024-500',
          totalAmount: 1000.00,
          lineItems: [
            { description: 'Item A', quantity: 10, unitPrice: 50.00 },
            { description: 'Item B', quantity: 5, unitPrice: 100.00 },
          ],
        },
      });

      expect(result.validation.businessLogicValidation.workflowValidation.poMatching).toBeDefined();
      expect(result.validation.businessLogicValidation.workflowValidation.poMatching.isValid).toBe(true);
      expect(result.validation.businessLogicValidation.workflowValidation.poMatching.matchScore).toBeGreaterThan(0.9);
    });

    it('should validate approval workflow requirements', async () => {
      const approvalInvoiceText = `
        Invoice: INV-2024-001
        Amount: $15,000.00
        Approval Required: Yes
        Approval Threshold: $10,000.00
        Approver: Manager Level
        Department: IT
        Budget Code: IT-2024-Q1
      `;

      const result = await fieldService.extractFields(approvalInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
        enableApprovalWorkflow: true,
        approvalRules: {
          thresholds: [
            { amount: 1000, approverLevel: 'supervisor' },
            { amount: 10000, approverLevel: 'manager' },
            { amount: 50000, approverLevel: 'director' },
          ],
        },
      });

      expect(result.validation.businessLogicValidation.workflowValidation.approval).toBeDefined();
      expect(result.validation.businessLogicValidation.workflowValidation.approval.isValid).toBe(true);
      expect(result.validation.businessLogicValidation.workflowValidation.approval.requiredApproverLevel).toBe('manager');
    });

    it('should validate budget and cost center allocation', async () => {
      const budgetInvoiceText = `
        Invoice: INV-2024-001
        Department: Marketing
        Cost Center: MKT-001
        Budget Line: Advertising
        Amount: $5,000.00
        Budget Remaining: $15,000.00
        Fiscal Year: 2024
      `;

      const result = await fieldService.extractFields(budgetInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
        enableBudgetValidation: true,
        budgetData: {
          costCenter: 'MKT-001',
          budgetLine: 'Advertising',
          allocatedBudget: 20000.00,
          spentToDate: 5000.00,
        },
      });

      expect(result.validation.businessLogicValidation.workflowValidation.budget).toBeDefined();
      expect(result.validation.businessLogicValidation.workflowValidation.budget.isValid).toBe(true);
      expect(result.validation.businessLogicValidation.workflowValidation.budget.budgetUtilization).toBe(0.5);
    });
  });

  describe('Custom Business Rules', () => {
    it('should validate custom vendor rules', async () => {
      const vendorInvoiceText = `
        Invoice: INV-2024-001
        Vendor: Preferred Supplier Inc
        Vendor Status: Approved
        Contract: CNT-2024-100
        Payment Terms: Net 30
        Total: $2,500.00
      `;

      const result = await fieldService.extractFields(vendorInvoiceText, {
        type: 'invoice',
        requiredFields: ['vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
        customRules: [
          {
            name: 'preferredVendorDiscount',
            description: 'Preferred vendors get 5% discount',
            condition: (fields: any) => fields.vendorName?.includes('Preferred'),
            validation: (fields: any) => ({
              isValid: fields.totalAmount <= 10000, // Max amount for preferred vendors
              message: 'Preferred vendor amount within limits',
            }),
          },
        ],
      });

      expect(result.validation.businessLogicValidation.customRules).toBeDefined();
      expect(result.validation.businessLogicValidation.customRules.length).toBe(1);
      expect(result.validation.businessLogicValidation.customRules[0].isValid).toBe(true);
    });

    it('should validate custom date rules', async () => {
      const dateRuleInvoiceText = `
        Invoice: INV-2024-001
        Invoice Date: 2024-03-15
        Service Date: 2024-03-10
        Due Date: 2024-04-15
        Total: $1,000.00
      `;

      const result = await fieldService.extractFields(dateRuleInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceDate', 'dueDate', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
        customRules: [
          {
            name: 'serviceDateBeforeInvoiceDate',
            description: 'Service date must be before invoice date',
            validation: (fields: any) => ({
              isValid: new Date(fields.serviceDate) <= new Date(fields.invoiceDate),
              message: 'Service date is before invoice date',
            }),
          },
          {
            name: 'paymentTermsValidation',
            description: 'Payment terms must be reasonable',
            validation: (fields: any) => {
              const daysDiff = (new Date(fields.dueDate) - new Date(fields.invoiceDate)) / (1000 * 60 * 60 * 24);
              return {
                isValid: daysDiff >= 15 && daysDiff <= 90,
                message: `Payment terms: ${daysDiff} days`,
              };
            },
          },
        ],
      });

      expect(result.validation.businessLogicValidation.customRules).toBeDefined();
      expect(result.validation.businessLogicValidation.customRules.length).toBe(2);
      expect(result.validation.businessLogicValidation.customRules[0].isValid).toBe(true);
      expect(result.validation.businessLogicValidation.customRules[1].isValid).toBe(true);
    });

    it('should validate custom amount thresholds', async () => {
      const thresholdInvoiceText = `
        Invoice: INV-2024-001
        Category: Office Supplies
        Amount: $500.00
        Vendor: Office Depot
      `;

      const result = await fieldService.extractFields(thresholdInvoiceText, {
        type: 'invoice',
        requiredFields: ['totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
        customRules: [
          {
            name: 'officeSuppliesThreshold',
            description: 'Office supplies should be under $1000',
            condition: (fields: any) => fields.category === 'Office Supplies',
            validation: (fields: any) => ({
              isValid: fields.totalAmount <= 1000,
              message: 'Office supplies amount within threshold',
            }),
          },
        ],
      });

      expect(result.validation.businessLogicValidation.customRules[0].isValid).toBe(true);
    });
  });

  describe('Risk Assessment', () => {
    it('should assess fraud risk indicators', async () => {
      const suspiciousInvoiceText = `
        Invoice: INV-2024-001
        Vendor: New Vendor LLC
        Amount: $9,999.00
        Payment Method: Wire Transfer
        Bank Account: Foreign Bank
        Urgency: Immediate Payment Required
      `;

      const result = await fieldService.extractFields(suspiciousInvoiceText, {
        type: 'invoice',
        requiredFields: ['vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
        enableRiskAssessment: true,
      });

      expect(result.validation.businessLogicValidation.riskAssessment).toBeDefined();
      expect(result.validation.businessLogicValidation.riskAssessment.fraudRisk).toBeDefined();
      expect(result.validation.businessLogicValidation.riskAssessment.fraudRisk.riskLevel).toBeGreaterThan(0.5);
      expect(result.validation.businessLogicValidation.riskAssessment.fraudRisk.indicators.length).toBeGreaterThan(0);
    });

    it('should assess duplicate invoice risk', async () => {
      const duplicateInvoiceText = `
        Invoice: INV-2024-001
        Vendor: ABC Corp
        Amount: $1,000.00
        Date: 2024-03-15
      `;

      const result = await fieldService.extractFields(duplicateInvoiceText, {
        type: 'invoice',
        requiredFields: ['invoiceNumber', 'vendorName', 'totalAmount'],
        confidenceThreshold: 0.7,
        enableBusinessLogicValidation: true,
        enableRiskAssessment: true,
        historicalInvoices: [
          {
            invoiceNumber: 'INV-2024-001',
            vendorName: 'ABC Corp',
            totalAmount: 1000.00,
            invoiceDate: '2024-03-15',
          },
        ],
      });

      expect(result.validation.businessLogicValidation.riskAssessment.duplicateRisk).toBeDefined();
      expect(result.validation.businessLogicValidation.riskAssessment.duplicateRisk.riskLevel).toBeGreaterThan(0.8);
      expect(result.validation.businessLogicValidation.riskAssessment.duplicateRisk.potentialDuplicates.length).toBe(1);
    });
  });
});
