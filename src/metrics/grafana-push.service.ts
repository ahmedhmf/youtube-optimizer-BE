import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { register } from 'prom-client';
import * as https from 'https';
import * as http from 'http';

@Injectable()
export class GrafanaPushService implements OnModuleInit {
  private readonly logger = new Logger(GrafanaPushService.name);
  private pushInterval: NodeJS.Timeout | null = null;
  private readonly pushIntervalMs = 60000; // Push every 60 seconds
  private isEnabled = false;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    const url = this.configService.get<string>('GRAFANA_CLOUD_PROMETHEUS_URL');
    const username = this.configService.get<string>(
      'GRAFANA_CLOUD_PROMETHEUS_USER',
    );
    const password = this.configService.get<string>(
      'GRAFANA_CLOUD_PROMETHEUS_API_KEY',
    );

    if (url && username && password) {
      this.isEnabled = true;
      this.startPushing();
      this.logger.log('✅ Grafana Cloud push service enabled');
    } else {
      this.logger.warn(
        '⚠️  Grafana Cloud credentials not configured. Metrics will only be available via /api/v1/metrics endpoint',
      );
    }
  }

  private startPushing() {
    if (!this.isEnabled) return;

    // Push immediately on startup
    this.pushMetrics();

    // Then push at regular intervals
    this.pushInterval = setInterval(() => {
      this.pushMetrics();
    }, this.pushIntervalMs);

    this.logger.log(
      `📊 Started pushing metrics to Grafana Cloud every ${this.pushIntervalMs / 1000}s`,
    );
  }

  private async pushMetrics() {
    try {
      const url = this.configService.get<string>(
        'GRAFANA_CLOUD_PROMETHEUS_URL',
      );
      const username = this.configService.get<string>(
        'GRAFANA_CLOUD_PROMETHEUS_USER',
      );
      const password = this.configService.get<string>(
        'GRAFANA_CLOUD_PROMETHEUS_API_KEY',
      );

      if (!url || !username || !password) {
        return;
      }

      // Get metrics in Prometheus format
      const metrics = await register.metrics();

      // Parse the URL
      const parsedUrl = new URL(url);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      // Prepare basic auth
      const auth = Buffer.from(`${username}:${password}`).toString('base64');

      // Create request options
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (isHttps ? 443 : 80),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'Content-Length': Buffer.byteLength(metrics),
          Authorization: `Basic ${auth}`,
          'User-Agent': 'youtube-optimizer-be/1.0',
        },
      };

      // Send the request
      const req = client.request(options, (res) => {
        let data = '';

        res.on('data', (chunk) => {
          data += chunk;
        });

        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            this.logger.debug(
              `✅ Successfully pushed metrics to Grafana Cloud (${res.statusCode})`,
            );
          } else {
            this.logger.error(
              `❌ Failed to push metrics: ${res.statusCode} - ${data}`,
            );
          }
        });
      });

      req.on('error', (error) => {
        this.logger.error(
          `❌ Error pushing metrics to Grafana Cloud: ${error.message}`,
        );
      });

      // Write data and end request
      req.write(metrics);
      req.end();
    } catch (error) {
      this.logger.error(
        `❌ Exception while pushing metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  onModuleDestroy() {
    if (this.pushInterval) {
      clearInterval(this.pushInterval);
      this.logger.log('🛑 Stopped pushing metrics to Grafana Cloud');
    }
  }
}
