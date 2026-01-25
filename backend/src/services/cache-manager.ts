/**
 * Cache Manager
 * 
 * TDD Phase: GREEN - Minimal implementation to make cache management tests pass
 * Task: 2.2 - Performance Optimization
 * 
 * This class provides comprehensive caching with:
 * - In-memory caching for fast access
 * - Cache statistics and monitoring
 * - TTL (Time To Live) management
 * - Cache invalidation strategies
 */

export interface CacheStatistics {
  hits: number;
  misses: number;
  hitRate: number;
  totalRequests: number;
  cacheSize: number;
  memoryUsage: number;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

export class CacheManager {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private stats: CacheStatistics = {
    hits: 0,
    misses: 0,
    hitRate: 0,
    totalRequests: 0,
    cacheSize: 0,
    memoryUsage: 0
  };
  private isInitialized: boolean = false;
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {}

  /**
   * Initialize cache manager
   * GREEN: Basic initialization
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Start cleanup interval for expired entries
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Cleanup every minute

    this.isInitialized = true;
  }

  /**
   * Get value from cache
   * GREEN: Basic cache retrieval
   */
  async get<T>(key: string): Promise<T | null> {
    this.stats.totalRequests++;

    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Check if entry has expired
    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.misses++;
      this.updateHitRate();
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    
    this.stats.hits++;
    this.updateHitRate();
    
    return entry.value;
  }

  /**
   * Set value in cache
   * GREEN: Basic cache storage
   */
  async set<T>(key: string, value: T, ttl: number = 300000): Promise<void> {
    const entry: CacheEntry<T> = {
      value,
      timestamp: Date.now(),
      ttl,
      accessCount: 0,
      lastAccessed: Date.now()
    };

    this.cache.set(key, entry);
    this.updateCacheSize();
  }

  /**
   * Delete value from cache
   * GREEN: Cache deletion
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.updateCacheSize();
    }
    return deleted;
  }

  /**
   * Check if key exists in cache
   * GREEN: Cache existence check
   */
  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.updateCacheSize();
      return false;
    }

    return true;
  }

  /**
   * Clear all cache entries
   * GREEN: Cache clearing
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.resetStatistics();
  }

  /**
   * Get cache statistics
   * GREEN: Statistics retrieval
   */
  getStatistics(): CacheStatistics {
    return { ...this.stats };
  }

  /**
   * Get cache size
   * GREEN: Size calculation
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  /**
   * Get memory usage estimate
   * GREEN: Memory usage calculation
   */
  getMemoryUsage(): number {
    let totalSize = 0;
    
    for (const [key, entry] of this.cache) {
      totalSize += this.estimateEntrySize(key, entry);
    }
    
    return totalSize;
  }

  /**
   * Get cache keys
   * GREEN: Key listing
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entries with metadata
   * GREEN: Entry listing with metadata
   */
  getEntries(): Array<{ key: string; metadata: Omit<CacheEntry<any>, 'value'> }> {
    const entries: Array<{ key: string; metadata: Omit<CacheEntry<any>, 'value'> }> = [];
    
    for (const [key, entry] of this.cache) {
      entries.push({
        key,
        metadata: {
          timestamp: entry.timestamp,
          ttl: entry.ttl,
          accessCount: entry.accessCount,
          lastAccessed: entry.lastAccessed
        }
      });
    }
    
    return entries;
  }

  /**
   * Cleanup expired entries
   * GREEN: Expired entry cleanup
   */
  private cleanupExpiredEntries(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache) {
      if (this.isExpired(entry)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
    });
    
    if (keysToDelete.length > 0) {
      this.updateCacheSize();
    }
  }

  /**
   * Check if cache entry is expired
   * GREEN: Expiration check
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    const now = Date.now();
    return (now - entry.timestamp) > entry.ttl;
  }

  /**
   * Update hit rate statistics
   * GREEN: Hit rate calculation
   */
  private updateHitRate(): void {
    this.stats.hitRate = this.stats.totalRequests > 0 
      ? this.stats.hits / this.stats.totalRequests 
      : 0;
  }

  /**
   * Update cache size statistics
   * GREEN: Cache size update
   */
  private updateCacheSize(): void {
    this.stats.cacheSize = this.cache.size;
    this.stats.memoryUsage = this.getMemoryUsage();
  }

  /**
   * Reset statistics
   * GREEN: Statistics reset
   */
  private resetStatistics(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalRequests: 0,
      cacheSize: 0,
      memoryUsage: 0
    };
  }

  /**
   * Estimate entry size in bytes
   * GREEN: Size estimation
   */
  private estimateEntrySize(key: string, entry: CacheEntry<any>): number {
    // Rough estimation
    const keySize = key.length * 2; // UTF-16
    const valueSize = JSON.stringify(entry.value).length * 2;
    const metadataSize = 64; // Approximate metadata size
    
    return keySize + valueSize + metadataSize;
  }

  /**
   * Cleanup on shutdown
   * GREEN: Cleanup method
   */
  async cleanup(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    this.cache.clear();
    this.resetStatistics();
    this.isInitialized = false;
  }
}

export default CacheManager;
