/**
 * Memory Manager
 * 
 * TDD Phase: GREEN - Minimal implementation to make memory management tests pass
 * Task: 2.2 - Performance Optimization
 * 
 * This class provides comprehensive memory management with:
 * - Memory usage monitoring
 * - Garbage collection optimization
 * - Memory leak detection
 * - Buffer pool management
 */

export interface MemoryStatistics {
  currentUsage: number;
  peakUsage: number;
  gcCollections: number;
  memoryLeaks: number;
  bufferPoolSize: number;
  optimizations: string[];
}

export class MemoryManager {
  private isInitialized: boolean = false;
  private peakMemoryUsage: number = 0;
  private gcCollectionCount: number = 0;
  private bufferPool: Buffer[] = [];
  private memorySnapshots: number[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {}

  /**
   * Initialize memory manager
   * GREEN: Basic initialization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Start memory monitoring
    this.monitoringInterval = setInterval(() => {
      this.monitorMemoryUsage();
    }, 5000); // Monitor every 5 seconds

    // Initialize buffer pool
    this.initializeBufferPool();

    this.isInitialized = true;
  }

  /**
   * Get current memory usage
   * GREEN: Memory usage retrieval
   */
  async getCurrentMemoryUsage(): Promise<number> {
    const memoryUsage = process.memoryUsage();
    return memoryUsage.heapUsed;
  }

  /**
   * Get peak memory usage
   * GREEN: Peak memory tracking
   */
  async getPeakMemoryUsage(): Promise<number> {
    return this.peakMemoryUsage;
  }

  /**
   * Get garbage collection count
   * GREEN: GC tracking
   */
  async getGarbageCollectionCount(): Promise<number> {
    return this.gcCollectionCount;
  }

  /**
   * Get comprehensive memory statistics
   * GREEN: Memory statistics
   */
  async getMemoryStatistics(): Promise<MemoryStatistics> {
    const currentUsage = await this.getCurrentMemoryUsage();
    
    return {
      currentUsage,
      peakUsage: this.peakMemoryUsage,
      gcCollections: this.gcCollectionCount,
      memoryLeaks: this.detectMemoryLeaks(),
      bufferPoolSize: this.bufferPool.length,
      optimizations: [
        'buffer_pooling',
        'garbage_collection',
        'memory_streaming'
      ]
    };
  }

  /**
   * Force garbage collection
   * GREEN: Manual GC trigger
   */
  async forceGarbageCollection(): Promise<void> {
    if (global.gc) {
      global.gc();
      this.gcCollectionCount++;
    }
  }

  /**
   * Get buffer from pool
   * GREEN: Buffer pool management
   */
  getPooledBuffer(size: number): Buffer {
    // Try to find a suitable buffer in the pool
    const suitableBufferIndex = this.bufferPool.findIndex(
      buffer => buffer.length >= size && buffer.length <= size * 2
    );

    if (suitableBufferIndex !== -1) {
      const buffer = this.bufferPool.splice(suitableBufferIndex, 1)[0];
      return buffer.slice(0, size);
    }

    // Create new buffer if none suitable found
    return Buffer.alloc(size);
  }

  /**
   * Return buffer to pool
   * GREEN: Buffer pool return
   */
  returnBufferToPool(buffer: Buffer): void {
    // Only pool buffers of reasonable size
    if (buffer.length >= 1024 && buffer.length <= 10 * 1024 * 1024) {
      // Limit pool size to prevent memory bloat
      if (this.bufferPool.length < 50) {
        this.bufferPool.push(buffer);
      }
    }
  }

  /**
   * Clear buffer pool
   * GREEN: Buffer pool cleanup
   */
  clearBufferPool(): void {
    this.bufferPool = [];
  }

  /**
   * Monitor memory usage
   * GREEN: Memory monitoring
   */
  private monitorMemoryUsage(): void {
    const currentUsage = process.memoryUsage().heapUsed;
    
    // Update peak usage
    if (currentUsage > this.peakMemoryUsage) {
      this.peakMemoryUsage = currentUsage;
    }

    // Store snapshot for leak detection
    this.memorySnapshots.push(currentUsage);
    
    // Keep only last 20 snapshots
    if (this.memorySnapshots.length > 20) {
      this.memorySnapshots.shift();
    }

    // Trigger GC if memory usage is high
    if (currentUsage > 512 * 1024 * 1024) { // 512MB threshold
      this.forceGarbageCollection();
    }
  }

  /**
   * Detect memory leaks
   * GREEN: Memory leak detection
   */
  private detectMemoryLeaks(): number {
    if (this.memorySnapshots.length < 10) {
      return 0; // Not enough data
    }

    // Simple leak detection: check if memory consistently increases
    const recentSnapshots = this.memorySnapshots.slice(-10);
    const oldSnapshots = this.memorySnapshots.slice(-20, -10);

    if (oldSnapshots.length === 0) {
      return 0;
    }

    const recentAverage = recentSnapshots.reduce((sum, val) => sum + val, 0) / recentSnapshots.length;
    const oldAverage = oldSnapshots.reduce((sum, val) => sum + val, 0) / oldSnapshots.length;

    // If recent average is significantly higher, potential leak
    const threshold = 50 * 1024 * 1024; // 50MB threshold
    return recentAverage > oldAverage + threshold ? 1 : 0;
  }

  /**
   * Initialize buffer pool
   * GREEN: Buffer pool initialization
   */
  private initializeBufferPool(): void {
    // Pre-allocate some common buffer sizes
    const commonSizes = [1024, 4096, 16384, 65536, 262144]; // 1KB to 256KB
    
    commonSizes.forEach(size => {
      for (let i = 0; i < 5; i++) { // 5 buffers of each size
        this.bufferPool.push(Buffer.alloc(size));
      }
    });
  }

  /**
   * Get memory pressure level
   * GREEN: Memory pressure assessment
   */
  getMemoryPressure(): 'low' | 'medium' | 'high' | 'critical' {
    const currentUsage = process.memoryUsage().heapUsed;
    const totalMemory = process.memoryUsage().heapTotal;
    const usageRatio = currentUsage / totalMemory;

    if (usageRatio < 0.5) return 'low';
    if (usageRatio < 0.7) return 'medium';
    if (usageRatio < 0.9) return 'high';
    return 'critical';
  }

  /**
   * Optimize memory usage
   * GREEN: Memory optimization
   */
  async optimizeMemory(): Promise<void> {
    const pressure = this.getMemoryPressure();

    switch (pressure) {
      case 'high':
      case 'critical':
        // Clear buffer pool
        this.clearBufferPool();
        
        // Force garbage collection
        await this.forceGarbageCollection();
        
        // Re-initialize smaller buffer pool
        this.initializeBufferPool();
        break;
        
      case 'medium':
        // Reduce buffer pool size
        this.bufferPool = this.bufferPool.slice(0, Math.floor(this.bufferPool.length / 2));
        break;
        
      default:
        // Low pressure, no action needed
        break;
    }
  }

  /**
   * Get memory usage report
   * GREEN: Memory usage reporting
   */
  getMemoryReport(): {
    current: NodeJS.MemoryUsage;
    peak: number;
    pressure: string;
    bufferPoolSize: number;
    gcCount: number;
  } {
    return {
      current: process.memoryUsage(),
      peak: this.peakMemoryUsage,
      pressure: this.getMemoryPressure(),
      bufferPoolSize: this.bufferPool.length,
      gcCount: this.gcCollectionCount
    };
  }

  /**
   * Cleanup memory manager
   * GREEN: Cleanup method
   */
  async cleanup(): Promise<void> {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.clearBufferPool();
    this.memorySnapshots = [];
    this.peakMemoryUsage = 0;
    this.gcCollectionCount = 0;
    this.isInitialized = false;
  }
}

export default MemoryManager;
