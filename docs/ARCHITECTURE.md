# Architecture Documentation

## System Overview

YouTube Optimizer is a full-stack application that provides AI-powered video optimization suggestions for YouTube content creators. The system consists of a NestJS backend API, Angular frontend, and integrates with multiple external services.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                 │
│  ┌─────────────────┐         ┌──────────────────┐                  │
│  │  Angular SPA    │◄────────┤  Mobile/Desktop  │                  │
│  │  (Port 4200)    │         │   Browser        │                  │
│  └────────┬────────┘         └──────────────────┘                  │
└───────────┼──────────────────────────────────────────────────────────┘
            │ HTTPS/REST
            │
┌───────────▼──────────────────────────────────────────────────────────┐
│                      APPLICATION LAYER                                │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │              NestJS Backend (Port 3000)                       │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │   │
│  │  │   Auth     │  │  YouTube   │  │     AI     │             │   │
│  │  │  Module    │  │   Module   │  │   Module   │             │   │
│  │  └────────────┘  └────────────┘  └────────────┘             │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐             │   │
│  │  │  Logging   │  │   Metrics  │  │   Admin    │             │   │
│  │  │  Module    │  │   Module   │  │   Module   │             │   │
│  │  └────────────┘  └────────────┘  └────────────┘             │   │
│  └──────────────────────────────────────────────────────────────┘   │
└───────────┬──────────────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────────────┐
│                       DATA & SERVICES LAYER                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐    │
│  │  Supabase  │  │   Redis    │  │  OpenAI    │  │  YouTube   │    │
│  │ PostgreSQL │  │   Cache    │  │    API     │  │  Data API  │    │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘    │
└───────────────────────────────────────────────────────────────────────┘
```

## Component Architecture

### 1. **Backend API (NestJS)**

#### Core Modules

**Authentication Module** (`src/auth/`)
- JWT-based authentication
- Social authentication (Google)
- Token versioning for security
- Password breach checking
- Account lockout mechanism
- CSRF protection (disabled for JWT)

**YouTube Module** (`src/youtube/`)
- YouTube Data API integration
- Video metadata fetching
- Audit creation and retrieval
- Usage tracking and limits enforcement

**AI Module** (`src/ai/`)
- OpenAI/Groq integration
- AI prompt management
- Title, description, tag generation
- Thumbnail prompt suggestions
- Token usage tracking

**Logging Module** (`src/logging/`)
- Structured logging with Winston
- Correlation ID tracking
- File-based logging (14-day retention)
- Selective Supabase logging (critical events only)
- API request/response logging
- Error logging with stack traces

**Metrics Module** (`src/metrics/`)
- Prometheus metrics collection
- Custom metrics dashboard endpoint
- Performance monitoring
- Health checks

**Admin Module** (`src/admin/`)
- User management
- Subscription management
- System monitoring
- Security audit logs

**Common Module** (`src/common/`)
- Environment validation
- Input sanitization
- Security middleware
- Rate limiting
- CSRF service
- Password security

**Audit Module** (`src/audit/`)
- Audit trail tracking
- Database queue service
- Audit repository

**User Feedback Module** (`src/user-feedback/`)
- Feedback collection
- Feature requests
- Usage events tracking

**Onboarding Module** (`src/onboarding/`)
- User onboarding flow
- Preference collection
- Step tracking

**Health Module** (`src/health/`)
- System health checks
- Service status monitoring
- Database connectivity checks

### 2. **Database Layer (Supabase PostgreSQL)**

#### Schema Organization

**Core Tables**
- `profiles` - Extended user profiles
- `user_subscriptions` - Subscription management
- `subscription_limits` - Tier-based limits

**Business Logic Tables**
- `audits` - Video optimization audits
- `video_analysis_logs` - Detailed analysis tracking
- `user_token_usage` - AI token consumption

**Billing Tables**
- `billing_history` - Payment records
- `payment_methods` - Stored payment methods
- `promo_codes` - Promotional codes
- `promo_code_usage` - Usage tracking

**Logging Tables**
- `user_logs` - Business event logs
- `error_logs` - Application errors
- `system_logs` - System events
- `api_request_logs` - HTTP request logs

**Security Tables**
- `security_events` - Security incidents
- `audit_trail` - Change tracking
- `ip_rate_limits` - Rate limit tracking

**Engagement Tables**
- `user_feedbacks` - User feedback
- `feature_requests` - Feature voting
- `feature_votes` - Vote tracking
- `usage_events` - Analytics events
- `user_onboarding` - Onboarding progress

**Infrastructure Tables**
- `job_queue` - Background job processing

### 3. **Caching Layer (Redis)**

**Purpose**
- Session storage
- Rate limiting data
- Temporary data caching
- JWT token blacklist

**Features**
- In-memory fallback for development
- TTL-based expiration
- Pattern-based operations
- Connection pooling

### 4. **External Services**

**YouTube Data API**
- Video metadata retrieval
- Channel information
- Video statistics

**OpenAI API**
- GPT-4 for content generation
- Title optimization
- Description enhancement
- Tag suggestions

**Supabase Auth**
- User authentication
- Social login (Google)
- Password reset
- Email verification

**Monitoring Services**
- Prometheus metrics
- Custom alert system
- Telegram notifications

## Data Flow

### 1. Video Analysis Flow

```
User Request → Auth Guard → YouTube Service → AI Service → Database
     ↓             ↓              ↓               ↓            ↓
  JWT Token   Validate     Fetch Video     Generate     Save Audit
              User         Metadata        Suggestions   & Usage
