# Notification System Documentation

## Overview
The notification system provides a complete infrastructure for sending category-based notifications to users. It supports 6 notification types with in-app delivery and persistence.

## Architecture

### Database Schema
- **Table**: `notifications`
- **Type Enum**: `system | processing | usage | update | tip | security`
- **Features**: Row-Level Security (RLS), indexes, soft-read tracking

### Components
1. **NotificationRepository** - Database operations (CRUD, filtering, stats)
2. **NotificationService** - Business logic with category-specific helpers
3. **NotificationController** - REST API endpoints
4. **NotificationModule** - NestJS module with dependency injection

## Notification Categories

### 1️⃣ System Notifications
- Subscription expiring
- Payment failed
- Account changes
- Email not verified
- Monthly quota reached

### 2️⃣ Video Processing Notifications
- AI analysis started
- AI analysis completed
- Thumbnail generation completed
- Video processing failed
- Missing transcript

### 3️⃣ Usage & Limits
- Usage threshold reached (80%, 90%, etc.)
- Low credits warning
- Tier limit reached

### 4️⃣ Product Updates
- New features
- Model upgrades (e.g., GPT-4.1 support)
- Performance optimizations

### 5️⃣ Tips & Best Practices
- Customizable tips for better results
- Feature usage suggestions

### 6️⃣ Security Notifications
- Login from new device
- Password changed
- API usage anomaly

## REST API Endpoints

### Get Notifications
```http
GET /notifications?type=processing&read=false&limit=20&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**
- `type` (optional): Filter by notification type
- `read` (optional): Filter by read status (true/false)
- `limit` (optional): Number of results (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "notifications": [
    {
      "id": "uuid",
      "userId": "user-id",
      "title": "AI Analysis Completed",
      "message": "Your video analysis is ready!",
      "type": "processing",
      "read": false,
      "createdAt": "2025-12-02T10:00:00Z",
      "metadata": {
        "videoId": "vid-123",
        "actionUrl": "/results/vid-123"
      }
    }
  ],
  "total": 15
}
```

### Get Unread Count
```http
GET /notifications/unread-count
Authorization: Bearer <token>
```

**Response:**
```json
{
  "count": 5
}
```

### Get Statistics
```http
GET /notifications/stats
Authorization: Bearer <token>
```

**Response:**
```json
{
  "total": 50,
  "unread": 5,
  "byType": {
    "system": 10,
    "processing": 20,
    "usage": 5,
    "update": 8,
    "tip": 5,
    "security": 2
  }
}
```

### Mark as Read
```http
POST /notifications/:id/read
Authorization: Bearer <token>
```

### Mark Multiple as Read
```http
POST /notifications/bulk-read
Authorization: Bearer <token>
Content-Type: application/json

{
  "notificationIds": ["uuid1", "uuid2", "uuid3"]
}
```

### Mark All as Read
```http
POST /notifications/read-all
Authorization: Bearer <token>
```

### Delete Notification
```http
DELETE /notifications/:id
Authorization: Bearer <token>
```

## Integration Examples

### 1. Video Processing Integration

Update `database-queue.service.ts` to send notifications:

```typescript
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class DatabaseQueueService {
  constructor(
    private readonly notificationService: NotificationService,
    // ... other services
  ) {}

  async processYouTubeVideo(job: Job<ProcessYouTubeVideoJobData>) {
    const { userId, url } = job.data;

    try {
      // Notify analysis started
      await this.notificationService.notifyAnalysisStarted(userId, job.id, url);

      // ... process video ...

      // Notify analysis completed
      await this.notificationService.notifyAnalysisCompleted(userId, job.id, url);

    } catch (error) {
      // Notify processing failed
      await this.notificationService.notifyProcessingFailed(
        userId,
        job.id,
        error.message
      );
    }
  }
}
```

### 2. Auth Service Integration

Send security notifications on sensitive actions:

```typescript
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly notificationService: NotificationService,
    // ... other services
  ) {}

  async login(credentials: LoginDto, deviceInfo: string, ipAddress: string) {
    // ... login logic ...

    // Check if new device
    const isNewDevice = await this.checkNewDevice(userId, deviceInfo);
    if (isNewDevice) {
      await this.notificationService.notifyNewDeviceLogin(
        userId,
        deviceInfo,
        ipAddress
      );
    }
  }

  async changePassword(userId: string, newPassword: string) {
    // ... change password logic ...

    await this.notificationService.notifyPasswordChanged(userId);
  }
}
```

### 3. Subscription Service Integration

Send usage and limit notifications:

