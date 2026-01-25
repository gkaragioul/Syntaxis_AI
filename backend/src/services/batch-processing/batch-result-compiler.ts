/**
 * Batch Result Compiler
 * 
 * TDD Phase: GREEN - Minimal implementation for batch result compilation
 * Enhancement: Batch Processing Capabilities
 */

export interface SuccessfulDocument {
  fileId: string;
  filename: string;
  processingResult: {
    extractedText: string;
    classification: {
      type: string;
      confidence: number;
    };
    extractedFields: Record<string, any>;
  };
}

export interface FailedDocument {
  fileId: string;
  filename: string;
  error: {
    errorType: string;
    errorMessage: string;
    finalAttempt: boolean;
  };
}

export interface CompilationRequest {
  batchJobId: string;
  successfulDocuments: SuccessfulDocument[];
  failedDocuments: FailedDocument[];
}

export interface CompiledResults {
  batchJobId: string;
  batchStatus: string;
  summary: {
    totalDocuments: number;
    successfulDocuments: number;
    failedDocuments: number;
    successRate: number;
    totalProcessingTime: number;
  };
  successfulResults: Array<{
    fileId: string;
    classification: {
      type: string;
      confidence: number;
    };
    extractedFields: Record<string, any>;
  }>;
  failureAnalysis: {
    failureReasons: string[];
    retryableFailures: number;
    permanentFailures: number;
    recommendations: string[];
  };
  aggregatedData: {
    documentTypes: Record<string, number>;
    totalExtractedAmount: number;
    averageConfidence: number;
  };
  downloadLinks: {
    successfulResultsExport: string;
    failureReport: string;
    batchSummaryReport: string;
  };
}

export class BatchResultCompiler {
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async compilePartialResults(request: CompilationRequest): Promise<CompiledResults> {
    const totalDocuments = request.successfulDocuments.length + request.failedDocuments.length;
    const successfulCount = request.successfulDocuments.length;
    const failedCount = request.failedDocuments.length;
    const successRate = totalDocuments > 0 ? successfulCount / totalDocuments : 0;

    // Compile successful results
    const successfulResults = request.successfulDocuments.map(doc => ({
      fileId: doc.fileId,
      classification: doc.processingResult.classification,
      extractedFields: doc.processingResult.extractedFields
    }));

    // Analyze failures
    const failureAnalysis = this.analyzeFailures(request.failedDocuments);

    // Aggregate data from successful documents
    const aggregatedData = this.aggregateSuccessfulData(request.successfulDocuments);

    // Generate download links
    const downloadLinks = this.generateDownloadLinks(request.batchJobId);

    // Determine batch status
    const batchStatus = this.determineBatchStatus(successRate, failedCount);

    return {
      batchJobId: request.batchJobId,
      batchStatus,
      summary: {
        totalDocuments,
        successfulDocuments: successfulCount,
        failedDocuments: failedCount,
        successRate: Math.round(successRate * 100) / 100, // Round to 2 decimal places
        totalProcessingTime: this.estimateTotalProcessingTime(totalDocuments)
      },
      successfulResults,
      failureAnalysis,
      aggregatedData,
      downloadLinks
    };
  }

  private analyzeFailures(failedDocuments: FailedDocument[]): CompiledResults['failureAnalysis'] {
    const failureReasons = [...new Set(failedDocuments.map(doc => doc.error.errorType))];
    const retryableFailures = failedDocuments.filter(doc => !doc.error.finalAttempt).length;
    const permanentFailures = failedDocuments.filter(doc => doc.error.finalAttempt).length;

    const recommendations = this.generateFailureRecommendations(failureReasons, retryableFailures);

    return {
      failureReasons,
      retryableFailures,
      permanentFailures,
      recommendations
    };
  }

  private aggregateSuccessfulData(successfulDocuments: SuccessfulDocument[]): CompiledResults['aggregatedData'] {
    // Count document types
    const documentTypes: Record<string, number> = {};
    let totalExtractedAmount = 0;
    let totalConfidence = 0;

    for (const doc of successfulDocuments) {
      const docType = doc.processingResult.classification.type;
      documentTypes[docType] = (documentTypes[docType] || 0) + 1;

      // Extract monetary amounts
      const fields = doc.processingResult.extractedFields;
      if (fields.total || fields.totalAmount || fields.amount) {
        const amount = fields.total || fields.totalAmount || fields.amount;
        if (typeof amount === 'number') {
          totalExtractedAmount += amount;
        }
      }

      totalConfidence += doc.processingResult.classification.confidence;
    }

    const averageConfidence = successfulDocuments.length > 0 
      ? totalConfidence / successfulDocuments.length 
      : 0;

    return {
      documentTypes,
      totalExtractedAmount: Math.round(totalExtractedAmount * 100) / 100,
      averageConfidence: Math.round(averageConfidence * 100) / 100
    };
  }

  private generateDownloadLinks(batchJobId: string): CompiledResults['downloadLinks'] {
    const baseUrl = '/api/batch-results';
    
    return {
      successfulResultsExport: `${baseUrl}/${batchJobId}/successful-results.json`,
      failureReport: `${baseUrl}/${batchJobId}/failure-report.json`,
      batchSummaryReport: `${baseUrl}/${batchJobId}/summary-report.pdf`
    };
  }

  private determineBatchStatus(successRate: number, failedCount: number): string {
    if (successRate === 1.0) return 'completed';
    if (successRate >= 0.8) return 'mostly_completed';
    if (successRate >= 0.5) return 'partially_completed';
    if (failedCount > 0 && successRate === 0) return 'failed';
    return 'partially_completed';
  }

  private estimateTotalProcessingTime(totalDocuments: number): number {
    // Estimate based on average processing time per document
    const avgProcessingTimePerDoc = 15000; // 15 seconds
    return totalDocuments * avgProcessingTimePerDoc;
  }

  private generateFailureRecommendations(
    failureReasons: string[], 
    retryableFailures: number
  ): string[] {
    const recommendations: string[] = [];

    if (failureReasons.includes('CORRUPTED_FILE')) {
      recommendations.push('Review file quality before uploading');
      recommendations.push('Consider using different file formats (PDF instead of images)');
    }

    if (failureReasons.includes('API_RATE_LIMIT')) {
      recommendations.push('Consider upgrading API plan for higher rate limits');
      recommendations.push('Implement batch processing with delays between requests');
    }

    if (failureReasons.includes('NETWORK_ERROR')) {
      recommendations.push('Check network connectivity and retry failed documents');
      recommendations.push('Consider processing during off-peak hours');
    }

    if (retryableFailures > 0) {
      recommendations.push(`${retryableFailures} documents can be retried automatically`);
    }

    if (recommendations.length === 0) {
      recommendations.push('All failures appear to be permanent - manual review recommended');
    }

    return recommendations;
  }

  async cleanup(): Promise<void> {
    this.isInitialized = false;
  }
}

export default BatchResultCompiler;
