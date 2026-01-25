/**
 * Resource Isolation Manager
 * 
 * TDD Phase: GREEN - Minimal implementation for resource isolation tests
 * Task: 2.4 - Concurrent User Handling
 */

export interface ResourceLimits {
  memory: number;
  cpu: number;
}

export interface ResourceUsage {
  userId: string;
  allocated: ResourceLimits;
  used: ResourceLimits;
  utilization: { memory: number; cpu: number };
  withinLimits: boolean;
  violations?: string[];
}

export class ResourceIsolationManager {
  private userResources: Map<string, ResourceLimits> = new Map();
  private isInitialized: boolean = false;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async allocateResources(userId: string, limits: ResourceLimits): Promise<void> {
    this.userResources.set(userId, limits);
  }

  async simulateResourceUsage(userId: string, usage: { memoryUsage: number; cpuUsage: number }): Promise<ResourceUsage> {
    const allocated = this.userResources.get(userId);
    if (!allocated) {
      throw new Error(`No resources allocated for user ${userId}`);
    }

    const used = { memory: usage.memoryUsage, cpu: usage.cpuUsage };
    const utilization = {
      memory: (used.memory / allocated.memory) * 100,
      cpu: (used.cpu / allocated.cpu) * 100
    };

    const violations: string[] = [];
    if (used.memory > allocated.memory) violations.push('memory_limit_exceeded');
    if (used.cpu > allocated.cpu) violations.push('cpu_limit_exceeded');

    return {
      userId,
      allocated,
      used,
      utilization,
      withinLimits: violations.length === 0,
      violations: violations.length > 0 ? violations : undefined
    };
  }

  async cleanup(): Promise<void> {
    this.userResources.clear();
    this.isInitialized = false;
  }
}

export default ResourceIsolationManager;
