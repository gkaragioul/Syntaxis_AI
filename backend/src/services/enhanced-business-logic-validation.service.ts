import { EnhancedMathematicalValidationService } from './enhanced-mathematical-validation.service';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

interface BusinessLogicValidationResult {
  isValid: boolean;
  confidence: number;
  errors: string[];
  warnings: string[];
  industryCompliance?: IndustryComplianceResult;
  complianceChecks?: ComplianceChecksResult;
  workflowValidation?: WorkflowValidationResult;
  customRules?: CustomRuleResult[];
  riskAssessment?: RiskAssessmentResult;
}

interface IndustryComplianceResult {
  healthcare?: HealthcareComplianceResult;
  construction?: ConstructionComplianceResult;
  legal?: LegalComplianceResult;
  financial?: FinancialComplianceResult;
}

interface HealthcareComplianceResult {
  npiValidation: { isValid: boolean; npi?: string };
  procedureCodeValidation: { isValid: boolean; codes?: string[] };
  diagnosisCodeValidation: { isValid: boolean; codes?: string[] };
  hipaaCompliance: { isValid: boolean; issues?: string[] };
}

interface ConstructionComplianceResult {
  licenseValidation: { isValid: boolean; license?: string };
  retentionValidation: { isValid: boolean; retentionRate?: number };
  prevailingWageCompliance: { isValid: boolean; issues?: string[] };
  safetyRequirements: { isValid: boolean; certifications?: string[] };
}

interface LegalComplianceResult {
  barNumberValidation: { isValid: boolean; barNumber?: string };
  timeEntryValidation: { isValid: boolean; entries?: any[] };
  clientPrivilegeCompliance: { isValid: boolean; issues?: string[] };
  trustAccountCompliance: { isValid: boolean; issues?: string[] };
}

interface FinancialComplianceResult {
  secCompliance: { isValid: boolean; issues?: string[] };
  amlCompliance: { isValid: boolean; riskLevel?: number };
  kycCompliance: { isValid: boolean; verified?: boolean };
}

interface ComplianceChecksResult {
  tax?: TaxComplianceResult;
  trade?: TradeComplianceResult;
  privacy?: PrivacyComplianceResult;
  environmental?: EnvironmentalComplianceResult;
}

interface TaxComplianceResult {
  taxIdValidation: { isValid: boolean; taxId?: string };
  taxRateCompliance: { isValid: boolean; jurisdiction?: string };
  exemptionValidation: { isValid: boolean; exemptions?: string[] };
}

interface TradeComplianceResult {
  hsCodeValidation: { isValid: boolean; hsCode?: string };
  incotermsValidation: { isValid: boolean; incoterms?: string };
  exportLicenseValidation: { isValid: boolean; license?: string };
  sanctionsCheck: { isValid: boolean; issues?: string[] };
}

interface PrivacyComplianceResult {
  gdprCompliance: { isValid: boolean; issues?: string[] };
  ccpaCompliance: { isValid: boolean; issues?: string[] };
  dataRetentionCompliance: { isValid: boolean; retentionPeriod?: string };
}

interface EnvironmentalComplianceResult {
  carbonFootprintReporting: { isValid: boolean; emissions?: number };
  sustainabilityRequirements: { isValid: boolean; certifications?: string[] };
}

interface WorkflowValidationResult {
  poMatching?: POMatchingResult;
  approval?: ApprovalValidationResult;
  budget?: BudgetValidationResult;
  routing?: RoutingValidationResult;
}

interface POMatchingResult {
  isValid: boolean;
  matchScore: number;
  discrepancies?: Array<{
    field: string;
    expected: any;
    actual: any;
  }>;
}

interface ApprovalValidationResult {
  isValid: boolean;
  requiredApproverLevel: string;
  currentApprovalStatus?: string;
  approvalChain?: string[];
}

interface BudgetValidationResult {
  isValid: boolean;
  budgetUtilization: number;
  remainingBudget: number;
  budgetExceeded?: boolean;
}

interface RoutingValidationResult {
  isValid: boolean;
  recommendedRoute: string;
  routingReason: string;
}

