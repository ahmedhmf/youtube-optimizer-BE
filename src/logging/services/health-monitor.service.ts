import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SystemLogService } from './system-log.service';
import { LogSeverity, SystemLogCategory } from '../dto/log.types';
import * as os from 'os';

@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name);

  // Thresholds
  private readonly MEMORY_THRESHOLD_PERCENT = 80;
  private readonly CPU_THRESHOLD_PERCENT = 80;
  private readonly HEAP_THRESHOLD_PERCENT = 85;

  constructor(private readonly systemLogService: SystemLogService) {}

  /**
   * Monitor system health metrics every minute
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async monitorSystemHealth() {
    try {
      await this.checkMemoryUsage();
      await this.checkHeapUsage();
      await this.checkCpuUsage();
    } catch (error) {
      this.logger.error('Error monitoring system health:', error);
    }
  }

  /**
   * Check memory usage and log warnings if threshold exceeded
   */
  private async checkMemoryUsage() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const usedPercent = (usedMem / totalMem) * 100;

    if (usedPercent > this.MEMORY_THRESHOLD_PERCENT) {
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.WARNING,
        category: SystemLogCategory.DATABASE,
        serviceName: 'HealthMonitorService',
        message: `Memory usage exceeds threshold: ${usedPercent.toFixed(2)}%`,
        details: {
          usedMemoryMB: Math.round(usedMem / 1024 / 1024),
          totalMemoryMB: Math.round(totalMem / 1024 / 1024),
          freeMemoryMB: Math.round(freeMem / 1024 / 1024),
          usedPercent: usedPercent.toFixed(2),
          threshold: this.MEMORY_THRESHOLD_PERCENT,
        },
      });
    }
  }

  /**
   * Check heap usage and log warnings if threshold exceeded
   */
  private async checkHeapUsage() {
    const memUsage = process.memoryUsage();
    const heapUsedPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

    if (heapUsedPercent > this.HEAP_THRESHOLD_PERCENT) {
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.WARNING,
        category: SystemLogCategory.DATABASE,
        serviceName: 'HealthMonitorService',
        message: `Heap usage exceeds threshold: ${heapUsedPercent.toFixed(2)}%`,
        details: {
          heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
          rssMemoryMB: Math.round(memUsage.rss / 1024 / 1024),
          externalMemoryMB: Math.round(memUsage.external / 1024 / 1024),
          heapUsedPercent: heapUsedPercent.toFixed(2),
          threshold: this.HEAP_THRESHOLD_PERCENT,
        },
      });
    }
  }

  /**
   * Check CPU usage and log warnings if threshold exceeded
   */
  private async checkCpuUsage() {
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    cpus.forEach((cpu) => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type];
      }
      totalIdle += cpu.times.idle;
    });

    const idle = totalIdle / cpus.length;
    const total = totalTick / cpus.length;
    const usedPercent = 100 - ~~((100 * idle) / total);

    if (usedPercent > this.CPU_THRESHOLD_PERCENT) {
      await this.systemLogService.logSystem({
        logLevel: LogSeverity.WARNING,
        category: SystemLogCategory.DATABASE,
        serviceName: 'HealthMonitorService',
        message: `CPU usage exceeds threshold: ${usedPercent}%`,
        details: {
          cpuCount: cpus.length,
          cpuUsedPercent: usedPercent,
          cpuModel: cpus[0]?.model || 'Unknown',
          threshold: this.CPU_THRESHOLD_PERCENT,
          loadAverage: os.loadavg(),
        },
      });
    }
  }

  /**
   * Get current system health snapshot
   */
  async getHealthSnapshot() {
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = process.memoryUsage();
    const cpus = os.cpus();

    return {
      memory: {
        totalMB: Math.round(totalMem / 1024 / 1024),
        freeMB: Math.round(freeMem / 1024 / 1024),
        usedMB: Math.round(usedMem / 1024 / 1024),
        usedPercent: ((usedMem / totalMem) * 100).toFixed(2),
      },
      heap: {
        heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
        rssMB: Math.round(memUsage.rss / 1024 / 1024),
        usedPercent: ((memUsage.heapUsed / memUsage.heapTotal) * 100).toFixed(
          2,
        ),
      },
      cpu: {
        count: cpus.length,
        model: cpus[0]?.model || 'Unknown',
        loadAverage: os.loadavg(),
      },
      uptime: {
        processUptimeSeconds: process.uptime(),
        systemUptimeSeconds: os.uptime(),
      },
    };
  }
}
