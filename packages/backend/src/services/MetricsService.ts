import winston from 'winston';

export interface MetricsData {
  timestamp: number;
  uptime: number;
  memory: {
    used: number;
    total: number;
    external: number;
    heapUsed: number;
    heapTotal: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  requests: {
    total: number;
    active: number;
    rate: number;
  };
  jobs: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
    rate: number;
  };
  search: {
    totalQueries: number;
    averageResponseTime: number;
    cacheHitRate: number;
  };
  scrapers: {
    totalRequests: number;
    successRate: number;
    averageResponseTime: number;
  };
}

export interface ServiceMetrics {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: number;
  errorCount: number;
  successCount: number;
}

export class MetricsService {
  private logger: winston.Logger;
  private startTime: number;
  private requestCount: number = 0;
  private requestStartTimes: Map<string, number> = new Map();
  private jobMetrics: {
    total: number;
    pending: number;
    running: number;
    completed: number;
    failed: number;
  } = {
    total: 0,
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0
  };
  private searchMetrics: {
    totalQueries: number;
    totalResponseTime: number;
    cacheHits: number;
    cacheMisses: number;
  } = {
    totalQueries: 0,
    totalResponseTime: 0,
    cacheHits: 0,
    cacheMisses: 0
  };
  private scraperMetrics: {
    totalRequests: number;
    successfulRequests: number;
    totalResponseTime: number;
  } = {
    totalRequests: 0,
    successfulRequests: 0,
    totalResponseTime: 0
  };
  private serviceMetrics: Map<string, ServiceMetrics> = new Map();

  constructor(logger: winston.Logger) {
    this.logger = logger;
    this.startTime = Date.now();
  }

  // Request tracking
  startRequest(requestId: string): void {
    this.requestStartTimes.set(requestId, Date.now());
    this.requestCount++;
  }

  endRequest(requestId: string): number {
    const startTime = this.requestStartTimes.get(requestId);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.requestStartTimes.delete(requestId);
      return duration;
    }
    return 0;
  }

  // Job metrics
  recordJobCreated(): void {
    this.jobMetrics.total++;
    this.jobMetrics.pending++;
  }

  recordJobStarted(): void {
    this.jobMetrics.pending--;
    this.jobMetrics.running++;
  }

  recordJobCompleted(): void {
    this.jobMetrics.running--;
    this.jobMetrics.completed++;
  }

  recordJobFailed(): void {
    this.jobMetrics.running--;
    this.jobMetrics.failed++;
  }

  // Search metrics
  recordSearchQuery(responseTime: number, cacheHit: boolean = false): void {
    this.searchMetrics.totalQueries++;
    this.searchMetrics.totalResponseTime += responseTime;
    if (cacheHit) {
      this.searchMetrics.cacheHits++;
    } else {
      this.searchMetrics.cacheMisses++;
    }
  }

  // Scraper metrics
  recordScraperRequest(success: boolean, responseTime: number): void {
    this.scraperMetrics.totalRequests++;
    this.scraperMetrics.totalResponseTime += responseTime;
    if (success) {
      this.scraperMetrics.successfulRequests++;
    }
  }

  // Service health tracking
  recordServiceHealth(name: string, status: 'healthy' | 'degraded' | 'unhealthy', responseTime: number): void {
    const existing = this.serviceMetrics.get(name);
    const now = Date.now();
    
    this.serviceMetrics.set(name, {
      name,
      status,
      responseTime,
      lastCheck: now,
      errorCount: existing ? (status === 'unhealthy' ? existing.errorCount + 1 : existing.errorCount) : (status === 'unhealthy' ? 1 : 0),
      successCount: existing ? (status === 'healthy' ? existing.successCount + 1 : existing.successCount) : (status === 'healthy' ? 1 : 0)
    });
  }

  // Get current metrics
  getMetrics(): MetricsData {
    const now = Date.now();
    const uptime = now - this.startTime;
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // Calculate rates (requests per minute)
    const requestRate = uptime > 0 ? (this.requestCount / (uptime / 60000)) : 0;
    const jobRate = uptime > 0 ? (this.jobMetrics.completed / (uptime / 60000)) : 0;

    // Calculate search metrics
    const averageSearchResponseTime = this.searchMetrics.totalQueries > 0 
      ? this.searchMetrics.totalResponseTime / this.searchMetrics.totalQueries 
      : 0;
    const cacheHitRate = (this.searchMetrics.cacheHits + this.searchMetrics.cacheMisses) > 0
      ? this.searchMetrics.cacheHits / (this.searchMetrics.cacheHits + this.searchMetrics.cacheMisses)
      : 0;

    // Calculate scraper metrics
    const averageScraperResponseTime = this.scraperMetrics.totalRequests > 0
      ? this.scraperMetrics.totalResponseTime / this.scraperMetrics.totalRequests
      : 0;
    const scraperSuccessRate = this.scraperMetrics.totalRequests > 0
      ? this.scraperMetrics.successfulRequests / this.scraperMetrics.totalRequests
      : 0;

    return {
      timestamp: now,
      uptime,
      memory: {
        used: memoryUsage.rss,
        total: memoryUsage.heapTotal,
        external: memoryUsage.external,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal
      },
      cpu: {
        usage: (cpuUsage.user + cpuUsage.system) / 1000000, // Convert to seconds
        loadAverage: process.platform === 'win32' ? [0, 0, 0] : require('os').loadavg()
      },
      requests: {
        total: this.requestCount,
        active: this.requestStartTimes.size,
        rate: requestRate
      },
      jobs: {
        total: this.jobMetrics.total,
        pending: this.jobMetrics.pending,
        running: this.jobMetrics.running,
        completed: this.jobMetrics.completed,
        failed: this.jobMetrics.failed,
        rate: jobRate
      },
      search: {
        totalQueries: this.searchMetrics.totalQueries,
        averageResponseTime: averageSearchResponseTime,
        cacheHitRate: cacheHitRate
      },
      scrapers: {
        totalRequests: this.scraperMetrics.totalRequests,
        successRate: scraperSuccessRate,
        averageResponseTime: averageScraperResponseTime
      }
    };
  }

  // Get service health metrics
  getServiceMetrics(): ServiceMetrics[] {
    return Array.from(this.serviceMetrics.values());
  }

  // Reset metrics (useful for testing)
  reset(): void {
    this.requestCount = 0;
    this.requestStartTimes.clear();
    this.jobMetrics = {
      total: 0,
      pending: 0,
      running: 0,
      completed: 0,
      failed: 0
    };
    this.searchMetrics = {
      totalQueries: 0,
      totalResponseTime: 0,
      cacheHits: 0,
      cacheMisses: 0
    };
    this.scraperMetrics = {
      totalRequests: 0,
      successfulRequests: 0,
      totalResponseTime: 0
    };
    this.serviceMetrics.clear();
  }
} 