# Production Runbook

Operational guide for managing YouTube Optimizer Backend in production.

## Table of Contents

1. [Emergency Contacts](#emergency-contacts)
2. [Quick Reference](#quick-reference)
3. [Common Incidents](#common-incidents)
4. [Monitoring & Alerts](#monitoring--alerts)
5. [Deployment Procedures](#deployment-procedures)
6. [Rollback Procedures](#rollback-procedures)
7. [Database Operations](#database-operations)
8. [Performance Tuning](#performance-tuning)
9. [Security Incidents](#security-incidents)
10. [Maintenance Tasks](#maintenance-tasks)

## Emergency Contacts

### On-Call Engineers
- **Primary**: [Your Name] - [Phone] - [Email]
- **Secondary**: [Backup Name] - [Phone] - [Email]

### External Services Support
- **Railway Support**: support@railway.app
- **Supabase Support**: support@supabase.com
- **OpenAI Support**: https://help.openai.com

### Alert Channels
- **Telegram**: Bot ID 7827226268
- **Email**: alerts@yourdomain.com
- **Status Page**: https://status.yourdomain.com (if configured)

## Quick Reference

### Service URLs

```
Production API: https://your-app.railway.app
Health Check:   https://your-app.railway.app/health
API Docs:       https://your-app.railway.app/api
Metrics:        https://your-app.railway.app/api/v1/metrics-dashboard
Frontend:       https://your-frontend.vercel.app
```

### Key Commands

```bash
# Railway CLI
railway logs --tail                 # View live logs
railway status                      # Check deployment status
railway restart                     # Restart application
railway env                        # View environment variables

# Database
npm run db:status                  # Check migration status
npm run db:push                    # Apply migrations
npm run db:pull                    # Pull schema changes

# Monitoring
curl https://your-app.railway.app/health
curl https://your-app.railway.app/api/v1/metrics-json
```

### Environment Variables Quick Check

```bash
# Critical variables to verify
railway env | grep -E "SUPABASE_URL|OPENAI_API_KEY|JWT_SECRET|FRONTEND_URL"
```

## Common Incidents

### Incident 1: Application Down / Won't Start

**Symptoms:**
- Health check fails
- 502/503 errors
- Railway shows "Crashed" status
- Users can't access application

**Diagnosis:**
```bash
# Check Railway logs
railway logs --tail

# Look for:
# - "Missing required environment variable"
# - "Failed to connect to database"
# - "Port already in use"
# - Unhandled exceptions
```

**Resolution Steps:**

1. **Check Health Endpoint**
```bash
curl https://your-app.railway.app/health
```

2. **Verify Environment Variables**
```bash
railway env | grep -E "SUPABASE|OPENAI|JWT_SECRET"
```

3. **Check Recent Deployments**
```bash
railway status
# If recent deployment caused issue, rollback
railway rollback
```

4. **Restart Application**
```bash
railway restart
```

5. **If still failing, check Supabase**
- Visit Supabase dashboard
- Verify project is not paused (free tier auto-pauses)
- Check database connection limit

**Prevention:**
- Enable health check monitoring
- Set up Telegram alerts
- Test deployments in staging first

---

### Incident 2: Database Connection Errors

**Symptoms:**
- "Failed to connect to Supabase"
- 500 errors on all endpoints
- Health check shows database unhealthy

**Diagnosis:**
```bash
# Check database status
curl https://your-project.supabase.co/rest/v1/ \
  -H "apikey: YOUR_ANON_KEY"

# Check logs for connection errors
railway logs | grep -i "database\|supabase\|connection"
```

**Resolution Steps:**

1. **Verify Supabase Project Status**
- Go to Supabase dashboard
- Check if project is paused → Click "Resume"
- Check if maintenance is ongoing

2. **Check Connection Limits**
```sql
-- Run in Supabase SQL Editor
SELECT count(*) FROM pg_stat_activity;
-- If > 100, connections may be exhausted
```

3. **Verify Environment Variables**
```bash
railway env | grep SUPABASE
```

4. **Test Direct Connection**
```bash
# Use Supabase SQL Editor to test
SELECT NOW();
```

5. **Restart Application**
```bash
railway restart
```

**Prevention:**
- Enable Supabase pgBouncer (connection pooling)
- Monitor connection count in metrics
- Set up database alerts

---

### Incident 3: High Response Times / Slow API

**Symptoms:**
- Response times > 2000ms
- Metrics show high latency
- Users report slow loading

**Diagnosis:**
```bash
# Check metrics
curl https://your-app.railway.app/api/v1/metrics-json

# Look for:
# - http_request_duration_seconds
# - database_query_duration
# - memory_usage

# Check logs for slow queries
railway logs | grep -i "slow\|timeout\|duration"
```

**Resolution Steps:**

1. **Check System Resources**
```bash
# View metrics endpoint
curl https://your-app.railway.app/health
# Look at memory.heapUsed and memory.rss
```

2. **Identify Slow Endpoints**
```bash
railway logs | grep "duration" | sort -k5 -n
```

3. **Check Database Query Performance**
```sql
-- In Supabase SQL Editor
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;
```

4. **Clear Redis Cache (if applicable)**
```bash
# If using external Redis
redis-cli FLUSHALL
```

5. **Restart Application**
```bash
railway restart
```

6. **Scale Resources (if needed)**
- Railway Dashboard → Settings → Resources
- Increase memory/CPU allocation

**Prevention:**
- Add database indexes on frequently queried columns
- Implement response caching
- Monitor query performance regularly
- Set up alert for response time > 2000ms

---

### Incident 4: OpenAI API Errors

**Symptoms:**
- Video analysis fails
- "OpenAI API error" in logs
- Users can't generate suggestions

**Diagnosis:**
```bash
# Check logs
railway logs | grep -i "openai\|api.*error"

# Common errors:
# - 429: Rate limit exceeded
# - 401: Invalid API key
# - 500: OpenAI service down
```

**Resolution Steps:**

1. **Check OpenAI Status**
- Visit: https://status.openai.com
- If down, wait for resolution

2. **Verify API Key**
```bash
railway env | grep OPENAI_API_KEY
```

3. **Check Usage Limits**
- Visit: https://platform.openai.com/usage
- Check if quota exceeded
- Add payment method or upgrade plan

4. **Test API Key**
```bash
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

5. **Implement Fallback (if needed)**
- Temporarily disable AI features
- Return cached suggestions
- Queue requests for retry

**Prevention:**
- Monitor OpenAI usage daily
- Set up billing alerts
- Implement retry logic with exponential backoff
- Cache AI responses when possible

---

### Incident 5: Memory Leak / High Memory Usage

**Symptoms:**
- Application crashes with "out of memory"
- Memory usage increasing over time
- Railway restarts application frequently

**Diagnosis:**
```bash
# Check memory metrics
curl https://your-app.railway.app/health | jq '.memory'

# Check logs for memory errors
railway logs | grep -i "memory\|heap"

# Monitor over time
watch -n 5 'curl -s https://your-app.railway.app/health | jq .memory'
```

**Resolution Steps:**

1. **Immediate: Restart Application**
```bash
railway restart
```

2. **Check Log File Size**
```bash
# If logs directory is too large
# Reduce LOG_RETENTION_DAYS
railway env set LOG_RETENTION_DAYS=7
```

3. **Review Recent Code Changes**
- Check for memory leaks in new code
- Look for unclosed connections
- Review large data processing

4. **Increase Memory Allocation**
```bash
# Railway Dashboard → Settings → Resources
# Increase memory limit
```

5. **Monitor Memory Over Time**
```bash
# Check metrics every hour
curl https://your-app.railway.app/api/v1/metrics-json | jq '.memory'
```

**Prevention:**
- Implement memory profiling
- Review Winston log rotation settings
- Close database connections properly
- Clear cache periodically

---

### Incident 6: Rate Limit Exceeded

**Symptoms:**
- 429 Too Many Requests errors
- Users report "Too many requests"
- Specific IPs blocked

**Diagnosis:**
```bash
# Check logs for rate limit hits
railway logs | grep "rate limit\|429"

# Check ip_rate_limits table
# In Supabase SQL Editor:
SELECT * FROM ip_rate_limits
WHERE request_count > 100
ORDER BY updated_at DESC;
```

**Resolution Steps:**

1. **Identify Source**
```bash
# Check which IPs are hitting limits
railway logs | grep "429" | grep -oP 'ip:[\d.]+' | sort | uniq -c
```

2. **Determine if Attack**
- Single IP with thousands of requests → Likely attack
- Multiple IPs with normal requests → Legitimate traffic spike

3. **Adjust Rate Limits (if legitimate)**
```typescript
// In src/app.module.ts
// Increase limits temporarily
max: 2000, // from 1000
```

4. **Block Malicious IPs (if attack)**
```sql
-- In Supabase SQL Editor
INSERT INTO ip_rate_limits (ip_address, request_count, blocked_until)
VALUES ('123.45.67.89', 10000, NOW() + INTERVAL '24 hours');
```

5. **Deploy Changes**
```bash
git commit -am "Adjust rate limits"
git push
```

**Prevention:**
- Monitor rate limit metrics
- Implement CAPTCHA for suspicious traffic
- Use Cloudflare for DDoS protection
- Set up alerts for rate limit spikes

---

### Incident 7: Authentication Failures

**Symptoms:**
- Users can't login
- "Invalid token" errors
- "Token expired" errors

**Diagnosis:**
```bash
# Check auth logs
railway logs | grep -i "auth\|token\|login"

# Common issues:
# - JWT_SECRET changed
# - Clock skew
# - Token version mismatch
```

**Resolution Steps:**

1. **Verify JWT_SECRET**
```bash
railway env | grep JWT_SECRET
# Make sure it hasn't changed
```

2. **Check Supabase Auth Status**
- Supabase Dashboard → Authentication
- Verify service is running

3. **Test Authentication**
```bash
# Test registration
curl -X POST https://your-app.railway.app/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test"}'
```

4. **Check Token Expiration**
```typescript
// Default: 15 minutes
// Increase if needed in src/auth/auth.service.ts
expiresIn: '1h'
```

5. **Force Token Refresh**
- Users need to logout and login again
- Or implement token refresh endpoint

**Prevention:**
- Never change JWT_SECRET in production (invalidates all tokens)
- Implement proper token refresh
- Monitor authentication success rate

---

### Incident 8: Database Migration Failures

**Symptoms:**
- Deployment fails with migration errors
- "relation already exists"
- Schema out of sync

**Diagnosis:**
```bash
# Check migration status
npm run db:status

# Check Railway logs during deployment
railway logs | grep -i "migration\|schema"
```

**Resolution Steps:**

1. **Check Current State**
```bash
npm run db:status
```

2. **If "already exists" error**
```bash
# Mark as applied
npx supabase migration repair --status applied <migration_name>
```

3. **If migration failed mid-way**
```bash
# Option 1: Fix and re-run
npm run db:push

# Option 2: Rollback migration
npx supabase migration repair --status reverted <migration_name>
```

4. **Nuclear Option (LAST RESORT - DATA LOSS)**
```bash
npm run db:reset  # Resets entire database
npm run db:push   # Re-applies all migrations
```

**Prevention:**
- Test migrations locally first
- Backup database before migrations
- Use migration repair commands
- Version control migration files

## Monitoring & Alerts

### Health Check Monitoring

**Railway Auto-Monitoring:**
Railway automatically monitors `/health` endpoint every 30 seconds.

**Manual Check:**
```bash
# Check health
curl https://your-app.railway.app/health

# Expected response:
# {"status":"healthy","uptime":12345}
```

### Alert Triggers

Current alerts configured for:
- Error rate > 5%
- Response time > 2000ms
- System errors detected
- Database connection failures
- OpenAI API failures

### Telegram Alerts

**Bot Token:** 7827226268:AAEeNVjlxX5IrfPS_hPfPHAXmjBgj5k6vhA
**Chat ID:** 5565250195

**Test alert:**
```bash
curl -X POST "https://api.telegram.org/bot7827226268:AAEeNVjlxX5IrfPS_hPfPHAXmjBgj5k6vhA/sendMessage" \
  -H "Content-Type: application/json" \
  -d '{"chat_id":"5565250195","text":"Test alert from production"}'
```

### Metrics Dashboard

Access metrics at: `https://your-app.railway.app/api/v1/metrics-dashboard`

**Key Metrics:**
- `http_requests_total` - Total HTTP requests
- `http_request_duration_seconds` - Request latency
- `database_query_duration` - Database performance
- `memory_heap_used_bytes` - Memory usage
- `audit_count_total` - Business metric

### Log Monitoring

**View live logs:**
```bash
railway logs --tail
```

**Search logs:**
```bash
# Errors only
railway logs | grep ERROR

# Specific user
railway logs | grep "user:USER_ID"

# Slow requests
railway logs | grep "duration" | awk '$NF > 2000'
```

## Deployment Procedures

### Standard Deployment

```bash
# 1. Ensure tests pass locally
npm test
npm run test:e2e

# 2. Commit and push
git add .
git commit -m "Description of changes"
git push origin main

# 3. Railway auto-deploys from main branch
# Monitor deployment
railway logs --tail

# 4. Verify deployment
curl https://your-app.railway.app/health

# 5. Test critical endpoints
curl https://your-app.railway.app/api/v1/metrics-json
```

### Database Migration Deployment

```bash
# 1. Create migration locally
npm run db:migration:new migration_name

# 2. Write migration SQL
# Edit supabase/migrations/<timestamp>_migration_name.sql

# 3. Test locally
npm run db:push

# 4. Commit migration file
git add supabase/migrations/
git commit -m "Add migration: migration_name"
git push

# 5. Apply to production
npm run db:push  # After deployment
```

### Hotfix Deployment

```bash
# 1. Create hotfix branch
git checkout -b hotfix/critical-issue

# 2. Fix issue
# Edit files...

# 3. Test locally
npm run start:dev

# 4. Commit and push
git commit -am "Hotfix: description"
git push origin hotfix/critical-issue

# 5. Merge to main
git checkout main
git merge hotfix/critical-issue
git push

# 6. Monitor deployment
railway logs --tail
```

## Rollback Procedures

### Application Rollback

```bash
# Option 1: Railway dashboard
# Deployments tab → Find previous successful deployment → Redeploy

# Option 2: Git revert
git revert HEAD
git push

# Option 3: Specific commit
git reset --hard COMMIT_HASH
git push --force  # USE WITH CAUTION
```

### Database Rollback

**IMPORTANT: Backup first!**

```bash
# 1. Backup current state
npm run db:pull > backup-$(date +%Y%m%d).sql

# 2. Revert specific migration
npx supabase migration repair --status reverted <migration_name>

# 3. Or restore from backup
# Use Supabase dashboard → Database → Restore
```

## Database Operations

### Backup Database

```bash
# Pull current schema
npm run db:pull > backup-$(date +%Y%m%d-%H%M%S).sql

# Supabase automatic daily backups (7 days retention on free tier)
# Access via: Supabase Dashboard → Database → Backups
```

### Restore Database

```bash
# From backup file
# Use Supabase dashboard SQL Editor
# Copy/paste backup SQL

# Or restore from Supabase backup
# Dashboard → Database → Backups → Restore
```

### Manual Database Queries

```bash
# Access SQL Editor
# Supabase Dashboard → SQL Editor

# Common queries:

# User count
SELECT COUNT(*) FROM profiles;

# Active subscriptions
SELECT tier, COUNT(*) FROM user_subscriptions
WHERE status = 'active'
GROUP BY tier;

# Error rate (last hour)
SELECT COUNT(*) FROM error_logs
WHERE created_at > NOW() - INTERVAL '1 hour';

# Token usage by user
SELECT user_id, SUM(total_tokens)
FROM user_token_usage
GROUP BY user_id
ORDER BY sum DESC
LIMIT 10;
```

### Database Performance

```bash
# Slow queries
SELECT query, mean_exec_time, calls
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 10;

# Table sizes
SELECT schemaname, tablename,
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

# Index usage
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0 AND schemaname = 'public';
```

## Performance Tuning

### Application-Level Optimization

1. **Enable Redis Caching**
```bash
# Add Redis to Railway
railway add redis

# Update environment variables
railway env set REDIS_URL=${{REDIS_URL}}
```

2. **Increase Worker Threads**
```bash
# Set in Railway environment
NODE_OPTIONS="--max-old-space-size=2048"
```

3. **Optimize Logging**
```bash
# Reduce retention
LOG_RETENTION_DAYS=7

# Reduce log level in production
LOG_LEVEL=error
```

### Database Optimization

1. **Add Missing Indexes**
```sql
-- Check for missing indexes
CREATE INDEX IF NOT EXISTS idx_audits_user_id ON audits(user_id);
CREATE INDEX IF NOT EXISTS idx_video_analysis_created ON video_analysis_logs(created_at);
```

2. **Enable pgBouncer**
```bash
# Supabase Dashboard → Settings → Database
# Enable "Use pgBouncer" (connection pooling)

# Update connection string in Railway
SUPABASE_URL=postgresql://...?pgbouncer=true
```

3. **Vacuum Database**
```sql
-- Run in Supabase SQL Editor
VACUUM ANALYZE;
```

## Security Incidents

### Suspected Account Compromise

1. **Identify affected account**
```sql
SELECT * FROM profiles WHERE email = 'compromised@email.com';
```

2. **Force logout**
```sql
-- Increment token_version to invalidate all tokens
UPDATE profiles
SET token_version = token_version + 1
WHERE id = 'USER_ID';
```

3. **Lock account**
```sql
UPDATE profiles
SET account_locked = true
WHERE id = 'USER_ID';
```

4. **Notify user**
```bash
# Send email notification
# Check user_email for contact info
```

### Suspected Attack/Breach

1. **Block malicious IPs**
```sql
INSERT INTO ip_rate_limits (ip_address, blocked_until, request_count)
VALUES ('MALICIOUS_IP', NOW() + INTERVAL '24 hours', 999999);
```

2. **Review security logs**
```sql
SELECT * FROM security_events
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;
```

3. **Check for unusual activity**
```sql
-- Failed login attempts
SELECT ip_address, COUNT(*) as attempts
FROM security_events
WHERE event_type = 'failed_login'
  AND created_at > NOW() - INTERVAL '1 hour'
GROUP BY ip_address
HAVING COUNT(*) > 10;
```

4. **Rotate secrets (if needed)**
```bash
# Generate new JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Update in Railway
railway env set JWT_SECRET=<new_secret>

# All users will need to re-login
```

## Maintenance Tasks

### Daily Tasks

- [ ] Check health endpoint status
- [ ] Review error logs for critical issues
- [ ] Monitor Telegram alerts
- [ ] Check OpenAI usage/costs
- [ ] Verify backups completed

### Weekly Tasks

- [ ] Review performance metrics
- [ ] Check database size growth
- [ ] Analyze slow queries
- [ ] Update dependencies (security patches)
- [ ] Review user feedback

### Monthly Tasks

- [ ] Database vacuum and analyze
- [ ] Review and archive old logs
- [ ] Security audit review
- [ ] Cost optimization review
- [ ] Backup verification test
- [ ] Disaster recovery drill

### Quarterly Tasks

- [ ] Dependency updates (major versions)
- [ ] Security penetration testing
- [ ] Performance load testing
- [ ] Documentation review
- [ ] Incident review and lessons learned

## Escalation Procedures

### Level 1: Application Issues
- Check logs and metrics
- Restart application
- Follow runbook procedures
- Resolution time target: < 30 minutes

### Level 2: Infrastructure Issues
- Contact Railway support
- Check Supabase status
- Escalate to senior engineer
- Resolution time target: < 2 hours

### Level 3: Security Incidents
- Follow security incident procedures
- Contact all stakeholders
- Document everything
- Notify affected users
- Resolution time target: < 4 hours

## Post-Incident Procedures

After resolving any incident:

1. **Document incident**
   - What happened
   - When it happened
   - How it was detected
   - How it was resolved
   - Duration of outage

2. **Root cause analysis**
   - Why did it happen
   - What was the underlying cause
   - Could it have been prevented

3. **Action items**
   - What needs to be fixed
   - Who is responsible
   - When it will be completed

4. **Update runbook**
   - Add new incident type if needed
   - Update resolution procedures
   - Add prevention measures

## Useful SQL Queries

```sql
-- Active users count
SELECT COUNT(DISTINCT user_id)
FROM audits
WHERE created_at > NOW() - INTERVAL '24 hours';

-- Subscription breakdown
SELECT tier, status, COUNT(*)
FROM user_subscriptions
GROUP BY tier, status;

-- Error trends
SELECT DATE(created_at) as date, COUNT(*) as errors
FROM error_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date;

-- Token usage by tier
SELECT us.tier, SUM(utu.total_tokens) as total_tokens
FROM user_token_usage utu
JOIN user_subscriptions us ON utu.user_id = us.user_id
WHERE utu.created_at > NOW() - INTERVAL '30 days'
GROUP BY us.tier;

-- Top users by activity
SELECT p.email, COUNT(*) as audit_count
FROM audits a
JOIN profiles p ON a.user_id = p.id
WHERE a.created_at > NOW() - INTERVAL '30 days'
GROUP BY p.email
ORDER BY audit_count DESC
LIMIT 10;
```

## Additional Resources

- [Architecture Documentation](./ARCHITECTURE.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [API Documentation](https://your-app.railway.app/api)
- [Railway Documentation](https://docs.railway.app)
- [Supabase Documentation](https://supabase.com/docs)

---

**Last Updated:** November 30, 2025  
**Maintainer:** [Your Name]  
**On-Call:** See Emergency Contacts section
