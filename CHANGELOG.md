# API Changelog

All notable changes to the YouTube Optimizer Backend API will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned Features
- GraphQL API support
- WebSocket real-time updates
- API rate limit tiers per subscription
- Batch video analysis endpoint
- Video comparison analytics

---

## [1.0.0] - 2025-11-30

### Added - Initial Production Release

#### Authentication & Security
- JWT-based authentication with refresh tokens
- Token versioning for security (invalidate on password change)
- Google OAuth social login support
- Password breach checking via HaveIBeenPwned API
- Account lockout after 5 failed login attempts
- CSRF protection (disabled for JWT, documented)
- Security audit trail tracking
- Rate limiting (1000 req/15min global, 10 req/15min auth endpoints)
- Custom IP-based rate limiting
- Helmet security headers middleware
- Input sanitization service
- CORS configuration with environment-aware origins

#### Core API Endpoints

**Authentication** (`/auth`)
- `POST /auth/register` - User registration with email/password
- `POST /auth/login` - User login with credentials
- `POST /auth/logout` - User logout and token invalidation
- `POST /auth/refresh` - Refresh access token
- `POST /auth/forgot-password` - Password reset request
- `GET /auth/social/google` - Google OAuth login
- `GET /auth/social/google/callback` - Google OAuth callback

**YouTube Video Analysis** (`/api/v1/youtube`)
- `POST /api/v1/youtube/analyze` - Analyze YouTube video with AI
- `GET /api/v1/youtube/audits` - Get user's audit history
- `GET /api/v1/youtube/audits/:id` - Get specific audit details
- `DELETE /api/v1/youtube/audits/:id` - Delete audit

**AI Suggestions** (`/api/v1/ai`)
- `POST /api/v1/ai/suggestions` - Generate AI-powered suggestions
- `POST /api/v1/ai/title` - Generate optimized titles
- `POST /api/v1/ai/description` - Generate optimized descriptions
- `POST /api/v1/ai/tags` - Generate relevant tags
- `POST /api/v1/ai/thumbnail-prompt` - Generate thumbnail ideas

**User Feedback** (`/api/v1/feedback`)
- `POST /api/v1/feedback` - Submit user feedback
- `GET /api/v1/feedback` - Get user's feedback history
- `POST /api/v1/feedback/feature-request` - Submit feature request
- `GET /api/v1/feedback/feature-requests` - List all feature requests
- `POST /api/v1/feedback/feature-requests/:id/vote` - Vote on feature

**User Onboarding** (`/api/v1/onboarding`)
- `GET /api/v1/onboarding/status` - Get onboarding progress
- `POST /api/v1/onboarding/update` - Update onboarding step
- `POST /api/v1/onboarding/complete` - Complete onboarding

**Admin** (`/api/v1/admin`)
- `GET /api/v1/admin/users` - List all users (admin only)
- `GET /api/v1/admin/users/:id` - Get user details
- `PUT /api/v1/admin/users/:id` - Update user
- `DELETE /api/v1/admin/users/:id` - Delete user
- `GET /api/v1/admin/subscriptions` - List all subscriptions
- `GET /api/v1/admin/security-audit` - View security audit logs
- `GET /api/v1/admin/stats` - Platform statistics

**Health & Monitoring**
- `GET /health` - Application health check
- `GET /api/v1/metrics` - Prometheus metrics (text format)
- `GET /api/v1/metrics-dashboard` - Human-readable metrics dashboard
- `GET /api/v1/metrics-json` - Machine-readable JSON metrics

#### Logging & Observability
- Structured logging with Winston
- File-based logging with daily rotation (14-day retention)
- Correlation ID tracking across requests
- Selective Supabase logging (critical events only, 70% reduction)
- Request/response logging middleware
- Error logging with stack traces
- Business event logging
- System event logging
- API request logging (selective)

#### Monitoring & Alerts
- Prometheus metrics collection
- Custom metrics dashboard
- HTTP request metrics (count, duration, status codes)
- System resource metrics (memory, CPU)
- Business metrics (audit count, token usage)
- Telegram bot alerts (error rate, response time, system errors)
- Email alert support
- WhatsApp alert support via Twilio

#### Database & Migrations
- Supabase PostgreSQL database
- 23 production tables with Row Level Security
- Migration system via Supabase CLI
- Automatic backups
- Database queue service for async operations
- Connection pooling support

#### Subscription System
- Three tiers: Free, Pro, Premium
- Monthly/yearly billing intervals
- Stripe integration for payments
- Promo code support
- Usage tracking and limits enforcement
- Billing history

#### Performance Features
- Redis caching support (with in-memory fallback)
- Connection pooling
- Query optimization with indexes
- Response compression
- Rate limiting to prevent abuse

### API Response Format

All successful responses follow this format:
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error message",
  "statusCode": 400,
  "timestamp": "2025-11-30T12:00:00.000Z",
  "path": "/api/v1/endpoint"
}
```

### Rate Limits

- **Global**: 1000 requests per 15 minutes per IP
- **Authentication endpoints**: 10 requests per 15 minutes per IP
- **Custom IP rate limiting**: Configurable per endpoint

Rate limit headers:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1638316800
```

### Authentication

All protected endpoints require JWT token in Authorization header:
```
Authorization: Bearer <jwt_token>
```

Token expiration: 15 minutes (configurable)
Refresh token expiration: 7 days (configurable)