interface CustomRuleResult {
  ruleName: string;
  isValid: boolean;
  message: string;
  confidence: number;
}

interface RiskAssessmentResult {
  overallRiskLevel: number;
  fraudRisk?: FraudRiskResult;
  duplicateRisk?: DuplicateRiskResult;
  complianceRisk?: ComplianceRiskResult;
}

interface FraudRiskResult {
  riskLevel: number;
  indicators: string[];
  recommendations: string[];
}

interface DuplicateRiskResult {
  riskLevel: number;
  potentialDuplicates: any[];
  similarityScores: number[];
}

interface ComplianceRiskResult {
  riskLevel: number;
  violations: string[];
  recommendations: string[];
}

export class EnhancedBusinessLogicValidationService extends EnhancedMathematicalValidationService {
  private readonly industryValidators = new Map();
  private readonly complianceValidators = new Map();
  private readonly workflowValidators = new Map();

  constructor(prisma: PrismaClient) {
    super(prisma);
    this.initializeValidators();
  }

  async extractFields(text: string, options: any): Promise<any> {
    // First extract fields using enhanced mathematical validation
    const result = await super.extractFields(text, options);
    
    // Then apply enhanced business logic validation if enabled
    if (options.enableBusinessLogicValidation) {
      const businessLogicValidation = await this.performBusinessLogicValidation(result, text, options);
      
      // Add business logic validation results
      if (!result.validation) result.validation = {};
      result.validation.businessLogicValidation = businessLogicValidation;
      
      // Adjust overall confidence based on business logic validation
      if (businessLogicValidation.confidence < 0.8) {
        result.overallConfidence = Math.min(result.overallConfidence || 1.0, businessLogicValidation.confidence);
      }
    }

    logger.info('Enhanced business logic validation completed', {
      isValid: result.validation?.businessLogicValidation?.isValid,
      confidence: result.validation?.businessLogicValidation?.confidence,
      errorCount: result.validation?.businessLogicValidation?.errors?.length || 0,
      warningCount: result.validation?.businessLogicValidation?.warnings?.length || 0,
    });

    return result;
  }

  private async performBusinessLogicValidation(result: any, text: string, options: any): Promise<BusinessLogicValidationResult> {
    const validation: BusinessLogicValidationResult = {
      isValid: true,
      confidence: 1.0,
      errors: [],
      warnings: [],
    };

    // Industry-specific compliance validation
    if (options.industry) {
      validation.industryCompliance = await this.validateIndustryCompliance(result, text, options);
      if (!this.isComplianceValid(validation.industryCompliance)) {
        validation.isValid = false;
        validation.errors.push(`Industry compliance violations detected for ${options.industry}`);
      }
    }

    // General compliance checks
    validation.complianceChecks = await this.validateGeneralCompliance(result, text, options);
    if (!this.isComplianceValid(validation.complianceChecks)) {
      validation.warnings.push('Compliance issues detected');
    }

    // Workflow validation
    validation.workflowValidation = await this.validateWorkflow(result, text, options);
    if (!this.isWorkflowValid(validation.workflowValidation)) {
      validation.warnings.push('Workflow validation issues detected');
    }

    // Custom business rules
    if (options.customRules && Array.isArray(options.customRules)) {
      validation.customRules = await this.validateCustomRules(result, options.customRules);
      const failedRules = validation.customRules.filter(rule => !rule.isValid);
      if (failedRules.length > 0) {
        validation.warnings.push(`${failedRules.length} custom business rules failed`);
      }
    }

    // Risk assessment
    if (options.enableRiskAssessment) {
      validation.riskAssessment = await this.performRiskAssessment(result, text, options);
      if (validation.riskAssessment.overallRiskLevel > 0.7) {
        validation.warnings.push('High risk indicators detected');
      }
    }

    // Calculate overall confidence
    validation.confidence = this.calculateBusinessLogicConfidence(validation);

    return validation;
  }

