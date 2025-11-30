# Deployment Guide

Complete guide for deploying YouTube Optimizer Backend to various environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Local Development](#local-development)
4. [Railway Deployment](#railway-deployment)
5. [Database Migrations](#database-migrations)
6. [Environment Variables](#environment-variables)
7. [Health Checks](#health-checks)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Accounts & Services

- **Supabase Account** (Free tier available)
  - Sign up at [supabase.com](https://supabase.com)
  - Create a new project
  - Note: Project URL, Anon Key, Service Role Key

- **OpenAI Account** (Paid)
  - Sign up at [platform.openai.com](https://platform.openai.com)
  - Create API key with GPT-4 access
  - Add payment method

- **YouTube Data API** (Free tier: 10k quota/day)
  - Go to [Google Cloud Console](https://console.cloud.google.com)
  - Create project → Enable YouTube Data API v3
  - Create credentials → API Key

- **Railway Account** (Free tier: $5 credit/month)
  - Sign up at [railway.app](https://railway.app)
  - Connect GitHub account

### Optional Services

- **Redis Cloud** (Upstash recommended - Free tier available)
- **Google OAuth** (For social login)
- **Stripe** (For payments)
- **Telegram Bot** (For alerts - Free)

### Development Tools

```bash
# Required
Node.js 20.x or higher
npm 10.x or higher
Git

# Optional
Docker Desktop (for local Redis)
Supabase CLI (for migrations)
```

## Environment Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-username/youtube-optimizer-BE.git
cd youtube-optimizer-BE
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Environment File

```bash
# Copy example environment file
cp .env.example .env
```

### 4. Configure Environment Variables

Edit `.env` with your actual credentials:

```env
# =====================================================
# CORE APPLICATION SETTINGS
# =====================================================
NODE_ENV=development
PORT=3000

# =====================================================
# DATABASE & SUPABASE (REQUIRED)
# =====================================================
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_KEY=your_supabase_service_role_key_here
SUPABASE_PROJECT_REF=your_project_reference_id

# =====================================================
# EXTERNAL API KEYS (REQUIRED)
# =====================================================
OPENAI_API_KEY=sk-proj-your_openai_api_key_here
YOUTUBE_API_KEY=your_youtube_data_api_key_here

# =====================================================
# AUTHENTICATION & SECURITY (REQUIRED)
# =====================================================
# Generate with: node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
JWT_SECRET=your_jwt_secret_64_bytes_base64_encoded
SESSION_SECRET=your-super-secret-session-key-change-in-production-minimum-32-chars
CSRF_SECRET=your-csrf-secret-key-minimum-32-characters-for-security

# =====================================================
# REDIS CONFIGURATION (OPTIONAL IN DEV)
# =====================================================
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# =====================================================
# CORS & FRONTEND CONFIGURATION
# =====================================================
FRONTEND_URL=http://localhost:4200
CORS_ORIGINS=http://localhost:4200,http://localhost:3000
BACKEND_URL=http://localhost:3000
```

## Local Development

### Option 1: Without Redis (Simplest)

```bash
# Start development server
npm run start:dev

# Server runs at http://localhost:3000
# API documentation at http://localhost:3000/api
```

The application will use in-memory fallback for caching.

### Option 2: With Redis (Recommended)

```bash
# Start Redis with Docker
docker-compose up -d redis

# Start development server
npm run start:dev
```

### Option 3: Full Docker Setup

```bash
# Start all services (backend + redis)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Stop services
docker-compose down
```

### Verify Local Setup

1. **Health Check**
```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-11-30T...",
  "services": {
    "database": { "status": "healthy" },
    "redis": { "status": "healthy" }
  }
}
```

2. **API Documentation**
Open browser: http://localhost:3000/api

3. **Test Authentication**
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!@#","name":"Test User"}'
```

## Railway Deployment

### Step 1: Prepare Repository

Ensure these files exist:
- `railway.json` or `railway.toml` (optional)
- `Dockerfile` (optional - Railway auto-detects Node.js)
- `.env.example` (for documentation)

### Step 2: Create Railway Project

1. Go to [railway.app/new](https://railway.app/new)
2. Click **"Deploy from GitHub repo"**
3. Select your repository
4. Railway will auto-detect Node.js project

### Step 3: Configure Environment Variables

In Railway dashboard → Variables tab, add:

**Required Variables:**
```
NODE_ENV=production
PORT=3000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key
SUPABASE_SERVICE_KEY=your_service_key
SUPABASE_PROJECT_REF=your_project_ref
OPENAI_API_KEY=sk-proj-...
YOUTUBE_API_KEY=AIza...
JWT_SECRET=<generate-64-byte-base64>
SESSION_SECRET=<generate-32-chars-min>
CSRF_SECRET=<generate-32-chars-min>
FRONTEND_URL=https://your-frontend.vercel.app
CORS_ORIGINS=https://your-frontend.vercel.app,https://yourdomain.com
BACKEND_URL=${{RAILWAY_PUBLIC_DOMAIN}}
```

**Optional Variables:**
```
# Redis (if using external provider)
REDIS_HOST=your-redis-host.upstash.io
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# Telegram Alerts
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id

# Email Alerts
ALERT_EMAIL=alerts@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password

# Google OAuth (if enabled)
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=${{RAILWAY_PUBLIC_DOMAIN}}/auth/social/google

# Stripe (if enabled)
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

### Step 4: Generate Secrets

Generate secure secrets locally:

```bash
# JWT Secret (64 bytes)
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"

# Session Secret (32+ chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# CSRF Secret (32+ chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 5: Deploy

Railway will automatically:
1. Detect Node.js 20
2. Run `npm install`
3. Build with `npm run build`
4. Start with `npm run start:prod`
5. Assign public URL

### Step 6: Configure Custom Domain (Optional)

1. In Railway → Settings → Domains
2. Click **"Generate Domain"** or **"Custom Domain"**
3. Update DNS records (for custom domain)
4. Update `BACKEND_URL` and `CORS_ORIGINS` environment variables

### Step 7: Enable Health Check

Railway automatically uses `/health` endpoint for monitoring.

Configure in `railway.json`:
```json
{
  "deploy": {
    "healthcheckPath": "/health",
    "healthcheckTimeout": 100,
    "restartPolicyType": "on_failure",
    "restartPolicyMaxRetries": 10
  }
}
```

## Database Migrations

### Initial Setup

1. **Install Supabase CLI**
```bash
npm install -g supabase
# or use npx
npx supabase --version
```

2. **Login to Supabase**
```bash
npx supabase login
```
Browser will open for authentication.

3. **Link to Project**
```bash
npm run db:link
# Enter your project reference ID when prompted
```

### Running Migrations

**Push migrations to database:**
```bash
npm run db:push
```

This applies all migrations in `supabase/migrations/` in order:
- `20251130000001_core_users.sql`
- `20251130000002_subscriptions_billing.sql`
- `20251130000003_video_analysis.sql`
- `20251130000004_logging_tables.sql`
- `20251130000005_security_audit.sql`
- `20251130000006_user_engagement.sql`
- `20251130000007_job_queue.sql`

**Create new migration:**
```bash
npm run db:migration:new your_migration_name
```

**Pull current schema:**
```bash
npm run db:pull
```

**Reset database (DESTRUCTIVE):**
```bash
npm run db:reset
```

### Migration Troubleshooting

**Error: "relation already exists"**
```bash
# Mark migrations as applied
npx supabase migration repair --status applied 20251130000001
npx supabase migration repair --status applied 20251130000002
# ... repeat for all migrations
```

## Environment Variables

### Required Variables Checklist

- [ ] `NODE_ENV` - Environment (development/production)
- [ ] `PORT` - Application port (default: 3000)
- [ ] `SUPABASE_URL` - Supabase project URL
- [ ] `SUPABASE_KEY` - Supabase anon key
- [ ] `SUPABASE_SERVICE_KEY` - Supabase service role key
- [ ] `OPENAI_API_KEY` - OpenAI API key
- [ ] `YOUTUBE_API_KEY` - YouTube Data API key
- [ ] `JWT_SECRET` - JWT signing secret (64 bytes)
- [ ] `SESSION_SECRET` - Session secret (32+ chars)
- [ ] `CSRF_SECRET` - CSRF protection secret (32+ chars)
- [ ] `FRONTEND_URL` - Frontend application URL
- [ ] `CORS_ORIGINS` - Allowed CORS origins (comma-separated)

### Optional Variables

- [ ] `REDIS_HOST` - Redis server host
- [ ] `REDIS_PORT` - Redis server port
- [ ] `REDIS_PASSWORD` - Redis password
- [ ] `TELEGRAM_BOT_TOKEN` - Telegram bot token
- [ ] `TELEGRAM_CHAT_ID` - Telegram chat ID
- [ ] `GOOGLE_CLIENT_ID` - Google OAuth client ID
- [ ] `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- [ ] `STRIPE_SECRET_KEY` - Stripe secret key

### Environment Validation

The application validates environment variables on startup. If required variables are missing, the application will:
1. Log detailed error messages
2. Exit with error code 1
3. Prevent startup

Check logs for validation errors:
```bash
# Railway logs
railway logs

# Local logs
npm run start:dev
```

## Health Checks

### Health Endpoint

**URL:** `GET /health`

**Response:**
```json
{
  "status": "healthy",
  "uptime": 12345.67,
  "timestamp": "2025-11-30T12:00:00.000Z",
  "environment": "production",
  "version": "1.0.0",
  "memory": {
    "heapUsed": 50123456,
    "heapTotal": 100123456,
    "rss": 150123456,
    "external": 1234567
  },
  "services": {
    "database": {
      "status": "healthy",
      "responseTime": 45,
      "message": "Connected"
    },
    "redis": {
      "status": "healthy",
      "message": "Connected"
    },
    "openai": {
      "status": "healthy",
      "message": "API key configured"
    },
    "youtube": {
      "status": "healthy",
      "message": "API key configured"
    }
  }
}
```

### Monitoring Health

**Railway automatically monitors `/health` endpoint**

Configure alerts:
```bash
# In Railway dashboard
Settings → Health Checks → Enable
```

**Manual health check:**
```bash
curl https://your-app.railway.app/health
```

## Troubleshooting

### Common Issues

#### 1. Application Won't Start

**Symptom:** Application crashes on startup

**Solutions:**
```bash
# Check environment variables
npm run start:dev 2>&1 | grep "Missing required"

# Verify database connection
curl https://your-project.supabase.co/rest/v1/
```

#### 2. CORS Errors

**Symptom:** Frontend can't connect, CORS errors in browser

**Solution:**
```env
# Update .env or Railway variables
CORS_ORIGINS=https://your-frontend.vercel.app,https://yourdomain.com
FRONTEND_URL=https://your-frontend.vercel.app
```

#### 3. Database Connection Failed

**Symptom:** "Failed to connect to database"

**Solutions:**
```bash
# Verify Supabase URL and keys
curl https://your-project.supabase.co/rest/v1/ \
  -H "apikey: your_anon_key"

# Check if project is paused (free tier)
# Visit Supabase dashboard
```

#### 4. Redis Connection Failed

**Symptom:** "Failed to connect to Redis"

**Solution:**
```bash
# Application uses in-memory fallback
# No action needed for basic functionality

# Or setup Redis:
# - Railway: Add Redis service
# - Upstash: Create database, add env vars
```

#### 5. Migration Errors

**Symptom:** "relation already exists" during migration

**Solution:**
```bash
# Option 1: Mark migrations as applied
npm run db:status
npx supabase migration repair --status applied <migration_name>

# Option 2: Reset database (DESTRUCTIVE)
npm run db:reset
npm run db:push
```

#### 6. High Memory Usage

**Symptom:** Application crashes with "out of memory"

**Solution:**
```bash
# Railway: Increase memory in Settings
# Or optimize application:
# - Reduce log retention days
# - Clear old logs
# - Monitor memory usage
```

### Debug Mode

Enable debug logging:
```env
# Local development
NODE_ENV=development
LOG_LEVEL=debug

# Railway (temporary)
LOG_LEVEL=debug
```

View detailed logs:
```bash
# Railway
railway logs --tail

# Local
npm run start:dev
```

### Getting Help

1. **Check logs** - Most issues show detailed error messages
2. **Verify environment variables** - Use checklist above
3. **Test health endpoint** - `curl /health`
4. **Review documentation** - Check README.md and docs/
5. **GitHub Issues** - Search existing issues or create new one

## Production Checklist

Before deploying to production:

### Security
- [ ] All secrets are generated securely (64+ bytes)
- [ ] `NODE_ENV=production`
- [ ] HTTPS enabled (Railway provides)
- [ ] CORS restricted to specific domains
- [ ] Rate limiting enabled
- [ ] Input validation enabled
- [ ] Helmet security headers enabled

### Database
- [ ] Migrations applied successfully
- [ ] Row Level Security (RLS) policies enabled
- [ ] Indexes created for performance
- [ ] Backup strategy configured (Supabase auto-backups)

### Monitoring
- [ ] Health check endpoint working
- [ ] Alerts configured (Telegram/Email)
- [ ] Logging enabled and working
- [ ] Metrics endpoint accessible

### Performance
- [ ] Redis configured (or in-memory fallback accepted)
- [ ] Connection pooling enabled (Supabase pgBouncer)
- [ ] Log retention configured (14 days recommended)

### Documentation
- [ ] README.md updated with deployment URL
- [ ] API documentation accessible
- [ ] Environment variables documented
- [ ] Runbook created for incidents

## Deployment Commands Reference

```bash
# Development
npm run start:dev          # Start with hot reload
npm run build              # Build for production
npm run start:prod         # Start production build

# Database
npm run db:link            # Link to Supabase project
npm run db:push            # Apply migrations
npm run db:pull            # Pull current schema
npm run db:status          # Check migration status
npm run db:reset           # Reset database (DESTRUCTIVE)
npm run db:migration:new   # Create new migration

# Testing
npm test                   # Run unit tests
npm run test:e2e          # Run E2E tests
npm run test:cov          # Test coverage

# Code Quality
npm run lint              # Run ESLint
npm run format            # Format with Prettier

# Railway
railway login             # Login to Railway
railway link              # Link to project
railway up                # Deploy
railway logs              # View logs
railway env               # Manage environment variables
```

## Next Steps

After successful deployment:

1. **Configure frontend** - Update API URL in frontend app
2. **Test functionality** - Run through user flows
3. **Monitor logs** - Watch for errors in first 24 hours
4. **Set up alerts** - Configure Telegram/email notifications
5. **Create backup strategy** - Document recovery procedures
6. **Performance testing** - Load test critical endpoints
7. **Security audit** - Review security headers and policies

## Support

For deployment issues:
- **Railway**: [railway.app/help](https://railway.app/help)
- **Supabase**: [supabase.com/docs](https://supabase.com/docs)
- **GitHub**: Open an issue in repository
