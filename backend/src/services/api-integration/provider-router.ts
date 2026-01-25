// @ts-nocheck

/**
 * Provider Router
 *
 * TDD Phase: GREEN - Minimal implementation for intelligent provider routing
 * Enhancement: API Integration Expansion
 */

export interface DocumentAnalysisRequest {
  documentId: string;
  documentType: string;
  fileSize: number;
  pageCount: number;
  complexity: string;
  language: string;
  urgency: string;
  qualityRequirements: {
    accuracyThreshold: number;
    speedRequirement: string;
    costSensitivity: string;
  };
  userPreferences: {
    preferredProviders: string[];
    avoidProviders: string[];
    maxCostPerDocument: number;
  };
}

export interface ProviderSelection {
  documentId: string;
  selectedProvider: {
    providerId: string;
    providerName: string;
    confidence: number;
    selectionReason: string;
  };
  routingDecision: {
    primaryFactors: string[];
    scoringBreakdown: {
      costScore: number;
      accuracyScore: number;
      speedScore: number;
      capabilityScore: number;
      overallScore: number;
    };
    alternativeProviders: Array<{
      providerId: string;
      score: number;
      reason: string;
    }>;
  };
  estimatedCost: number;
  estimatedProcessingTime: number;
  fallbackStrategy: {
    fallbackProviders: string[];
    fallbackTriggers: string[];
    maxRetryAttempts: number;
  };
}

