import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SupabaseService } from '../supabase/supabase.service';
import * as os from 'os';

interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  version: string;
  environment: string;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    memory: ServiceStatus;
    cpu: ServiceStatus;
  };
  metrics: {
    memory: MemoryMetrics;
    cpu: CPUMetrics;
    process: ProcessMetrics;
  };
}

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  message?: string;
}

interface MemoryMetrics {
  totalMB: number;
  usedMB: number;
  freeMB: number;
  usagePercent: number;
  heapUsedMB: number;
  heapTotalMB: number;
  heapUsagePercent: number;
}

interface CPUMetrics {
  cores: number;
  model: string;
  loadAverage: number[];
  usagePercent: number;
}

interface ProcessMetrics {
  uptimeSeconds: number;
  pid: number;
  nodeVersion: string;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly supabaseService: SupabaseService) {}

  @Get()
  @ApiOperation({
    summary: 'Health Check',
    description:
      'Returns the health status of the application and its dependencies',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'degraded', 'unhealthy'] },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Uptime in seconds' },
        version: { type: 'string' },
        environment: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Service is unhealthy',
  })
  async check(): Promise<HealthCheckResponse> {
    // Check all services
    const databaseStatus = await this.checkDatabase();
    const redisStatus = this.checkRedis();
    const memoryStatus = this.checkMemory();
    const cpuStatus = this.checkCPU();

    // Calculate overall status
    const overallStatus = this.calculateOverallStatus([
      databaseStatus,
      redisStatus,
      memoryStatus,
      cpuStatus,
    ]);

    // Get detailed metrics
    const metrics = this.getMetrics();

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: databaseStatus,
        redis: redisStatus,
        memory: memoryStatus,
        cpu: cpuStatus,
      },
      metrics,
    };
  }

  @Get('liveness')
  @ApiOperation({
    summary: 'Liveness Probe',
    description: 'Simple liveness check for Kubernetes/Docker orchestration',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is alive',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
      },
    },
  })
  liveness(): { status: string } {
    return { status: 'ok' };
  }

  @Get('readiness')
  @ApiOperation({
    summary: 'Readiness Probe',
    description: 'Check if application is ready to accept traffic',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is ready',
  })
  @ApiResponse({
    status: 503,
    description: 'Application is not ready',
  })
  async readiness(): Promise<{ status: string; ready: boolean }> {
    const databaseStatus = await this.checkDatabase();
    const ready = databaseStatus.status === 'up';

    return {
      status: ready ? 'ready' : 'not_ready',
      ready,
    };
  }

  private async checkDatabase(): Promise<ServiceStatus> {
    const startTime = Date.now();
    try {
      const client = this.supabaseService.getClient();
      const { error } = await client.from('profiles').select('count').limit(1);

      const responseTime = Date.now() - startTime;

      if (error) {
        return {
          status: 'down',
          responseTime,
          message: error.message,
        };
      }

      return {
        status: responseTime < 500 ? 'up' : 'degraded',
        responseTime,
      };
    } catch (error) {
      return {
        status: 'down',
        responseTime: Date.now() - startTime,
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkRedis(): ServiceStatus {
    try {
      // Redis check would go here if you have a Redis service injected
      // For now, return a basic status
      return {
        status: 'up',
        message: 'Redis check not implemented',
      };
    } catch (error) {
      return {
        status: 'down',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkMemory(): ServiceStatus {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedPercent = ((totalMem - freeMem) / totalMem) * 100;

    const memUsage = process.memoryUsage();
    const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (usedPercent > 90 || heapUsagePercent > 90) {
      return {
        status: 'degraded',
        message: `Memory usage critical: ${usedPercent.toFixed(1)}%`,
      };
    }

    if (usedPercent > 80 || heapUsagePercent > 80) {
      return {
        status: 'degraded',
        message: `Memory usage high: ${usedPercent.toFixed(1)}%`,
      };
    }

    return {
      status: 'up',
      message: `Memory usage: ${usedPercent.toFixed(1)}%`,
    };
  }

  private checkCPU(): ServiceStatus {
    const cpus = os.cpus();
    const loadAvg = os.loadavg();
    const cpuUsage = (loadAvg[0] / cpus.length) * 100;

    if (cpuUsage > 90) {
      return {
        status: 'degraded',
        message: `CPU usage critical: ${cpuUsage.toFixed(1)}%`,
      };
    }

    if (cpuUsage > 70) {
      return {
        status: 'degraded',
        message: `CPU usage high: ${cpuUsage.toFixed(1)}%`,
      };
    }

    return {
      status: 'up',
      message: `CPU usage: ${cpuUsage.toFixed(1)}%`,
    };
  }

  private calculateOverallStatus(
    statuses: ServiceStatus[],
  ): 'healthy' | 'degraded' | 'unhealthy' {
    const hasDown = statuses.some((s) => s.status === 'down');
    const hasDegraded = statuses.some((s) => s.status === 'degraded');

    if (hasDown) return 'unhealthy';
    if (hasDegraded) return 'degraded';
    return 'healthy';
  }

  private getMetrics(): {
    memory: MemoryMetrics;
    cpu: CPUMetrics;
    process: ProcessMetrics;
  } {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;

    const memUsage = process.memoryUsage();
    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    return {
      memory: {
        totalMB: Math.round(totalMem / 1024 / 1024),
        usedMB: Math.round(usedMem / 1024 / 1024),
        freeMB: Math.round(freeMem / 1024 / 1024),
        usagePercent: parseFloat(((usedMem / totalMem) * 100).toFixed(2)),
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        heapUsagePercent: parseFloat(
          ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(2),
        ),
      },
      cpu: {
        cores: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        loadAverage: loadAvg.map((load) => parseFloat(load.toFixed(2))),
        usagePercent: parseFloat(((loadAvg[0] / cpus.length) * 100).toFixed(2)),
      },
      process: {
        uptimeSeconds: Math.floor(process.uptime()),
        pid: process.pid,
        nodeVersion: process.version,
      },
    };
  }
}
