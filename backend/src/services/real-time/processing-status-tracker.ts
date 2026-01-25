/**
 * Processing Status Tracker
 * 
 * TDD Phase: GREEN - Minimal implementation for processing status tracking
 * Enhancement: Real-time Processing with WebSockets
 */

export interface ProcessingJob {
  userId: string;
  fileId: string;
  processingJobId: string;
  estimatedDuration: number;
  processingSteps: string[];
}

export interface ProcessingStep {
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  startedAt?: Date;
  completedAt?: Date;
  estimatedDuration: number;
  actualDuration?: number;
}

export interface ProcessingStatus {
  processingJobId: string;
  userId: string;
  fileId: string;
  status: string;
  currentStep: string;
  progress: number;
  estimatedTimeRemaining: number;
  startedAt: Date;
  steps: ProcessingStep[];
}

export interface StepCompletionResult {
  processingJobId: string;
  completedStep: string;
  nextStep: string;
  progress: number;
  estimatedTimeRemaining: number;
  stepResult: {
    success: boolean;
    duration: number;
    details: any;
  };
}

export interface ProcessingError {
  step: string;
  errorType: string;
  errorMessage: string;
  errorCode?: string;
  retryable: boolean;
  suggestedAction: string;
  technicalDetails?: any;
}

export interface ErrorResult {
  processingJobId: string;
  errorReported: boolean;
  errorDetails: ProcessingError;
  processingStatus: string;
  retryOptions: {
    canRetry: boolean;
    retryDelay: number;
    fallbackEngineAvailable: boolean;
    maxRetryAttempts: number;
  };
  userNotified: boolean;
  errorId: string;
}

export class ProcessingStatusTracker {
  private activeJobs: Map<string, ProcessingStatus> = new Map();
  private jobErrors: Map<string, ProcessingError[]> = new Map();
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async startProcessing(job: ProcessingJob): Promise<ProcessingStatus> {
    const steps: ProcessingStep[] = job.processingSteps.map((stepName, index) => ({
      name: stepName,
      status: index === 0 ? 'in_progress' : 'pending',
      startedAt: index === 0 ? new Date() : undefined,
      estimatedDuration: Math.floor(job.estimatedDuration / job.processingSteps.length)
    }));

    const status: ProcessingStatus = {
      processingJobId: job.processingJobId,
      userId: job.userId,
      fileId: job.fileId,
      status: 'started',
      currentStep: job.processingSteps[0],
      progress: 0,
      estimatedTimeRemaining: job.estimatedDuration,
      startedAt: new Date(),
      steps
    };

    this.activeJobs.set(job.processingJobId, status);
    return status;
  }

  async completeStep(
    processingJobId: string, 
    stepName: string, 
    result: { success: boolean; duration: number; details: any }
  ): Promise<StepCompletionResult> {
    const status = this.activeJobs.get(processingJobId);
    if (!status) {
      throw new Error(`Processing job ${processingJobId} not found`);
    }

    // Find and update the completed step
    const stepIndex = status.steps.findIndex(step => step.name === stepName);
    if (stepIndex === -1) {
      throw new Error(`Step ${stepName} not found in job ${processingJobId}`);
    }

    const step = status.steps[stepIndex];
    step.status = result.success ? 'completed' : 'failed';
    step.completedAt = new Date();
    step.actualDuration = result.duration;

    // Calculate progress
    const completedSteps = status.steps.filter(s => s.status === 'completed').length;
    const progress = Math.floor((completedSteps / status.steps.length) * 100);

    // Start next step if available
    let nextStep = '';
    if (stepIndex + 1 < status.steps.length && result.success) {
      const nextStepObj = status.steps[stepIndex + 1];
      nextStepObj.status = 'in_progress';
      nextStepObj.startedAt = new Date();
      nextStep = nextStepObj.name;
      status.currentStep = nextStep;
    }

    // Update estimated time remaining
    const remainingSteps = status.steps.filter(s => s.status === 'pending').length;
    const avgStepDuration = status.steps
      .filter(s => s.actualDuration)
      .reduce((sum, s) => sum + s.actualDuration!, 0) / Math.max(1, completedSteps);
    
    const estimatedTimeRemaining = remainingSteps * (avgStepDuration || 5000);

    status.progress = progress;
    status.estimatedTimeRemaining = estimatedTimeRemaining;

    return {
      processingJobId,
      completedStep: stepName,
      nextStep,
      progress,
      estimatedTimeRemaining,
      stepResult: result
    };
  }

  async reportError(processingJobId: string, error: ProcessingError): Promise<ErrorResult> {
    const status = this.activeJobs.get(processingJobId);
    if (!status) {
      throw new Error(`Processing job ${processingJobId} not found`);
    }

    // Store error
    const jobErrors = this.jobErrors.get(processingJobId) || [];
    jobErrors.push(error);
    this.jobErrors.set(processingJobId, jobErrors);

    // Update job status
    status.status = 'error';

    // Generate error ID
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    // Determine retry options
    const retryOptions = {
      canRetry: error.retryable,
      retryDelay: error.retryable ? 60000 : 0, // 1 minute delay
      fallbackEngineAvailable: error.suggestedAction === 'retry_with_fallback_engine',
      maxRetryAttempts: 3
    };

    return {
      processingJobId,
      errorReported: true,
      errorDetails: error,
      processingStatus: 'error',
      retryOptions,
      userNotified: true,
      errorId
    };
  }

  async getProcessingStatus(processingJobId: string): Promise<ProcessingStatus | null> {
    return this.activeJobs.get(processingJobId) || null;
  }

  async getUserActiveJobs(userId: string): Promise<ProcessingStatus[]> {
    return Array.from(this.activeJobs.values()).filter(job => job.userId === userId);
  }

  async cleanup(): Promise<void> {
    this.activeJobs.clear();
    this.jobErrors.clear();
    this.isInitialized = false;
  }
}

export default ProcessingStatusTracker;