export class ProviderRouter {
  private providerCapabilities: Map<string, any> = new Map();
  private routingHistory: Map<string, any> = new Map();
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.setupProviderCapabilities();
    this.isInitialized = true;
  }

  async selectOptimalProvider(request: DocumentAnalysisRequest): Promise<ProviderSelection> {
    // Score all available providers
    const providerScores = this.scoreProviders(request);

    // Select best provider
    const selectedProvider = this.selectBestProvider(providerScores, request);

    // Generate routing decision details
    const routingDecision = this.generateRoutingDecision(providerScores, request);

    // Calculate estimates
    const estimatedCost = this.estimateCost(selectedProvider.providerId, request);
    const estimatedProcessingTime = this.estimateProcessingTime(selectedProvider.providerId, request);

    // Generate fallback strategy
    const fallbackStrategy = this.generateFallbackStrategy(providerScores, selectedProvider.providerId);

    const selection: ProviderSelection = {
      documentId: request.documentId,
      selectedProvider,
      routingDecision,
      estimatedCost,
      estimatedProcessingTime,
      fallbackStrategy
    };

    // Store routing decision for learning
    this.routingHistory.set(request.documentId, selection);

    return selection;
  }

  private setupProviderCapabilities(): void {
    this.providerCapabilities.set('google_vision', {
      strengths: ['speed', 'general_accuracy', 'language_support'],
      weaknesses: ['cost', 'form_extraction'],
      costPerRequest: 0.0015,
      averageProcessingTime: 1200,
      accuracyRating: 0.94,
      supportedTypes: ['invoice', 'receipt', 'document', 'image']
    });

    this.providerCapabilities.set('aws_textract', {
      strengths: ['form_extraction', 'table_extraction', 'accuracy'],
      weaknesses: ['speed', 'cost'],
      costPerPage: 0.05,
      averageProcessingTime: 3500,
      accuracyRating: 0.96,
      supportedTypes: ['form', 'invoice', 'contract', 'table']
    });

    this.providerCapabilities.set('azure_document_intelligence', {
      strengths: ['speed', 'custom_models', 'layout_analysis'],
      weaknesses: ['cost_for_complex'],
      costPerTransaction: 0.01,
      averageProcessingTime: 800,
      accuracyRating: 0.95,
      supportedTypes: ['receipt', 'invoice', 'form', 'contract']
    });

    this.providerCapabilities.set('tesseract', {
      strengths: ['cost', 'privacy', 'offline'],
      weaknesses: ['accuracy', 'speed', 'complex_documents'],
      costPerRequest: 0,
      averageProcessingTime: 5000,
      accuracyRating: 0.85,
      supportedTypes: ['simple_text', 'receipt', 'basic_document']
    });
  }

  private scoreProviders(request: DocumentAnalysisRequest): Map<string, any> {
    const scores = new Map();

    for (const [providerId, capabilities] of this.providerCapabilities) {
      // Skip avoided providers
      if (request.userPreferences.avoidProviders.includes(providerId)) {
        continue;
      }

      const score = this.calculateProviderScore(providerId, capabilities, request);
      scores.set(providerId, score);
    }

    return scores;
  }

  private calculateProviderScore(providerId: string, capabilities: any, request: DocumentAnalysisRequest): any {
    let costScore = 0;
    let accuracyScore = 0;
    let speedScore = 0;
    let capabilityScore = 0;

    // Cost scoring
    const estimatedCost = this.estimateCost(providerId, request);
    if (estimatedCost <= request.userPreferences.maxCostPerDocument) {
      costScore = Math.max(0, 1 - (estimatedCost / request.userPreferences.maxCostPerDocument));
    }

    // Accuracy scoring
    accuracyScore = capabilities.accuracyRating;

    // Speed scoring
    const speedRequirement = request.qualityRequirements.speedRequirement;
    const processingTime = capabilities.averageProcessingTime;
    if (speedRequirement === 'fast') {
      speedScore = Math.max(0, 1 - (processingTime / 2000)); // Prefer under 2s
    } else if (speedRequirement === 'normal') {
      speedScore = Math.max(0, 1 - (processingTime / 5000)); // Prefer under 5s
    } else {
      speedScore = 0.8; // Thorough doesn't prioritize speed
    }

    // Capability scoring
    capabilityScore = capabilities.supportedTypes.includes(request.documentType) ? 1.0 : 0.5;

    // Weighted overall score based on cost sensitivity
    let weights;
    switch (request.qualityRequirements.costSensitivity) {
      case 'high':
        weights = { cost: 0.5, accuracy: 0.2, speed: 0.2, capability: 0.1 };
        break;
      case 'medium':
        weights = { cost: 0.3, accuracy: 0.3, speed: 0.2, capability: 0.2 };
        break;
      case 'low':
        weights = { cost: 0.1, accuracy: 0.4, speed: 0.3, capability: 0.2 };
        break;
      default:
        weights = { cost: 0.25, accuracy: 0.25, speed: 0.25, capability: 0.25 };
    }

    const overallScore =
      costScore * weights.cost +
      accuracyScore * weights.accuracy +
      speedScore * weights.speed +
      capabilityScore * weights.capability;

    return {
      costScore,
      accuracyScore,
      speedScore,
      capabilityScore,
      overallScore,
      estimatedCost,
      estimatedProcessingTime: processingTime
    };
  }

  private selectBestProvider(scores: Map<string, any>, request: DocumentAnalysisRequest): any {
    let bestProvider = null;
    let bestScore = -1;

    // Prefer user's preferred providers
    for (const preferredId of request.userPreferences.preferredProviders) {
      const score = scores.get(preferredId);
      if (score && score.overallScore > bestScore) {
        bestScore = score.overallScore;
        bestProvider = {
          providerId: preferredId,
          providerName: this.getProviderName(preferredId),
          confidence: score.overallScore,
          selectionReason: `Preferred provider with score ${score.overallScore.toFixed(3)}`
        };
      }
    }

    // If no preferred provider or they scored poorly, select best overall
    if (!bestProvider) {
      for (const [providerId, score] of scores) {
        if (score.overallScore > bestScore) {
          bestScore = score.overallScore;
          bestProvider = {
            providerId,
            providerName: this.getProviderName(providerId),
            confidence: score.overallScore,
            selectionReason: `Best overall score ${score.overallScore.toFixed(3)}`
          };
        }
      }
    }

    return bestProvider || {
      providerId: 'tesseract',
      providerName: 'Tesseract OCR',
      confidence: 0.5,
      selectionReason: 'Fallback provider - no other providers available'
    };
  }

  private generateRoutingDecision(scores: Map<string, any>, request: DocumentAnalysisRequest): any {
    const primaryFactors = [];

    if (request.qualityRequirements.costSensitivity === 'high') {
      primaryFactors.push('cost');
    }
    if (request.qualityRequirements.accuracyThreshold > 0.9) {
      primaryFactors.push('accuracy');
    }
    if (request.qualityRequirements.speedRequirement === 'fast') {
      primaryFactors.push('speed');
    }
    if (request.documentType !== 'other') {
      primaryFactors.push('capability');
    }

    // Get best score for scoring breakdown
    const bestScore = Math.max(...Array.from(scores.values()).map(s => s.overallScore));
    const bestProvider = Array.from(scores.entries()).find(([, score]) => score.overallScore === bestScore);
    const scoringBreakdown = bestProvider ? bestProvider[1] : {
      costScore: 0, accuracyScore: 0, speedScore: 0, capabilityScore: 0, overallScore: 0
    };

    // Generate alternatives
    const alternativeProviders = Array.from(scores.entries())
      .filter(([providerId]) => providerId !== bestProvider?.[0])
      .sort(([, a], [, b]) => b.overallScore - a.overallScore)
      .slice(0, 2)
      .map(([providerId, score]) => ({
        providerId,
        score: score.overallScore,
        reason: `Alternative with score ${score.overallScore.toFixed(3)}`
      }));

    return {
      primaryFactors,
      scoringBreakdown,
      alternativeProviders
    };
  }

  private generateFallbackStrategy(scores: Map<string, any>, selectedProviderId: string): any {
    const fallbackProviders = Array.from(scores.entries())
      .filter(([providerId]) => providerId !== selectedProviderId)
      .sort(([, a], [, b]) => b.overallScore - a.overallScore)
      .slice(0, 2)
      .map(([providerId]) => providerId);

    return {
      fallbackProviders,
      fallbackTriggers: ['rate_limit_exceeded', 'service_unavailable', 'timeout', 'accuracy_below_threshold'],
      maxRetryAttempts: 3
    };
  }

  private estimateCost(providerId: string, request: DocumentAnalysisRequest): number {
    const capabilities = this.providerCapabilities.get(providerId);
    if (!capabilities) return 0;

    if (capabilities.costPerRequest) {
      return capabilities.costPerRequest;
    } else if (capabilities.costPerPage) {
      return capabilities.costPerPage * request.pageCount;
    } else if (capabilities.costPerTransaction) {
      return capabilities.costPerTransaction;
    }

    return 0;
  }

  private estimateProcessingTime(providerId: string, request: DocumentAnalysisRequest): number {
    const capabilities = this.providerCapabilities.get(providerId);
    if (!capabilities) return 5000;

    let baseTime = capabilities.averageProcessingTime;

    // Adjust for complexity
    if (request.complexity === 'high') {
      baseTime *= 1.5;
    } else if (request.complexity === 'low') {
      baseTime *= 0.8;
    }

    // Adjust for file size
    const sizeFactor = Math.min(request.fileSize / (1024 * 1024), 5); // Max 5x for large files
    baseTime *= (1 + sizeFactor * 0.1);

    return Math.floor(baseTime);
  }

  private getProviderName(providerId: string): string {
    const names = {
      'google_vision': 'Google Cloud Vision API',
      'aws_textract': 'Amazon Textract',
      'azure_document_intelligence': 'Azure Document Intelligence',
      'tesseract': 'Tesseract OCR'
    };
    return names[providerId] || providerId;
  }

  async cleanup(): Promise<void> {
    this.providerCapabilities.clear();
    this.routingHistory.clear();
    this.isInitialized = false;
  }
}

export default ProviderRouter;