```

### 2. Authentication Flow

```
Login Request → Auth Controller → Auth Service → Supabase Auth
      ↓               ↓                ↓              ↓
  Credentials    Validate         Check DB      Generate JWT
                 Input           & Limits        & Session
```

### 3. Logging Flow

```
HTTP Request → Middleware → Controller → Service → Response
     ↓             ↓            ↓           ↓         ↓
Correlation   Generate ID   Business    Log to    Return
   ID        Inject into   Logic       Winston   to Client
             Request                   + Supabase
```

## Security Architecture

### Authentication & Authorization
- JWT tokens with expiration
- Refresh token rotation
- Token versioning (invalidate on password change)
- Role-based access control (RBAC)
- Row Level Security (RLS) in database

### Input Validation
- Class-validator decorators
- Input sanitization service
- XSS prevention
- SQL injection prevention (Supabase parameterized queries)

### Rate Limiting
- Global rate limit: 1000 req/15min
- Auth endpoints: 10 req/15min
- Custom IP-based rate limiting
- Redis-backed rate limit storage

### Security Headers
- Helmet.js middleware
- CORS configuration
- Content Security Policy
- X-Frame-Options
- HSTS

### Password Security
- bcrypt hashing (12 rounds)
- HaveIBeenPwned API integration
- Password strength requirements
- Account lockout (5 failed attempts)

## Deployment Architecture

### Railway Platform

```
┌─────────────────────────────────────────────────┐
│              Railway Environment                 │
│  ┌────────────────────────────────────────┐    │
│  │   NestJS Application Container          │    │
│  │   - Node.js 20+                         │    │
│  │   - Environment variables injected      │    │
│  │   - Auto-scaling enabled                │    │
│  └────────────────────────────────────────┘    │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │   PostgreSQL (Supabase External)        │    │
│  │   - Managed database                    │    │
│  │   - Automatic backups                   │    │
│  └────────────────────────────────────────┘    │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │   Redis (Optional - External)           │    │
│  │   - Upstash Redis recommended           │    │
│  └────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

### Environment Configuration

**Development**
- Local Node.js server
- Docker Compose for Redis
- Supabase cloud database
- Hot reload enabled

**Production (Railway)**
- Node.js container
- Environment variables via Railway
- Supabase production database
- Redis via external provider
- HTTPS enforced
- Health check endpoint

## Monitoring & Observability

### Metrics Collection
- Prometheus format metrics at `/api/v1/metrics`
- Custom dashboard at `/api/v1/metrics-dashboard`
- HTTP request metrics
- System resource metrics
- Business metrics (audits, tokens)

### Logging Strategy
- **Winston file logging**: All logs → `logs/` directory
- **Supabase logging**: Critical events only (70% reduction)
- **Correlation IDs**: Track requests across services
- **Log retention**: 14 days (configurable)
- **Log levels**: DEBUG, INFO, WARNING, ERROR, CRITICAL

### Alerting
- Telegram bot notifications
- Email alerts (optional)
- WhatsApp alerts via Twilio (optional)
- Alert conditions:
  - Error rate > 5%
  - Response time > 2000ms
  - System errors detected

### Health Checks
- `/health` endpoint
- Database connectivity
- Redis connectivity
- External API status
- Used by Railway for auto-restart

## Scalability Considerations

### Current Limitations
- Single instance deployment
- In-memory session fallback
- File-based logging

### Scaling Path
1. **Horizontal Scaling**
   - Add Redis for distributed sessions
   - Load balancer (Railway provides)
   - Multiple app instances

2. **Database Optimization**
   - Connection pooling (Supabase pgBouncer)
   - Read replicas for analytics
   - Query optimization with indexes

3. **Caching Strategy**
   - Redis for API responses
   - CDN for static assets (frontend)
   - Edge caching with Cloudflare

4. **Microservices (Future)**
   - Separate AI service
   - Dedicated analytics service
   - Background job processor

## Technology Stack

### Backend Framework
- **NestJS 10.x** - TypeScript framework
- **Node.js 20+** - Runtime environment
- **TypeScript** - Type-safe development

### Database & ORM
- **Supabase** - PostgreSQL database + Auth
- **Supabase Client** - Database client library
- **Row Level Security** - Database-level authorization

### Caching
- **Redis** - In-memory cache
- **redis** npm package - Redis client

### Authentication
- **JWT** - Token-based auth
- **Passport.js** - Authentication middleware
- **bcrypt** - Password hashing

### Logging & Monitoring
- **Winston** - Logging library
- **winston-daily-rotate-file** - Log rotation
- **@willsoto/nestjs-prometheus** - Metrics
- **uuid** - Correlation IDs

### Security
- **Helmet** - Security headers
- **express-rate-limit** - Rate limiting
- **class-validator** - Input validation
- **class-transformer** - DTO transformation

### External APIs
- **OpenAI SDK** - AI integration
- **YouTube Data API v3** - Video data
- **HaveIBeenPwned API** - Password breach check

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Testing framework
- **Supabase CLI** - Database migrations

## Future Enhancements

1. **GraphQL API** - Alternative to REST
2. **WebSocket Support** - Real-time updates
3. **Message Queue** - RabbitMQ/Bull for jobs
4. **Elasticsearch** - Advanced search
5. **OpenTelemetry** - Distributed tracing
6. **Docker Compose** - Full local environment
7. **CI/CD Pipeline** - Automated testing/deployment
8. **API Versioning** - v2 endpoints
