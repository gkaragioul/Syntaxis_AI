/**
 * Async Helpers
 * 
 * TDD Phase: GREEN - Minimal implementation for async utilities
 * Task: 1.1.4 - Test Environment Setup (Priority 1)
 */

export interface RetryOptions {
  maxAttempts: number;
  delay: number;
}

export class AsyncHelpers {
  async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      )
    ]);
  }

  async withRetry<T>(
    fn: () => Promise<T>, 
    options: RetryOptions
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error as Error;
        if (attempt < options.maxAttempts) {
          await new Promise(resolve => setTimeout(resolve, options.delay));
        }
      }
    }
    
    throw lastError!;
  }
}

export default AsyncHelpers;
