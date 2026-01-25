/**
 * Batch Progress Aggregator
 * 
 * TDD Phase: GREEN - Minimal implementation for batch progress aggregation
 * Enhancement: Batch Processing Capabilities
 */

export interface DocumentProgressUpdate {
  fileId: string;
  progress: number;
  status: string;
  step: string;
}

export interface AggregatedProgress {
  batchJobId: string;
  overallProgress: number;
  totalDocuments: number;
  documentsQueued: number;
  documentsProcessing: number;
  documentsCompleted: number;
  documentsFailed: number;
  averageProgress: number;
  estimatedTimeRemaining: number;
  processingRate: number;
  progressDistribution: {
    '0-25%': number;
    '26-50%': number;
    '51-75%': number;
    '76-100%': number;
  };
  bottlenecks: string[];
  lastUpdated: Date;
}

export class BatchProgressAggregator {
  private batchProgress: Map<string, Map<string, DocumentProgressUpdate>> = new Map();
  private batchMetadata: Map<string, any> = new Map();
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async updateDocumentProgress(batchJobId: string, update: DocumentProgressUpdate): Promise<void> {
    if (!this.batchProgress.has(batchJobId)) {
      this.batchProgress.set(batchJobId, new Map());
    }

    const batchDocuments = this.batchProgress.get(batchJobId)!;
    batchDocuments.set(update.fileId, update);

    // Update metadata
    if (!this.batchMetadata.has(batchJobId)) {
      this.batchMetadata.set(batchJobId, {
        totalDocuments: 0,
        startTime: new Date()
      });
    }

    const metadata = this.batchMetadata.get(batchJobId)!;
    metadata.totalDocuments = Math.max(metadata.totalDocuments, batchDocuments.size);
    metadata.lastUpdated = new Date();
  }

  async getAggregatedProgress(batchJobId: string): Promise<AggregatedProgress> {
    const batchDocuments = this.batchProgress.get(batchJobId);
    const metadata = this.batchMetadata.get(batchJobId);

    if (!batchDocuments || !metadata) {
      throw new Error(`Batch job ${batchJobId} not found`);
    }

    const documents = Array.from(batchDocuments.values());
    const totalDocuments = documents.length;

    // Calculate status counts
    const documentsQueued = documents.filter(doc => doc.status === 'queued').length;
    const documentsProcessing = documents.filter(doc => doc.status === 'processing').length;
    const documentsCompleted = documents.filter(doc => doc.status === 'completed').length;
    const documentsFailed = documents.filter(doc => doc.status === 'failed').length;

    // Calculate overall progress
    const totalProgress = documents.reduce((sum, doc) => sum + doc.progress, 0);
    const overallProgress = totalDocuments > 0 ? totalProgress / totalDocuments : 0;
    const averageProgress = overallProgress;

    // Calculate estimated time remaining
    const completedDocuments = documentsCompleted;
    const elapsedTime = Date.now() - metadata.startTime.getTime();
    const processingRate = completedDocuments > 0 ? (completedDocuments / (elapsedTime / 60000)) : 0; // docs per minute
    const remainingDocuments = totalDocuments - completedDocuments;
    const estimatedTimeRemaining = processingRate > 0 ? (remainingDocuments / processingRate) * 60000 : 0;

    // Calculate progress distribution
    const progressDistribution = {
      '0-25%': documents.filter(doc => doc.progress >= 0 && doc.progress <= 25).length,
      '26-50%': documents.filter(doc => doc.progress > 25 && doc.progress <= 50).length,
      '51-75%': documents.filter(doc => doc.progress > 50 && doc.progress <= 75).length,
      '76-100%': documents.filter(doc => doc.progress > 75 && doc.progress <= 100).length
    };

    // Identify bottlenecks
    const bottlenecks = this.identifyBottlenecks(documents);

    return {
      batchJobId,
      overallProgress,
      totalDocuments,
      documentsQueued,
      documentsProcessing,
      documentsCompleted,
      documentsFailed,
      averageProgress,
      estimatedTimeRemaining,
      processingRate,
      progressDistribution,
      bottlenecks,
      lastUpdated: metadata.lastUpdated || new Date()
    };
  }

  private identifyBottlenecks(documents: DocumentProgressUpdate[]): string[] {
    const bottlenecks: string[] = [];

    // Check for documents stuck in processing
    const stuckDocuments = documents.filter(doc => 
      doc.status === 'processing' && doc.progress < 50
    );

    if (stuckDocuments.length > documents.length * 0.3) {
      bottlenecks.push('high_number_of_slow_processing_documents');
    }

    // Check for failed documents
    const failedDocuments = documents.filter(doc => doc.status === 'failed');
    if (failedDocuments.length > documents.length * 0.1) {
      bottlenecks.push('high_failure_rate');
    }

    // Check for queue buildup
    const queuedDocuments = documents.filter(doc => doc.status === 'queued');
    if (queuedDocuments.length > documents.length * 0.5) {
      bottlenecks.push('processing_queue_buildup');
    }

    return bottlenecks;
  }

  async cleanup(): Promise<void> {
    this.batchProgress.clear();
    this.batchMetadata.clear();
    this.isInitialized = false;
  }
}

export default BatchProgressAggregator;
