# Prometheus + Grafana Setup for Railway

## Option 1: Grafana Cloud (Recommended - Free)

1. **Sign up:** https://grafana.com/auth/sign-up/create-user
2. **Get your credentials:**
   - Go to Grafana Cloud Portal
   - Click "Send Metrics" 
   - Note your Remote Write endpoint and API key

3. **Configure Prometheus Agent in Railway:**

Add these environment variables to your Railway service:

```bash
GRAFANA_CLOUD_URL=https://prometheus-prod-xx-prod-xx-xxxx.grafana.net/api/prom/push
GRAFANA_CLOUD_USER=your_instance_id
GRAFANA_CLOUD_API_KEY=your_api_key
```

4. **Update your Railway service to push metrics:**

Add to your `railway.json`:
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node dist/main.js",
    "healthcheckPath": "/health",
    "restartPolicyType": "ON_FAILURE"
  }
}
```

## Option 2: DataDog (Easiest Integration)

1. **Sign up:** https://www.datadoghq.com/
2. **Get API Key** from DataDog dashboard
3. **Add to Railway:**
   ```bash
   # In Railway Variables
   DD_API_KEY=your_datadog_api_key
   DD_SITE=datadoghq.com  # or datadoghq.eu
   ```

4. **Install DataDog agent:**
   ```bash
   npm install dd-trace
   ```

5. **Add to your main.ts:**
   ```typescript
   // At the very top of main.ts
   import tracer from 'dd-trace';
   tracer.init();
   ```

DataDog will automatically:
- Collect your `/metrics` endpoint
- Track all HTTP requests
- Monitor errors and performance
- Provide dashboards

## Option 3: Self-hosted Prometheus on Railway

Create a new Railway service for Prometheus:

### 1. Create `prometheus-railway/Dockerfile`:

```dockerfile
FROM prom/prometheus:latest

COPY prometheus.yml /etc/prometheus/prometheus.yml

EXPOSE 9090

CMD ["--config.file=/etc/prometheus/prometheus.yml", \
     "--storage.tsdb.path=/prometheus", \
     "--web.console.libraries=/usr/share/prometheus/console_libraries", \
     "--web.console.templates=/usr/share/prometheus/consoles"]
```

### 2. Create `prometheus-railway/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'youtube-optimizer'
    scrape_interval: 15s
    metrics_path: '/api/v1/metrics'
    static_configs:
      - targets: ['youtube-optimizer-be-production.up.railway.app']
```

### 3. Deploy to Railway:
```bash
cd prometheus-railway
railway init
railway up
```

### 4. Add Grafana as another Railway service:

```dockerfile
FROM grafana/grafana:latest

EXPOSE 3000

ENV GF_SECURITY_ADMIN_PASSWORD=your_secure_password
ENV GF_INSTALL_PLUGINS=
```

## Option 4: Use Railway's Native Observability (Coming Soon)

Railway is working on native observability. For now, use Grafana Cloud or DataDog.

## Recommended Setup for You:

**Start with Grafana Cloud** (Free):

1. Sign up for Grafana Cloud
2. Get your Prometheus Remote Write endpoint
3. Use Grafana Agent to push metrics
4. Access dashboards at your Grafana Cloud URL

**Cost Comparison:**
- Railway Built-in: Free (basic metrics only)
- Grafana Cloud: Free tier (10K metrics)
- DataDog: $15/host/month (free trial)
- Self-hosted: Railway service cost (~$5-10/month)

## Quick Start (Grafana Cloud):

1. Sign up: https://grafana.com/products/cloud/
2. Copy your metrics endpoint URL
3. Add to Railway variables:
   ```
   PROMETHEUS_REMOTE_WRITE_URL=your_url
   PROMETHEUS_REMOTE_WRITE_USERNAME=your_id
   PROMETHEUS_REMOTE_WRITE_PASSWORD=your_api_key
   ```

4. Metrics will automatically appear in your Grafana dashboard!

Would you like me to help you set up any specific option?
