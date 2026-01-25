/**
 * Multi-Engine OCR Fallback Service
 * 
 * Task 2.1.4: Fallback Logic Implementation - TDD GREEN Phase
 * 
 * This is the minimal implementation to make the failing tests pass.
 * Following TDD: Red-Green-Refactor approach.
 */

import { Logger } from 'winston';
import { logger } from '../../utils/logger';

// Types for multi-engine OCR system
interface OCREngine {
  name: string;
  priority: number;
  isAvailable(): Promise<boolean>;
  processImage(imageBuffer: Buffer): Promise<OCRResult>;
  getHealthStatus(): Promise<EngineHealthStatus>;
}

interface OCRResult {
  confidence: number;
  extractedText: string;
  boundingBoxes: Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    confidence: number;
  }>;
  processingTime: number;
  engine: string;
}

interface EngineHealthStatus {
  isHealthy: boolean;
  responseTime: number;
  errorRate: number;
  lastError?: string;
}

interface FallbackConfig {
  engines: OCREngine[];
  confidenceThreshold: number;
  maxRetries: number;
  timeoutMs: number;
  enableParallelProcessing: boolean;
}

interface FallbackResult extends OCRResult {
  engineUsed: string;
  fallbacksAttempted: string[];
  totalProcessingTime: number;
  isFromFallback: boolean;
}

/**
 * Multi-Engine OCR Service with Fallback Support
 * GREEN: Minimal implementation to pass tests
 */
export class MultiEngineOCRService {
  private engines: OCREngine[];
  private config: FallbackConfig;
  private logger: Logger;

  constructor(config: FallbackConfig) {
    this.logger = logger.child({ service: 'MultiEngineOCRService' });
    
    // GREEN: Basic validation to pass configuration tests
    if (!config.engines || config.engines.length === 0) {
      throw new Error('Invalid configuration: at least one engine required');
    }

    if (config.confidenceThreshold < 0 || config.confidenceThreshold > 1) {
      throw new Error('Invalid configuration: confidenceThreshold must be between 0 and 1');
    }

    if (config.maxRetries < 0) {
      throw new Error('Invalid configuration: maxRetries cannot be negative');
    }

    if (config.timeoutMs <= 0) {
      throw new Error('Invalid configuration: timeoutMs must be positive');
    }

    this.config = config;
    this.engines = [...config.engines].sort((a, b) => a.priority - b.priority);
    
    this.logger.info('Multi-Engine OCR Service initialized', {
      engineCount: this.engines.length,
      confidenceThreshold: config.confidenceThreshold,
    });
  }

  /**
   * Get available engines in priority order
   * GREEN: Simple implementation to pass tests
   */
  getAvailableEngines(): string[] {
    return this.engines.map(engine => engine.name);
  }

  /**
   * Set engine order by name
   * GREEN: Reorder engines based on provided names
   */
  setEngineOrder(engineNames: string[]): void {
    const reorderedEngines: OCREngine[] = [];
    
    // Add engines in the specified order
    engineNames.forEach((name, index) => {
      const engine = this.engines.find(e => e.name === name);
      if (engine) {
        engine.priority = index + 1;
        reorderedEngines.push(engine);
      }
    });

    // Add any remaining engines
    this.engines.forEach(engine => {
      if (!reorderedEngines.includes(engine)) {
        reorderedEngines.push(engine);
      }
    });

    this.engines = reorderedEngines;
  }

  /**
   * Add new engine to the service
   * GREEN: Simple engine addition
   */
  async addEngine(engine: OCREngine): Promise<void> {
    this.engines.push(engine);
    this.engines.sort((a, b) => a.priority - b.priority);
    
    this.logger.info('Engine added', { engineName: engine.name, priority: engine.priority });
  }

  /**
   * Remove engine from the service
   * GREEN: Simple engine removal
   */
  async removeEngine(engineName: string): Promise<void> {
    this.engines = this.engines.filter(engine => engine.name !== engineName);
    
    this.logger.info('Engine removed', { engineName });
  }

  /**
   * Get health status of all engines
   * GREEN: Collect health status from all engines
   */
  async getEngineStatus(): Promise<{ [engineName: string]: EngineHealthStatus }> {
    const status: { [engineName: string]: EngineHealthStatus } = {};

    for (const engine of this.engines) {
      try {
        status[engine.name] = await engine.getHealthStatus();
      } catch (error) {
        status[engine.name] = {
          isHealthy: false,
          responseTime: 0,
          errorRate: 1,
          lastError: (error as Error).message,
        };
      }
    }

    return status;
  }

  /**
   * Process image with primary engine
   * GREEN: Basic processing with fallback support
   */
  async processImage(imageBuffer: Buffer): Promise<FallbackResult> {
    return this.processImageWithFallback(imageBuffer);
  }

  /**
   * Process image with fallback support
   * GREEN: Implement fallback logic to pass tests
   */
  async processImageWithFallback(imageBuffer: Buffer, preferredEngine?: string): Promise<FallbackResult> {
    const startTime = Date.now();
    const fallbacksAttempted: string[] = [];
    let lastError: Error | null = null;

    // Determine engine order
    let engineOrder = [...this.engines];
    if (preferredEngine) {
      const preferred = this.engines.find(e => e.name === preferredEngine);
      if (preferred) {
        engineOrder = [preferred, ...this.engines.filter(e => e.name !== preferredEngine)];
      }
    }

    // Try engines in order
    for (const engine of engineOrder) {
      try {
        // Check if engine is available
        const isAvailable = await engine.isAvailable();
        if (!isAvailable) {
          fallbacksAttempted.push(engine.name);
          continue;
        }

        // Process with timeout
        const result = await this.processWithTimeout(engine, imageBuffer);

        // Check confidence threshold
        if (result.confidence >= this.config.confidenceThreshold) {
          const totalProcessingTime = Date.now() - startTime;
          
          return {
            ...result,
            engineUsed: engine.name,
            fallbacksAttempted,
            totalProcessingTime,
            isFromFallback: fallbacksAttempted.length > 0,
          };
        } else {
          // Low confidence, try next engine
          fallbacksAttempted.push(engine.name);
          this.logger.warn('Low confidence result, trying fallback', {
            engine: engine.name,
            confidence: result.confidence,
            threshold: this.config.confidenceThreshold,
          });
        }

      } catch (error) {
        lastError = error as Error;
        fallbacksAttempted.push(engine.name);

        this.logger.warn('Engine processing failed, trying fallback', {
          engine: engine.name,
          error: (error as Error).message,
        });
      }
    }

    // All engines failed
    throw new Error(`All OCR engines failed. Last error: ${lastError?.message || 'Unknown error'}`);
  }

  /**
   * Process image with timeout
   * GREEN: Helper method to handle timeouts
   */
  private async processWithTimeout(engine: OCREngine, imageBuffer: Buffer): Promise<OCRResult> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Processing timeout'));
      }, this.config.timeoutMs);

      engine.processImage(imageBuffer)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
}

// Export for use in other services
export default MultiEngineOCRService;
