import { Worker, createWorker } from 'tesseract.js';
import { logger } from './logger';

export class OCRWorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private maxWorkers: number;
  private initializationPromise: Promise<void> | null = null;

  constructor(maxWorkers: number = 4) {
    this.maxWorkers = maxWorkers;
  }

  async init(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = (async () => {
      try {
        // Initialize workers
        for (let i = 0; i < this.maxWorkers; i++) {
          const worker = await createWorker();
          await worker.reinitialize('eng');
          this.workers.push(worker);
          this.availableWorkers.push(worker);
        }

        logger.info(
          `OCR worker pool initialized with ${this.maxWorkers} workers`,
        );
      } catch (error) {
        logger.error('Failed to initialize OCR worker pool:', error);
        throw error;
      }
    })();

    return this.initializationPromise;
  }

  async acquire(): Promise<Worker> {
    await this.ensureInitialized();

    if (this.availableWorkers.length === 0) {
      // Wait for a worker to become available
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (this.availableWorkers.length > 0) {
            clearInterval(checkInterval);
            const worker = this.availableWorkers.pop()!;
            resolve(worker);
          }
        }, 100);
      });
    }

    return this.availableWorkers.pop()!;
  }

  release(worker: Worker): void {
    if (!this.workers.includes(worker)) {
      throw new Error('Worker not from this pool');
    }

    if (!this.availableWorkers.includes(worker)) {
      this.availableWorkers.push(worker);
    }
  }

  async destroy(): Promise<void> {
    await this.ensureInitialized();

    // Terminate all workers
    await Promise.all(
      this.workers.map(async (worker) => {
        try {
          await worker.terminate();
        } catch (error) {
          logger.error('Error terminating OCR worker:', error);
        }
      }),
    );

    this.workers = [];
    this.availableWorkers = [];
    this.initializationPromise = null;

    logger.info('OCR worker pool destroyed');
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initializationPromise) {
      await this.init();
    } else {
      await this.initializationPromise;
    }
  }

  getStats(): { total: number; available: number } {
    return {
      total: this.workers.length,
      available: this.availableWorkers.length,
    };
  }
}

// Export a singleton instance
export const ocrWorkerPool = new OCRWorkerPool(
  parseInt(process.env.OCR_MAX_WORKERS || '4', 10),
);
