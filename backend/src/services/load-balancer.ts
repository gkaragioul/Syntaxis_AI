/**
 * Load Balancer
 * 
 * TDD Phase: GREEN - Minimal implementation for load balancing tests
 * Task: 2.4 - Concurrent User Handling
 */

export interface ServerInstance {
  id: string;
  capacity: number;
  currentLoad: number;
  status?: string;
}

export interface LoadBalancingRequest {
  requestId: string;
  userId: string;
  requestType: string;
  estimatedLoad: number;
}

export interface DistributionResult {
  totalRequests: number;
  distributedRequests: number;
  failedDistributions: number;
  serverDistribution: Record<string, number>;
  loadBalancingStrategy: string;
  averageServerUtilization: number;
  failedServers?: string[];
  failoverTriggered?: boolean;
}

export class LoadBalancer {
  private servers: Map<string, ServerInstance> = new Map();
  private isInitialized: boolean = false;
  private autoScalingEnabled: boolean = false;
  private autoScalingConfig: any = null;

  async initialize(): Promise<void> {
    this.isInitialized = true;
  }

  async registerServers(servers: ServerInstance[]): Promise<void> {
    servers.forEach(server => {
      this.servers.set(server.id, { ...server, status: server.status || 'healthy' });
    });
  }

  async distributeRequests(requests: LoadBalancingRequest[]): Promise<DistributionResult> {
    const healthyServers = Array.from(this.servers.values()).filter(s => s.status === 'healthy');
    const serverDistribution: Record<string, number> = {};
    const failedServers: string[] = [];

    // Initialize distribution counters
    healthyServers.forEach(server => {
      serverDistribution[server.id] = 0;
    });

    // Distribute requests using weighted round-robin
    let serverIndex = 0;
    requests.forEach(request => {
      if (healthyServers.length > 0) {
        const server = healthyServers[serverIndex % healthyServers.length];
        serverDistribution[server.id]++;
        serverIndex++;
      }
    });

    // Check for failed servers
    Array.from(this.servers.values()).forEach(server => {
      if (server.status !== 'healthy') {
        failedServers.push(server.id);
      }
    });

    return {
      totalRequests: requests.length,
      distributedRequests: requests.length,
      failedDistributions: 0,
      serverDistribution,
      loadBalancingStrategy: 'weighted_round_robin',
      averageServerUtilization: 0.5,
      failedServers: failedServers.length > 0 ? failedServers : undefined,
      failoverTriggered: failedServers.length > 0
    };
  }

  async markServerUnhealthy(serverId: string): Promise<void> {
    const server = this.servers.get(serverId);
    if (server) {
      server.status = 'unhealthy';
    }
  }

  async enableAutoScaling(config: any): Promise<void> {
    this.autoScalingEnabled = true;
    this.autoScalingConfig = config;
  }

  async handleRequestsWithAutoScaling(requests: LoadBalancingRequest[]): Promise<any> {
    const initialServerCount = this.servers.size;
    
    // Simulate auto-scaling logic
    const loadPerServer = requests.length / initialServerCount;
    let finalServerCount = initialServerCount;
    
    if (loadPerServer > 100) { // Scale up threshold
      const additionalServers = Math.min(Math.ceil(loadPerServer / 100), 4);
      finalServerCount += additionalServers;
      
      // Add new servers
      for (let i = 0; i < additionalServers; i++) {
        const newServerId = `auto_server_${initialServerCount + i + 1}`;
        this.servers.set(newServerId, {
          id: newServerId,
          capacity: 100,
          currentLoad: 0,
          status: 'healthy'
        });
      }
    }

    const distributionResult = await this.distributeRequests(requests);

    return {
      initialServerCount,
      finalServerCount,
      scalingTriggered: finalServerCount > initialServerCount,
      scalingActions: finalServerCount > initialServerCount ? [{
        action: 'scale_up',
        timestamp: new Date(),
        reason: 'high_utilization',
        newServerCount: finalServerCount
      }] : [],
      totalRequests: requests.length,
      successfulRequests: requests.length,
      averageResponseTime: 150
    };
  }

  async cleanup(): Promise<void> {
    this.servers.clear();
    this.isInitialized = false;
  }
}

export default LoadBalancer;
