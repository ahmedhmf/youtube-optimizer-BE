# Railway Deployment Guide - Prometheus Monitoring

## Pre-Deployment Checklist

### 1. Get Grafana Cloud Credentials (5 minutes)

1. **Sign up for Grafana Cloud** (Free tier):
   - Go to https://grafana.com/auth/sign-up
   - Create account (free tier: 10K metrics, 50GB logs, 14-day retention)

2. **Get Remote Write credentials:**
   - In Grafana Cloud Dashboard → Connections → Add new connection
   - Search for "Prometheus" → Select "Prometheus Remote Write"
   - Copy these 3 values:
     ```
     URL: https://prometheus-xxx.grafana.net/api/prom/push
     Username: 123456
     Password: glc_xxxxxxxxxxxxx
     ```

### 2. Configure Railway Environment Variables

Go to Railway Dashboard → Your Project → Variables → Add these:

```bash
# Grafana Cloud (Required for monitoring)
GRAFANA_CLOUD_PROMETHEUS_URL=https://prometheus-xxx.grafana.net/api/prom/push
GRAFANA_CLOUD_PROMETHEUS_USER=123456
GRAFANA_CLOUD_PROMETHEUS_API_KEY=glc_xxxxxxxxxxxxx

# Your existing variables (keep these)
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJxxx...
JWT_SECRET=your-secret
FRONTEND_URL=https://youtube-optimizer-fe.vercel.app
GOOGLE_CLIENT_ID=xxx
GOOGLE_CLIENT_SECRET=xxx
GOOGLE_REDIRECT_URI=https://your-api.railway.app/api/v1/auth/social/google
ANTHROPIC_API_KEY=sk-ant-xxx
NODE_ENV=production
PORT=3000
```

### 3. Railway Settings

**In Railway Dashboard → Settings:**

1. **Deploy Tab:**
   - Build Method: Dockerfile
   - Dockerfile Path: `Dockerfile.prometheus`
   - Root Directory: `/`

2. **Networking Tab:**
   - Generate Domain (if not already done)
   - Note your URL: `https://your-app.railway.app`

3. **Healthcheck:**
   - Enabled: Yes
   - Path: `/health`
   - Timeout: 300 seconds

### 4. Deploy to Railway

```bash
# 1. Commit all changes
git add Dockerfile.prometheus prometheus-remote-write.yml railway.toml .dockerignore RAILWAY-DEPLOYMENT.md
git commit -m "Add Prometheus monitoring for Railway deployment"

# 2. Push to GitHub
git push origin main

# 3. Railway will automatically detect and deploy
# Monitor in Railway Dashboard → Deployments → View Logs
```

### 5. Verify Deployment

```bash
# Check health
curl https://your-app.railway.app/health

# Check metrics endpoint
curl https://your-app.railway.app/api/v1/metrics

# Expected output (Prometheus format):
# http_requests_total{method="GET",route="/health",status="200"} 42
# http_request_duration_seconds_bucket{method="GET",route="/health",le="0.005"} 10
# ...
```

### 6. Verify Grafana Cloud Integration

1. **Check data is flowing:**
   - Go to Grafana Cloud Dashboard
   - Navigate to Explore → Select Prometheus data source
   - Query: `http_requests_total`
   - Should see data within 1-2 minutes

2. **If no data appears:**
   - Check Railway logs for Prometheus errors
   - Verify environment variables are set correctly
   - Check Grafana Cloud URL is correct (must end with `/api/prom/push`)

### 7. Create Dashboards in Grafana Cloud

#### Quick Start - Import Pre-built Dashboard:

1. Dashboards → New → Import
2. Use ID: `1860` (Node Exporter Full) or create custom

#### Custom Dashboard - Key Metrics to Track:

**API Performance:**
```promql
# Request rate
rate(http_requests_total[5m])

# Average response time
rate(http_request_duration_seconds_sum[5m]) / rate(http_request_duration_seconds_count[5m])

# Error rate
rate(http_requests_errors_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

**Business Metrics:**
```promql
# AI requests
rate(ai_requests_total[5m])

# Authentication attempts
rate(auth_attempts_total[5m])

# Cache hit rate
rate(cache_operations_total{result="hit"}[5m]) / rate(cache_operations_total[5m])

