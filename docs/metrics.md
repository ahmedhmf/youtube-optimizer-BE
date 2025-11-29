# Prometheus Metrics

This application exports metrics in Prometheus format for monitoring and observability.

## Metrics Endpoint

**GET** `/metrics`

Returns all metrics in Prometheus text format.

## Available Metrics

### System Metrics (Auto-collected)
- `process_cpu_user_seconds_total` - CPU time in user mode
- `process_cpu_system_seconds_total` - CPU time in system mode
- `process_heap_bytes` - Heap size in bytes
- `process_resident_memory_bytes` - Resident memory size
- `nodejs_eventloop_lag_seconds` - Event loop lag
- `nodejs_active_handles_total` - Number of active handles
- `nodejs_active_requests_total` - Number of active requests

### HTTP Metrics
- `youtube_optimizer_http_requests_total` - Total HTTP requests
  - Labels: `method`, `route`, `status_code`
- `youtube_optimizer_http_request_duration_seconds` - HTTP request duration histogram
  - Labels: `method`, `route`, `status_code`
  - Buckets: 0.1s, 0.5s, 1s, 2s, 5s, 10s
- `youtube_optimizer_active_connections` - Current active connections

### Database Metrics
- `youtube_optimizer_db_query_duration_seconds` - Database query duration histogram
  - Labels: `operation`, `table`
  - Buckets: 0.01s, 0.05s, 0.1s, 0.5s, 1s, 2s

### AI Service Metrics
- `youtube_optimizer_ai_requests_total` - Total AI service requests
  - Labels: `service`, `status`
- `youtube_optimizer_ai_request_duration_seconds` - AI request duration histogram
  - Labels: `service`
  - Buckets: 1s, 5s, 10s, 30s, 60s

### Authentication Metrics
- `youtube_optimizer_auth_events_total` - Total authentication events
  - Labels: `event_type`, `status`

### Cache Metrics
- `youtube_optimizer_cache_operations_total` - Total cache operations
  - Labels: `operation`, `result`

### Error Metrics
- `youtube_optimizer_errors_total` - Total errors
  - Labels: `type`, `severity`

### Rate Limiting Metrics
- `youtube_optimizer_rate_limit_exceeded_total` - Rate limit violations
  - Labels: `endpoint`, `ip`

## Usage in Code

### Recording Custom Metrics

```typescript
import { MetricsService } from './metrics/metrics.service';

@Injectable()
export class MyService {
  constructor(private readonly metricsService: MetricsService) {}

  async myMethod() {
    // Record an error
    this.metricsService.recordError('validation_error', 'low');

    // Time a database query
    const result = await this.metricsService.timeDbQuery(
      'SELECT',
      'users',
      async () => {
        return await this.db.query('SELECT * FROM users');
      }
    );

    // Time an AI request
    const aiResult = await this.metricsService.timeAiRequest(
      'openai',
      async () => {
        return await this.openai.complete(prompt);
      }
    );

    // Record authentication event
    this.metricsService.recordAuthEvent('login', 'success');

    // Record cache operation
    this.metricsService.recordCacheOperation('get', 'hit');
  }
}
```

## Prometheus Configuration

Add this to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'youtube-optimizer'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:3000']
    metrics_path: '/metrics'
```

## Grafana Dashboard

### Quick Setup

1. **Install Prometheus**
   ```bash
   docker run -d -p 9090:9090 -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus
   ```

2. **Install Grafana**
   ```bash
   docker run -d -p 3001:3000 grafana/grafana
   ```

3. **Add Prometheus Data Source**
   - Open Grafana at http://localhost:3001
   - Go to Configuration → Data Sources
   - Add Prometheus: http://localhost:9090

4. **Import Dashboard**
   - Use dashboard ID: 11159 (Node.js Application Dashboard)
   - Or create custom panels using the metrics above

### Example Queries

**Request Rate (per second)**
```promql
rate(youtube_optimizer_http_requests_total[5m])
```

**P95 Response Time**
```promql
histogram_quantile(0.95, rate(youtube_optimizer_http_request_duration_seconds_bucket[5m]))
```

**Error Rate**
```promql
rate(youtube_optimizer_errors_total[5m])
```

**Active AI Requests**
```promql
youtube_optimizer_ai_requests_total{status="success"}
```

## Railway Deployment

Railway automatically detects the `/metrics` endpoint. View metrics in:
- Railway Dashboard → Metrics tab
- Or scrape directly from your deployed URL

## Alerting Rules

Example Prometheus alerting rules (`alerts.yml`):

```yaml
groups:
  - name: youtube_optimizer
    rules:
      - alert: HighErrorRate
        expr: rate(youtube_optimizer_errors_total{severity="critical"}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          
      - alert: SlowAPIResponse
        expr: histogram_quantile(0.95, rate(youtube_optimizer_http_request_duration_seconds_bucket[5m])) > 5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "API response time is slow"
          
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 > 512
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Memory usage above 512MB"
```

## Next Steps

1. **Structured Logging**: Add correlation IDs to trace requests
2. **Distributed Tracing**: Implement OpenTelemetry for microservices
3. **Alerting**: Set up Slack/PagerDuty webhooks
4. **APM**: Consider DataDog or New Relic for full observability