  private initializeValidators(): void {
    // Initialize industry-specific validators
    this.industryValidators.set('healthcare', {
      validateNPI: (npi: string) => /^\d{10}$/.test(npi),
      validateProcedureCode: (code: string) => /^\d{5}$/.test(code),
      validateDiagnosisCode: (code: string) => /^[A-Z]\d{2}(\.\d{1,2})?$/.test(code),
    });

    this.industryValidators.set('construction', {
      validateLicense: (license: string) => /^C-\d{6}$/.test(license),
      validateRetention: (rate: number) => rate >= 0.05 && rate <= 0.15,
    });

    this.industryValidators.set('legal', {
      validateBarNumber: (barNumber: string) => /^\d{6}$/.test(barNumber),
      validateTimeEntry: (entry: any) => entry.hours > 0 && entry.rate > 0,
    });

    // Initialize compliance validators
    this.complianceValidators.set('tax', {
      validateTaxId: (taxId: string) => /^\d{2}-\d{7}$/.test(taxId),
      validateTaxRate: (rate: number, jurisdiction: string) => {
        const rates = { california: 0.0825, newyork: 0.08, texas: 0.0625 };
        return Math.abs(rate - (rates[jurisdiction.toLowerCase()] || 0.08)) < 0.01;
      },
    });

    this.complianceValidators.set('trade', {
      validateHSCode: (code: string) => /^\d{4}\.\d{2}\.\d{2}$/.test(code),
      validateIncoterms: (terms: string) => ['FOB', 'CIF', 'EXW', 'DDP'].includes(terms),
    });

    // Initialize workflow validators
    this.workflowValidators.set('poMatching', {
      calculateMatchScore: (invoice: any, po: any) => {
        let score = 0;
        let factors = 0;

        if (invoice.vendorName === po.vendorName) score += 1;
        factors++;

        if (Math.abs(invoice.totalAmount - po.totalAmount) < 0.01) score += 1;
        factors++;

        return factors > 0 ? score / factors : 0;
      },
    });
  }

  private async validateIndustryCompliance(result: any, text: string, options: any): Promise<IndustryComplianceResult> {
    const compliance: IndustryComplianceResult = {};

    switch (options.industry) {
      case 'healthcare':
        compliance.healthcare = this.validateHealthcareCompliance(result, text);
        break;
      case 'construction':
        compliance.construction = this.validateConstructionCompliance(result, text);
        break;
      case 'legal':
        compliance.legal = this.validateLegalCompliance(result, text);
        break;
    }

    return compliance;
  }

  private validateHealthcareCompliance(result: any, text: string): HealthcareComplianceResult {
    const npiMatch = text.match(/NPI:\s*(\d{10})/i);
    const procedureMatch = text.match(/Procedure Code:\s*(\d{5})/i);
    const diagnosisMatch = text.match(/Diagnosis Code:\s*([A-Z]\d{2}(?:\.\d{1,2})?)/i);

    return {
      npiValidation: {
        isValid: npiMatch ? this.industryValidators.get('healthcare').validateNPI(npiMatch[1]) : false,
        npi: npiMatch?.[1],
      },
      procedureCodeValidation: {
        isValid: procedureMatch ? this.industryValidators.get('healthcare').validateProcedureCode(procedureMatch[1]) : false,
        codes: procedureMatch ? [procedureMatch[1]] : [],
      },
      diagnosisCodeValidation: {
        isValid: diagnosisMatch ? this.industryValidators.get('healthcare').validateDiagnosisCode(diagnosisMatch[1]) : false,
        codes: diagnosisMatch ? [diagnosisMatch[1]] : [],
      },
      hipaaCompliance: {
        isValid: true, // Simplified for demo
        issues: [],
      },
    };
  }

