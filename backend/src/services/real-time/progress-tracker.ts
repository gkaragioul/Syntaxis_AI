/**
 * Progress Tracker
 * 
 * TDD Phase: GREEN - Minimal implementation for progress tracking
 * Enhancement: Real-time Processing with WebSockets
 */

export interface ProcessingConfig {
  fileSize: number;
  pageCount: number;
  documentType: string;
  processingOptions: {
    useGoogleVision: boolean;
    enableClassification: boolean;
    extractFields: boolean;
    qualityValidation: boolean;
  };
}

export interface StepEstimate {
  step: string;
  estimatedDuration: number;
  factors: string[];
}

export interface ProgressEstimate {
  totalEstimatedTime: number;
  stepEstimates: StepEstimate[];
  confidenceLevel: number;
  basedOnHistoricalData: boolean;
  similarProcessedFiles: number;
}

export class ProgressTracker {
  private historicalData: Map<string, number[]> = new Map(); // step -> durations
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
    this.initializeHistoricalData();
  }

  async estimateProcessingTime(config: ProcessingConfig): Promise<ProgressEstimate> {
    const stepEstimates: StepEstimate[] = [];
    let totalEstimatedTime = 0;

    // File validation
    const validationTime = this.estimateValidationTime(config.fileSize);
    stepEstimates.push({
      step: 'file_validation',
      estimatedDuration: validationTime,
      factors: ['file_size', 'format_complexity']
    });
    totalEstimatedTime += validationTime;

    // Image preprocessing
    const preprocessingTime = this.estimatePreprocessingTime(config.fileSize, config.pageCount);
    stepEstimates.push({
      step: 'image_preprocessing',
      estimatedDuration: preprocessingTime,
      factors: ['file_size', 'page_count', 'image_quality']
    });
    totalEstimatedTime += preprocessingTime;

    // OCR processing
    const ocrTime = this.estimateOcrTime(config);
    stepEstimates.push({
      step: 'ocr_processing',
      estimatedDuration: ocrTime,
      factors: ['page_count', 'image_quality', 'text_density', 'ocr_engine']
    });
    totalEstimatedTime += ocrTime;

    // Text extraction
    const extractionTime = this.estimateExtractionTime(config.pageCount);
    stepEstimates.push({
      step: 'text_extraction',
      estimatedDuration: extractionTime,
      factors: ['text_length', 'formatting_complexity']
    });
    totalEstimatedTime += extractionTime;

    // Document classification (if enabled)
    if (config.processingOptions.enableClassification) {
      const classificationTime = this.estimateClassificationTime(config);
      stepEstimates.push({
        step: 'document_classification',
        estimatedDuration: classificationTime,
        factors: ['text_length', 'document_complexity', 'ml_model_performance']
      });
      totalEstimatedTime += classificationTime;
    }

    // Field extraction (if enabled)
    if (config.processingOptions.extractFields) {
      const fieldExtractionTime = this.estimateFieldExtractionTime(config);
      stepEstimates.push({
        step: 'field_extraction',
        estimatedDuration: fieldExtractionTime,
        factors: ['document_type', 'field_complexity', 'extraction_rules']
      });
      totalEstimatedTime += fieldExtractionTime;
    }

    // Quality validation (if enabled)
    if (config.processingOptions.qualityValidation) {
      const validationTime = this.estimateQualityValidationTime(config);
      stepEstimates.push({
        step: 'quality_validation',
        estimatedDuration: validationTime,
        factors: ['text_quality', 'confidence_scores', 'validation_rules']
      });
      totalEstimatedTime += validationTime;
    }

    // Calculate confidence level based on historical data availability
    const confidenceLevel = this.calculateConfidenceLevel(stepEstimates);
    const similarProcessedFiles = this.getSimilarFileCount(config);

    return {
      totalEstimatedTime,
      stepEstimates,
      confidenceLevel,
      basedOnHistoricalData: true,
      similarProcessedFiles
    };
  }

  private estimateValidationTime(fileSize: number): number {
    // Base time + size factor
    const baseTime = 500; // 500ms base
    const sizeFactor = Math.min(fileSize / (1024 * 1024), 10) * 100; // Up to 1s for large files
    return Math.floor(baseTime + sizeFactor);
  }

  private estimatePreprocessingTime(fileSize: number, pageCount: number): number {
    const baseTime = 1000; // 1s base
    const sizeTime = (fileSize / (1024 * 1024)) * 500; // 500ms per MB
    const pageTime = pageCount * 200; // 200ms per page
    return Math.floor(baseTime + sizeTime + pageTime);
  }

  private estimateOcrTime(config: ProcessingConfig): number {
    let baseTime = 2000; // 2s base
    
    // Google Vision is faster
    if (config.processingOptions.useGoogleVision) {
      baseTime = 1500;
    }

    const pageTime = config.pageCount * 1000; // 1s per page
    const sizeTime = (config.fileSize / (1024 * 1024)) * 800; // 800ms per MB

    return Math.floor(baseTime + pageTime + sizeTime);
  }

  private estimateExtractionTime(pageCount: number): number {
    const baseTime = 300; // 300ms base
    const pageTime = pageCount * 100; // 100ms per page
    return Math.floor(baseTime + pageTime);
  }

  private estimateClassificationTime(config: ProcessingConfig): number {
    const baseTime = 500; // 500ms base
    const complexityFactor = config.documentType === 'contract' ? 1.5 : 1.0;
    const textLengthFactor = Math.min(config.pageCount * 0.2, 1.0); // More pages = more text
    
    return Math.floor(baseTime * complexityFactor * (1 + textLengthFactor));
  }

  private estimateFieldExtractionTime(config: ProcessingConfig): number {
    const baseTime = 800; // 800ms base
    
    // Different document types have different extraction complexity
    const complexityMultiplier = {
      'invoice': 1.2,
      'receipt': 1.0,
      'contract': 1.8,
      'other': 1.1
    }[config.documentType] || 1.0;

    return Math.floor(baseTime * complexityMultiplier);
  }

  private estimateQualityValidationTime(config: ProcessingConfig): number {
    const baseTime = 400; // 400ms base
    const pageTime = config.pageCount * 50; // 50ms per page
    return Math.floor(baseTime + pageTime);
  }

  private calculateConfidenceLevel(stepEstimates: StepEstimate[]): number {
    // Higher confidence if we have more historical data
    const stepsWithHistoricalData = stepEstimates.filter(step => 
      this.historicalData.has(step.step)
    ).length;
    
    const confidenceBase = 0.6; // 60% base confidence
    const historicalBonus = (stepsWithHistoricalData / stepEstimates.length) * 0.3; // Up to 30% bonus
    
    return Math.min(confidenceBase + historicalBonus, 0.95); // Max 95% confidence
  }

  private getSimilarFileCount(config: ProcessingConfig): number {
    // Mock similar file count based on document type and size
    const baseCount = {
      'invoice': 150,
      'receipt': 200,
      'contract': 80,
      'other': 100
    }[config.documentType] || 50;

    // Adjust based on file size similarity
    const sizeCategory = this.getSizeCategory(config.fileSize);
    const sizeFactor = {
      'small': 1.2,
      'medium': 1.0,
      'large': 0.8
    }[sizeCategory] || 1.0;

    return Math.floor(baseCount * sizeFactor);
  }

  private getSizeCategory(fileSize: number): string {
    if (fileSize < 1024 * 1024) return 'small'; // < 1MB
    if (fileSize < 5 * 1024 * 1024) return 'medium'; // < 5MB
    return 'large'; // >= 5MB
  }

  private initializeHistoricalData(): void {
    // Initialize with mock historical data
    this.historicalData.set('file_validation', [400, 500, 600, 450, 550]);
    this.historicalData.set('image_preprocessing', [1200, 1500, 1800, 1300, 1600]);
    this.historicalData.set('ocr_processing', [2500, 3000, 2800, 3200, 2900]);
    this.historicalData.set('text_extraction', [300, 400, 350, 380, 420]);
    this.historicalData.set('document_classification', [600, 700, 650, 720, 680]);
    this.historicalData.set('field_extraction', [900, 1100, 1000, 1050, 1150]);
    this.historicalData.set('quality_validation', [450, 500, 480, 520, 490]);
  }

  async recordActualDuration(step: string, duration: number): Promise<void> {
    const durations = this.historicalData.get(step) || [];
    durations.push(duration);
    
    // Keep only last 100 records per step
    if (durations.length > 100) {
      this.historicalData.set(step, durations.slice(-50));
    } else {
      this.historicalData.set(step, durations);
    }
  }

  async cleanup(): Promise<void> {
    this.historicalData.clear();
    this.isInitialized = false;
  }
}

export default ProgressTracker;
