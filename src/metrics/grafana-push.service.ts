import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GrafanaPushService implements OnModuleInit {
  private readonly logger = new Logger(GrafanaPushService.name);

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
      this.logger.log('✅ Grafana Cloud credentials configured');
      this.logger.log(
        '📊 Metrics are exposed at /api/v1/metrics for Grafana Cloud to scrape',
      );
      this.logger.log(
        '💡 To scrape metrics, use Grafana Alloy or configure a scrape job',
      );
    } else {
      this.logger.log('📊 Metrics available at /api/v1/metrics endpoint');
    }
  }
}