  private validateConstructionCompliance(result: any, text: string): ConstructionComplianceResult {
    const licenseMatch = text.match(/License #:\s*(C-\d{6})/i);
    const retentionMatch = text.match(/Retention:\s*(\d+)%/i);

    return {
      licenseValidation: {
        isValid: licenseMatch ? this.industryValidators.get('construction').validateLicense(licenseMatch[1]) : false,
        license: licenseMatch?.[1],
      },
      retentionValidation: {
        isValid: retentionMatch ? this.industryValidators.get('construction').validateRetention(parseInt(retentionMatch[1]) / 100) : true,
        retentionRate: retentionMatch ? parseInt(retentionMatch[1]) / 100 : undefined,
      },
      prevailingWageCompliance: {
        isValid: true, // Simplified for demo
        issues: [],
      },
      safetyRequirements: {
        isValid: true, // Simplified for demo
        certifications: [],
      },
    };
  }

  private validateLegalCompliance(result: any, text: string): LegalComplianceResult {
    const barNumberMatch = text.match(/Bar Number:\s*(\d{6})/i);
    const timeEntries = this.extractTimeEntries(text);

    return {
      barNumberValidation: {
        isValid: barNumberMatch ? this.industryValidators.get('legal').validateBarNumber(barNumberMatch[1]) : false,
        barNumber: barNumberMatch?.[1],
      },
      timeEntryValidation: {
        isValid: timeEntries.every(entry => this.industryValidators.get('legal').validateTimeEntry(entry)),
        entries: timeEntries,
      },
      clientPrivilegeCompliance: {
        isValid: true, // Simplified for demo
        issues: [],
      },
      trustAccountCompliance: {
        isValid: true, // Simplified for demo
        issues: [],
      },
    };
  }

  private async validateGeneralCompliance(result: any, text: string, options: any): Promise<ComplianceChecksResult> {
    const compliance: ComplianceChecksResult = {};

    if (options.enableTaxCompliance) {
      compliance.tax = this.validateTaxCompliance(result, text);
    }

    if (options.enableTradeCompliance) {
      compliance.trade = this.validateTradeCompliance(result, text);
    }

    if (options.enablePrivacyCompliance) {
      compliance.privacy = this.validatePrivacyCompliance(result, text);
    }

    return compliance;
  }

  private validateTaxCompliance(result: any, text: string): TaxComplianceResult {
    const taxIdMatch = text.match(/Tax ID:\s*(\d{2}-\d{7})/i);
    const jurisdictionMatch = text.match(/Tax Jurisdiction:\s*(\w+)/i);

    return {
      taxIdValidation: {
        isValid: taxIdMatch ? this.complianceValidators.get('tax').validateTaxId(taxIdMatch[1]) : false,
        taxId: taxIdMatch?.[1],
      },
      taxRateCompliance: {
        isValid: true, // Simplified validation
        jurisdiction: jurisdictionMatch?.[1],
      },
      exemptionValidation: {
        isValid: true, // Simplified for demo
        exemptions: [],
      },
    };
  }

  private validateTradeCompliance(result: any, text: string): TradeComplianceResult {
    const hsCodeMatch = text.match(/HS Code:\s*(\d{4}\.\d{2}\.\d{2})/i);
    const incotermsMatch = text.match(/Incoterms:\s*(\w+)/i);
    const exportLicenseMatch = text.match(/Export License:\s*([A-Z0-9]+)/i);

    return {
      hsCodeValidation: {
        isValid: hsCodeMatch ? this.complianceValidators.get('trade').validateHSCode(hsCodeMatch[1]) : false,
        hsCode: hsCodeMatch?.[1],
      },
      incotermsValidation: {
        isValid: incotermsMatch ? this.complianceValidators.get('trade').validateIncoterms(incotermsMatch[1]) : false,
        incoterms: incotermsMatch?.[1],
      },
      exportLicenseValidation: {
        isValid: exportLicenseMatch ? true : false, // Simplified validation
        license: exportLicenseMatch?.[1],
      },
      sanctionsCheck: {
        isValid: true, // Simplified for demo
        issues: [],
      },
    };
  }

  private validatePrivacyCompliance(result: any, text: string): PrivacyComplianceResult {
    const gdprMatch = text.match(/GDPR Compliance:\s*(Yes|No)/i);
    const retentionMatch = text.match(/Data Retention:\s*(\d+\s*years?)/i);

    return {
      gdprCompliance: {
        isValid: gdprMatch?.[1]?.toLowerCase() === 'yes',
        issues: gdprMatch?.[1]?.toLowerCase() === 'no' ? ['GDPR compliance not confirmed'] : [],
      },
      ccpaCompliance: {
        isValid: true, // Simplified for demo
        issues: [],
      },
      dataRetentionCompliance: {
        isValid: retentionMatch ? true : false,
        retentionPeriod: retentionMatch?.[1],
      },
    };
  }

  private async validateWorkflow(result: any, text: string, options: any): Promise<WorkflowValidationResult> {
    const workflow: WorkflowValidationResult = {};

    if (options.enablePOMatching && options.purchaseOrderData) {
      workflow.poMatching = this.validatePOMatching(result, options.purchaseOrderData);
    }

    if (options.enableApprovalWorkflow && options.approvalRules) {
      workflow.approval = this.validateApprovalWorkflow(result, options.approvalRules);
    }

    if (options.enableBudgetValidation && options.budgetData) {
      workflow.budget = this.validateBudgetAllocation(result, options.budgetData);
    }

    return workflow;
  }

  private validatePOMatching(result: any, poData: any): POMatchingResult {
    const matchScore = this.workflowValidators.get('poMatching').calculateMatchScore(result, poData);
    
    return {
      isValid: matchScore > 0.8,
      matchScore,
      discrepancies: matchScore < 1.0 ? [
        { field: 'amount', expected: poData.totalAmount, actual: result.totalAmount }
      ] : [],
    };
  }

  private validateApprovalWorkflow(result: any, approvalRules: any): ApprovalValidationResult {
    const amount = result.totalAmount || 0;
    const requiredLevel = approvalRules.thresholds
      .filter((threshold: any) => amount >= threshold.amount)
      .pop()?.approverLevel || 'supervisor';

    return {
      isValid: true, // Simplified - would check actual approval status
      requiredApproverLevel: requiredLevel,
      currentApprovalStatus: 'pending',
      approvalChain: [requiredLevel],
    };
  }

  private validateBudgetAllocation(result: any, budgetData: any): BudgetValidationResult {
    const amount = result.totalAmount || 0;
    const newSpent = budgetData.spentToDate + amount;
    const utilization = newSpent / budgetData.allocatedBudget;
    const remaining = budgetData.allocatedBudget - newSpent;

    return {
      isValid: utilization <= 1.0,
      budgetUtilization: utilization,
      remainingBudget: remaining,
      budgetExceeded: utilization > 1.0,
    };
  }

  private async validateCustomRules(result: any, customRules: any[]): Promise<CustomRuleResult[]> {
    return customRules.map(rule => {
      const shouldApply = !rule.condition || rule.condition(result);
      
      if (!shouldApply) {
        return {
          ruleName: rule.name,
          isValid: true,
          message: 'Rule not applicable',
          confidence: 1.0,
        };
      }

      const validationResult = rule.validation(result);
      
      return {
        ruleName: rule.name,
        isValid: validationResult.isValid,
        message: validationResult.message,
        confidence: validationResult.isValid ? 0.9 : 0.3,
      };
    });
  }

  private async performRiskAssessment(result: any, text: string, options: any): Promise<RiskAssessmentResult> {
    const fraudRisk = this.assessFraudRisk(result, text);
    const duplicateRisk = this.assessDuplicateRisk(result, options.historicalInvoices || []);
    
    const overallRiskLevel = Math.max(fraudRisk.riskLevel, duplicateRisk.riskLevel);

    return {
      overallRiskLevel,
      fraudRisk,
      duplicateRisk,
    };
  }

  private assessFraudRisk(result: any, text: string): FraudRiskResult {
    const indicators: string[] = [];
    let riskLevel = 0;

    // Check for suspicious amount patterns
    if (result.totalAmount && result.totalAmount >= 9999 && result.totalAmount < 10000) {
      indicators.push('Amount just under $10,000 threshold');
      riskLevel += 0.3;
    }

    // Check for urgency indicators
    if (text.toLowerCase().includes('urgent') || text.toLowerCase().includes('immediate')) {
      indicators.push('Urgency indicators detected');
      riskLevel += 0.2;
    }

    // Check for new vendor
    if (text.toLowerCase().includes('new vendor')) {
      indicators.push('New vendor detected');
      riskLevel += 0.2;
    }

    // Check for foreign banking
    if (text.toLowerCase().includes('foreign bank') || text.toLowerCase().includes('wire transfer')) {
      indicators.push('Foreign banking or wire transfer');
      riskLevel += 0.3;
    }

    return {
      riskLevel: Math.min(riskLevel, 1.0),
      indicators,
      recommendations: indicators.length > 0 ? ['Additional verification recommended'] : [],
    };
  }

  private assessDuplicateRisk(result: any, historicalInvoices: any[]): DuplicateRiskResult {
    const potentialDuplicates: any[] = [];
    const similarityScores: number[] = [];

    for (const historical of historicalInvoices) {
      let similarity = 0;
      let factors = 0;

      if (result.invoiceNumber === historical.invoiceNumber) {
        similarity += 1;
      }
      factors++;

      if (result.vendorName === historical.vendorName) {
        similarity += 0.5;
      }
      factors++;

      if (Math.abs(result.totalAmount - historical.totalAmount) < 0.01) {
        similarity += 0.5;
      }
      factors++;

      const finalSimilarity = factors > 0 ? similarity / factors : 0;
      similarityScores.push(finalSimilarity);

      if (finalSimilarity > 0.8) {
        potentialDuplicates.push(historical);
      }
    }

    const riskLevel = potentialDuplicates.length > 0 ? Math.max(...similarityScores) : 0;

    return {
      riskLevel,
      potentialDuplicates,
      similarityScores,
    };
  }

  private extractTimeEntries(text: string): any[] {
    const timeEntryPattern = /(\d{2}\/\d{2}\/\d{2})\s*-\s*(.+?)\s*-\s*(.+?)\s*-\s*([\d.]+)\s*hrs?\s*@\s*\$?([\d,]+)\/hr/gi;
    const entries: any[] = [];
    let match;

    while ((match = timeEntryPattern.exec(text)) !== null) {
      entries.push({
        date: match[1],
        description: match[2],
        attorney: match[3],
        hours: parseFloat(match[4]),
        rate: parseFloat(match[5].replace(/,/g, '')),
      });
    }

    return entries;
  }

  private isComplianceValid(compliance: any): boolean {
    if (!compliance) return true;
    
    for (const [key, value] of Object.entries(compliance)) {
      if (typeof value === 'object' && value !== null) {
        if ('isValid' in value && !value.isValid) {
          return false;
        }
        if (!this.isComplianceValid(value)) {
          return false;
        }
      }
    }
    
    return true;
  }

  private isWorkflowValid(workflow: any): boolean {
    if (!workflow) return true;
    
    for (const [key, value] of Object.entries(workflow)) {
      if (typeof value === 'object' && value !== null && 'isValid' in value) {
        if (!value.isValid) {
          return false;
        }
      }
    }
    
    return true;
  }

  private calculateBusinessLogicConfidence(validation: BusinessLogicValidationResult): number {
    let confidence = 1.0;
    let factors = 0;

    // Factor in industry compliance
    if (validation.industryCompliance) {
      confidence += this.isComplianceValid(validation.industryCompliance) ? 1.0 : 0.5;
      factors++;
    }

    // Factor in general compliance
    if (validation.complianceChecks) {
      confidence += this.isComplianceValid(validation.complianceChecks) ? 1.0 : 0.7;
      factors++;
    }

    // Factor in workflow validation
    if (validation.workflowValidation) {
      confidence += this.isWorkflowValid(validation.workflowValidation) ? 1.0 : 0.6;
      factors++;
    }

    // Factor in custom rules
    if (validation.customRules) {
      const passedRules = validation.customRules.filter(rule => rule.isValid).length;
      const ruleConfidence = validation.customRules.length > 0 ? passedRules / validation.customRules.length : 1.0;
      confidence += ruleConfidence;
      factors++;
    }

    // Factor in risk assessment
    if (validation.riskAssessment) {
      const riskConfidence = 1.0 - validation.riskAssessment.overallRiskLevel;
      confidence += riskConfidence;
      factors++;
    }

    return factors > 0 ? confidence / factors : 1.0;
  }
}
