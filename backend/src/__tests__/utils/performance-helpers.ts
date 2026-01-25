/**
 * Performance Helpers
 * 
 * TDD Phase: GREEN - Minimal implementation for performance testing
 * Task: 1.1.4 - Test Environment Setup (Priority 1)
 */

export class PerformanceHelpers {
  async measureExecution<T>(fn: () => Promise<T>): Promise<{
    result: T;
    duration: number;
    memoryUsage: NodeJS.MemoryUsage;
  }> {
    const startTime = Date.now();
    const startMemory = process.memoryUsage();
    
    const result = await fn();
    
    const endTime = Date.now();
    const endMemory = process.memoryUsage();
    
    return {
      result,
      duration: endTime - startTime,
      memoryUsage: endMemory
    };
  }
}

export default PerformanceHelpers;
