# Notification System - Quick Reference

## 🚀 Quick Start

### 1. Run Database Migration
```sql
-- Run in Supabase SQL Editor
-- File: migrations/002_create_notifications_table.sql
```

### 2. Import Module
```typescript
import { NotificationModule } from './notifications/notification.module';

@Module({
  imports: [NotificationModule, ...],
})
export class YourModule {}
```

### 3. Inject Service
```typescript
constructor(
  private readonly notificationService: NotificationService,
) {}
```

### 4. Send Notification
```typescript
await this.notificationService.notifyAnalysisCompleted(userId, videoId, url);
```

---

## 📋 All Helper Methods

### System Notifications
```typescript
await notificationService.notifySubscriptionExpiring(userId, daysLeft);
await notificationService.notifyPaymentFailed(userId);
await notificationService.notifyEmailNotVerified(userId);
await notificationService.notifyMonthlyQuotaReached(userId);
```

### Processing Notifications
```typescript
await notificationService.notifyAnalysisStarted(userId, videoId, videoUrl);
await notificationService.notifyAnalysisCompleted(userId, videoId, videoUrl);
await notificationService.notifyThumbnailGenerated(userId, videoId);
await notificationService.notifyProcessingFailed(userId, videoId, reason);
await notificationService.notifyMissingTranscript(userId, videoId);
```

### Usage & Limits
```typescript
await notificationService.notifyUsageThreshold(userId, percentage); // 80, 90, etc.
await notificationService.notifyLowCredits(userId, creditsLeft);
await notificationService.notifyTierLimitReached(userId, limit);
```

### Product Updates
```typescript
await notificationService.notifyNewFeature(userId, featureName, description);
await notificationService.notifyModelUpgrade(userId, modelName);
await notificationService.notifyPerformanceOptimization(userId, improvement);
```

### Tips
```typescript
await notificationService.notifyTip(userId, tipTitle, tipMessage);
```

### Security
```typescript
await notificationService.notifyNewDeviceLogin(userId, deviceInfo, ipAddress);
await notificationService.notifyPasswordChanged(userId);
await notificationService.notifyApiUsageAnomaly(userId, description);
```

### Custom Notification
```typescript
await notificationService.sendNotification(
  userId,
  'Title',
  'Message',
  NotificationType.SYSTEM,
  { customField: 'value' }
);
```

---

## 🎯 REST API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/notifications` | Get notifications (with filters) |
| GET | `/notifications/unread-count` | Get unread count |
| GET | `/notifications/stats` | Get statistics |
| POST | `/notifications/:id/read` | Mark as read |
| POST | `/notifications/bulk-read` | Mark multiple as read |
| POST | `/notifications/read-all` | Mark all as read |
| DELETE | `/notifications/:id` | Delete notification |

---

## 🔧 Integration Examples

### Example 1: Video Processing
```typescript
@Injectable()
export class VideoProcessor {
  constructor(private notificationService: NotificationService) {}

  async process(userId: string, videoId: string, url: string) {
    try {
      await this.notificationService.notifyAnalysisStarted(userId, videoId, url);
      
      // ... processing ...
      
      await this.notificationService.notifyAnalysisCompleted(userId, videoId, url);
    } catch (error) {
      await this.notificationService.notifyProcessingFailed(userId, videoId, error.message);
    }
  }
}
```

### Example 2: Usage Monitoring
```typescript
@Injectable()
export class UsageMonitor {
  constructor(private notificationService: NotificationService) {}

  async checkUsage(userId: string) {
    const usage = await this.getUsage(userId);
    const limit = await this.getLimit(userId);
    const percentage = (usage / limit) * 100;

    if (percentage >= 80) {
      await this.notificationService.notifyUsageThreshold(userId, 80);
    }
  }
}
```

### Example 3: Security Events
```typescript
@Injectable()
export class SecurityMonitor {
  constructor(private notificationService: NotificationService) {}

  async onLogin(userId: string, deviceInfo: string, ip: string) {
    if (await this.isNewDevice(userId, deviceInfo)) {
      await this.notificationService.notifyNewDeviceLogin(userId, deviceInfo, ip);
    }
  }

  async onPasswordChange(userId: string) {
    await this.notificationService.notifyPasswordChanged(userId);
  }
}
```

---

## 📊 Notification Types

```typescript
enum NotificationType {
  SYSTEM = 'system',       // Subscription, payment, account
  PROCESSING = 'processing', // Video analysis, thumbnails
  USAGE = 'usage',         // Limits, quotas, credits
  UPDATE = 'update',       // New features, upgrades
  TIP = 'tip',            // Best practices, suggestions
  SECURITY = 'security'    // Login, password, anomalies
}
```

---

## 🗃️ Database Schema

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type notification_type NOT NULL,
  read boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  metadata jsonb DEFAULT '{}'
);
```

---

## 📱 Frontend Integration

### Fetch Notifications
```javascript
const response = await fetch('/notifications?type=processing&read=false&limit=20', {
  headers: { Authorization: `Bearer ${token}` }
});
const { notifications, total } = await response.json();
```

### Get Unread Count (Poll every 30s)
```javascript
const response = await fetch('/notifications/unread-count', {
  headers: { Authorization: `Bearer ${token}` }
});
const { count } = await response.json();
// Update badge: 🔔 (count)
```

### Mark as Read
```javascript
await fetch(`/notifications/${notificationId}/read`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
```

### Mark All as Read
```javascript
await fetch('/notifications/read-all', {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}` }
});
```

---

## 🧹 Maintenance

### Cleanup Old Notifications
```typescript
// Run daily via cron
await notificationService.cleanupOldNotifications(30); // Delete read notifications older than 30 days
```

---

## 🔒 Security

- ✅ Row-Level Security (RLS) enabled
- ✅ Users can only see their own notifications
- ✅ JWT authentication required
- ✅ Service role can create notifications for any user

---

## 📖 Full Documentation

See `docs/notification-system.md` for complete documentation including:
- Architecture details
- Advanced integration examples
- Testing strategies
- Performance optimization
- Future enhancements