### Pagination

List endpoints support pagination:
```
GET /api/v1/endpoint?page=1&limit=10&sortBy=created_at&order=desc
```

Response includes pagination metadata:
```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### CORS Policy

Allowed origins configured via `CORS_ORIGINS` environment variable.

Default development: `http://localhost:4200`

Allowed methods: `GET, POST, PUT, DELETE, PATCH, OPTIONS`

Allowed headers: `Content-Type, Authorization, X-Correlation-Id`

### Breaking Changes

None - Initial release

### Deprecations

None - Initial release

---

## Version History

### Version Numbering

- **Major version** (X.0.0): Breaking changes to API
- **Minor version** (0.X.0): New features, backward compatible
- **Patch version** (0.0.X): Bug fixes, backward compatible

### API Stability Promise

- Current API version: **v1**
- Stability: **Stable** (production-ready)
- Breaking changes require new version (v2)
- Deprecated features will be supported for 6 months minimum

### Deprecation Policy

When an endpoint or feature is deprecated:
1. **Announcement**: Added to changelog 3 months before removal
2. **Warning**: API returns deprecation warning header
3. **Migration guide**: Provided in documentation
4. **Removal**: After 6-month grace period

Deprecation header format:
```
Deprecation: true
Sunset: Sat, 01 Jun 2026 00:00:00 GMT
Link: <https://docs.example.com/migration>; rel="alternate"
```

---

## Migration Guides

### Future Breaking Changes

No breaking changes planned. Will be documented here when announced.

---

## API Versioning

### Current Version: v1

Base URL: `https://your-app.railway.app/api/v1`

### Version Support Policy

- **Current version (v1)**: Fully supported, receives all updates
- **Previous version (v0)**: N/A - Initial release
- **Deprecated versions**: N/A

### Version Selection

Default: Latest stable version (v1)

To specify version:
```
GET https://your-app.railway.app/api/v1/endpoint
```

---

## OpenAPI Specification

Interactive API documentation available at:
```
https://your-app.railway.app/api
```

OpenAPI JSON spec:
```
https://your-app.railway.app/api-json
```

---

## SDKs and Client Libraries

### Official SDKs

- None yet - Contributions welcome!

### Community SDKs

- None yet

### Code Examples

Available in [API documentation](https://your-app.railway.app/api)

Languages supported in examples:
- cURL
- JavaScript/TypeScript
- Python
- PHP

---

## Known Issues

### Current Limitations

1. **Single instance deployment**
   - Horizontal scaling requires Redis for session management
   - Workaround: Use Railway's auto-scaling with sticky sessions

2. **File-based logging**
   - Logs stored locally (lost on container restart)
   - Workaround: Use external logging service (future enhancement)

3. **In-memory cache fallback**
   - Cache not shared between instances without Redis
   - Workaround: Deploy Redis instance

4. **Rate limiting per instance**
   - Rate limits not shared across scaled instances without Redis
   - Workaround: Deploy Redis for distributed rate limiting

### Upcoming Fixes

- None currently tracked

---

## Performance Benchmarks

### Response Times (95th percentile)

- Authentication: < 200ms
- Video analysis: < 3000ms (includes AI processing)
- Database queries: < 50ms
- Health check: < 10ms

### Throughput

- Maximum requests per second: 100 (single instance)
- Concurrent connections: 1000
- Database connections: 25 (pooled)

### Resource Usage

- Memory: ~150MB baseline, ~300MB under load
- CPU: <5% idle, <50% under load
- Disk: Minimal (logs only)

---

## Security Disclosures

### Reporting Security Issues

**DO NOT** open public GitHub issues for security vulnerabilities.

Contact: security@yourdomain.com (or your contact email)

Response time: Within 48 hours

### Security Headers

All responses include:
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'
```

### Dependency Security

- Automated dependency updates via Dependabot
- Security audits: `npm audit` in CI/CD
- Regular security reviews

---

## Support and Contact

### API Support

- Documentation: https://your-app.railway.app/api
- GitHub Issues: https://github.com/your-username/youtube-optimizer-BE/issues
- Email: support@yourdomain.com

### Status Page

- Health endpoint: https://your-app.railway.app/health
- Metrics: https://your-app.railway.app/api/v1/metrics-dashboard

### Community

- GitHub Discussions: https://github.com/your-username/youtube-optimizer-BE/discussions
- Discord: (if applicable)
- Twitter: (if applicable)

---

## Changelog Format

### Types of Changes

- **Added** - New features
- **Changed** - Changes in existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements

### Example Entry

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New endpoint `POST /api/v1/new-feature`
- New query parameter `filter` on list endpoints

### Changed
- Improved performance of `/api/v1/heavy-endpoint` by 50%
- Updated response format for `/api/v1/data` (backward compatible)

### Deprecated
- `GET /api/v1/old-endpoint` - Use `/api/v1/new-endpoint` instead
  - Removal date: YYYY-MM-DD
  - Migration guide: docs/migrations/old-to-new.md

### Fixed
- Fixed authentication bug where tokens expired too early
- Fixed race condition in concurrent requests

### Security
- Updated dependencies to patch CVE-XXXX-XXXXX
- Improved password hashing algorithm
```

---

**Last Updated:** November 30, 2025  
**Current API Version:** v1.0.0  
**Stability:** Stable
