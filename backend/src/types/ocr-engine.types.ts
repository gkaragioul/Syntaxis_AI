/**
 * OCR Engine Types
 * 
 * TDD Phase: RED - Type definitions for OCR Engine Manager
 * Task: 2.1 - Google Vision API Integration
 * 
 * This defines the types for multi-engine OCR system with fallback capabilities.
 */

export interface OcrEngine {
  name: string;
  priority: number;
  isAvailable: boolean;
  capabilities: string[];
  supportedFormats: string[];
  maxFileSize: number;
}

export interface OcrProcessingResult {
  success: boolean;
  engineUsed: string | null;
  extractedText: string;
  confidence: number;
  processingTime: number;
  fallbackAttempts: number;
  fallbackReason?: string;
  errors?: string[];
  recommendation?: string;
}

export interface OcrAggregationOptions {
  useMultipleEngines: boolean;
  confidenceThreshold: number;
}

export interface OcrAggregatedResult {
  success: boolean;
  enginesUsed: string[];
  aggregatedText: string;
  confidence: number;
  engineResults: Array<{
    engine: string;
    text: string;
    confidence: number;
  }>;
  consensusScore: number;
  processingTime: number;
}

export interface OcrEnginePerformanceMetrics {
  [engineName: string]: {
    totalRequests: number;
    successfulRequests: number;
    failedRequests: number;
    averageResponseTime: number;
    averageConfidence: number;
    successRate: number;
    lastUsed: Date | null;
  };
}

export interface OcrServiceResult {
  success: boolean;
  fileId: string;
  extractedText: string;
  confidence: number;
  engineUsed: string;
  processingTime: number;
  ocrResultId: string;
  createdAt: Date;
}

export default OcrEngine;