```typescript
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class SubscriptionService {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  async checkUsageLimit(userId: string) {
    const usage = await this.getUserUsage(userId);
    const limit = await this.getUserLimit(userId);
    const percentage = (usage / limit) * 100;

    // Notify at 80% threshold
    if (percentage >= 80 && percentage < 90) {
      await this.notificationService.notifyUsageThreshold(userId, 80);
    }

    // Notify at 90% threshold
    if (percentage >= 90 && percentage < 100) {
      await this.notificationService.notifyUsageThreshold(userId, 90);
    }

    // Notify when limit reached
    if (usage >= limit) {
      await this.notificationService.notifyMonthlyQuotaReached(userId);
    }
  }

  async checkSubscriptionExpiry(userId: string) {
    const expiryDate = await this.getSubscriptionExpiryDate(userId);
    const daysLeft = this.calculateDaysLeft(expiryDate);

    // Notify at 7 days, 3 days, and 1 day before expiry
    if ([7, 3, 1].includes(daysLeft)) {
      await this.notificationService.notifySubscriptionExpiring(userId, daysLeft);
    }
  }
}
```

### 4. Admin Service Integration

Send product update notifications to all users:

```typescript
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly notificationService: NotificationService,
  ) {}

  async announceNewFeature(featureName: string, description: string) {
    const users = await this.getAllActiveUsers();

    for (const user of users) {
      await this.notificationService.notifyNewFeature(
        user.id,
        featureName,
        description
      );
    }
  }

  async announceModelUpgrade(modelName: string) {
    const users = await this.getAllActiveUsers();

    for (const user of users) {
      await this.notificationService.notifyModelUpgrade(user.id, modelName);
    }
  }
}
```

### 5. Custom Notification

Send a custom notification with metadata:

```typescript
await this.notificationService.sendNotification(
  userId,
  'Custom Title',
  'Custom message with details',
  NotificationType.TIP,
  {
    customField: 'value',
    actionUrl: '/custom-action',
    extraData: { key: 'value' }
  }
);
```

## Frontend Integration Suggestions

### Real-time Updates
Consider implementing WebSocket or Server-Sent Events (SSE) for real-time notification delivery:

```typescript
// In notification.controller.ts (add SSE endpoint)
@Sse('notifications/stream')
notificationStream(@UserId() userId: string) {
  return interval(5000).pipe(
    switchMap(() => this.notificationService.getUnreadCount(userId)),
    map((count) => ({ data: { unreadCount: count } }))
  );
}
```

### Notification Center UI
- Display notifications in a dropdown/sidebar
- Filter by category
- Mark as read/unread
- Click to navigate to `actionUrl` from metadata
- Show badge with unread count

### Toast/Snackbar Notifications
- Use for real-time alerts (processing completed, errors)
- Auto-dismiss after 5 seconds
- Click to view details or navigate

## Database Migration

Run the migration to create the notifications table:

```bash
# Connect to Supabase and run:
psql <connection-string> -f migrations/002_create_notifications_table.sql
```

Or use Supabase Dashboard:
1. Go to SQL Editor
2. Copy contents of `migrations/002_create_notifications_table.sql`
3. Execute

## Maintenance

### Cleanup Old Notifications
Schedule a cron job to clean up old read notifications:

```typescript
// In a scheduled task service
@Cron('0 0 * * *') // Daily at midnight
async cleanupNotifications() {
  const deletedCount = await this.notificationService.cleanupOldNotifications(30);
  this.logger.log(`Cleaned up ${deletedCount} old notifications`);
}
```

## Testing

### Unit Tests
```typescript
describe('NotificationService', () => {
  it('should send a notification', async () => {
    const notification = await service.notifyAnalysisCompleted(
      'user-123',
      'video-456',
      'https://youtube.com/watch?v=xyz'
    );

    expect(notification).toBeDefined();
    expect(notification.type).toBe(NotificationType.PROCESSING);
  });
});
```

### Integration Tests
```typescript
it('should fetch user notifications with filters', async () => {
  const response = await request(app.getHttpServer())
    .get('/notifications?type=processing&read=false')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.notifications).toBeDefined();
  expect(response.body.total).toBeGreaterThan(0);
});
```

## Security Considerations

✅ **Implemented:**
- Row-Level Security (RLS) ensures users can only see their own notifications
- JWT authentication required for all endpoints
- Service role can create notifications for any user
- Users can only update/delete their own notifications

## Performance Optimization

- **Indexes**: Created on `user_id`, `type`, `read`, `created_at`, and composite `(user_id, read)`
- **Pagination**: All queries support limit/offset
- **Metadata**: Using JSONB for flexible metadata storage with indexing support
- **Cleanup**: Automated deletion of old read notifications

## Future Enhancements

1. **Real-time Delivery**: Implement WebSocket/SSE for instant notifications
2. **Email Notifications**: Send critical notifications via email
3. **Push Notifications**: Mobile app push notifications
4. **Notification Preferences**: Let users customize which notifications they receive
5. **Notification Templates**: Pre-defined templates for common scenarios
6. **Batching**: Group similar notifications to reduce noise
7. **Priority Levels**: Add urgency/importance levels
8. **Snooze Feature**: Allow users to snooze notifications