# Database query time
rate(db_query_duration_seconds_sum[5m])
```

**System Health:**
```promql
# Active connections
active_connections

# Memory usage
process_resident_memory_bytes

# CPU usage
rate(process_cpu_seconds_total[5m])
```

### 8. Set Up Alerts

#### Example Alert Rules:

**High Error Rate:**
```yaml
Alert Name: High Error Rate
Condition: rate(http_requests_errors_total[5m]) > 0.05
Description: Error rate above 5% for 5 minutes
Notification: Slack/Email
```

**High Latency:**
```yaml
Alert Name: Slow API Response
Condition: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
Description: 95th percentile response time above 2 seconds
Notification: Slack/Email
```

**High Memory Usage:**
```yaml
Alert Name: High Memory
Condition: process_resident_memory_bytes > 500000000
Description: Memory usage above 500MB
Notification: Slack/Email
```

## Troubleshooting

### Deployment Fails

**Check Railway logs:**
```
Railway Dashboard → Deployments → Click on deployment → View Logs
```

**Common issues:**
- ❌ Missing environment variables → Add to Railway Variables
- ❌ Build timeout → Increase timeout in Settings
- ❌ Port already in use → Ensure PORT=3000 in env vars

### Metrics Not Showing in Grafana

1. **Verify Prometheus is running:**
   ```bash
   # Check Railway logs for:
   "Prometheus started with PID xxx"
   "NestJS started with PID xxx"
   ```

2. **Test metrics endpoint:**
   ```bash
   curl https://your-app.railway.app/api/v1/metrics
   ```

3. **Check Grafana Cloud credentials:**
   - URL must end with `/api/prom/push`
   - Username is numeric (instance ID)
   - Password starts with `glc_`

4. **Check Prometheus logs in Railway:**
   - Look for "remote_write" errors
   - Check for authentication failures

### Application Won't Start

1. **Memory issues:**
   - Prometheus + NestJS needs ~512MB RAM minimum
   - Upgrade Railway plan if needed ($5/month hobby plan)

2. **Port conflicts:**
   - Ensure only port 3000 is publicly exposed
   - Port 9090 should be internal only

3. **Environment variables:**
   - Verify all required vars are set
   - Check for typos in variable names

## Performance & Cost

### Expected Resource Usage:
- **CPU:** ~0.1-0.2 vCPU (low traffic)
- **Memory:** 300-500MB
- **Network:** ~5-10MB/day (metrics push)

### Cost Breakdown:
- **Railway:** $5/month hobby plan or ~$5-10/month pay-as-you-go
- **Grafana Cloud:** FREE (10K metrics, 50GB logs)
- **Total:** ~$5-10/month

### Optimization Tips:
- Reduce `scrape_interval` to 30s if needed (currently 15s)
- Reduce metric retention in Prometheus (currently default)
- Use metric relabeling to drop unnecessary labels

## Next Steps After Deployment

### Week 1: Monitor & Alert
- ✅ Create essential dashboards
- ✅ Set up critical alerts (errors, latency)
- ✅ Monitor for 1 week to establish baselines

### Week 2: Improve Logging
- ✅ Implement structured logging (JSON format)
- ✅ Add correlation IDs to requests
- ✅ Send logs to Grafana Loki (free tier)

### Future: Advanced Observability
- ⏳ Add distributed tracing (when scaling)
- ⏳ Implement custom business metrics
- ⏳ Set up on-call rotation (PagerDuty/OpsGenie)

## Support Resources

- **Railway Docs:** https://docs.railway.app
- **Grafana Cloud Docs:** https://grafana.com/docs/grafana-cloud
- **Prometheus Docs:** https://prometheus.io/docs
- **Railway Discord:** https://discord.gg/railway

## Quick Reference

### Important URLs:
- **Health Check:** `https://your-app.railway.app/health`
- **Metrics Endpoint:** `https://your-app.railway.app/api/v1/metrics`
- **Grafana Cloud:** `https://your-org.grafana.net`

### Railway CLI Commands:
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs

# View environment variables
railway variables
```

### Emergency Rollback:
```bash
# In Railway Dashboard:
# Deployments → Find last working deployment → Click "Redeploy"
```

---

**Deployment Status:** Ready to deploy! 🚀

All configuration files are in place. Follow steps 1-3 above to deploy.
