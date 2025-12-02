# Notification Severity Implementation

## Overview
Added severity levels (info, success, warning, error) to the notification system to provide visual feedback distinction separate from notification types.

## Database Changes

### New Enum Type
```sql
CREATE TYPE notification_severity AS ENUM ('info', 'success', 'warning', 'error');
```

### Schema Update
```sql
ALTER TABLE public.notifications
ADD COLUMN severity notification_severity NOT NULL DEFAULT 'info';
```

### Migration
Run the migration script:
```bash
psql -h <host> -U <user> -d <database> -f scripts/add-notification-severity.sql
```

Or execute via Supabase SQL Editor:
```sql
-- Copy contents from scripts/add-notification-severity.sql
```

## Code Changes

### 1. Type Definitions (`src/notifications/models/notification.types.ts`)

Added new enum:
```typescript
export enum NotificationSeverity {
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}
```

Updated interfaces:
```typescript
export interface Notification {
  // ...existing fields
  severity?: NotificationSeverity;
}

export interface CreateNotificationDto {
  // ...existing fields
  severity?: NotificationSeverity;
}
```

### 2. Repository (`src/notifications/notification.repository.ts`)

Updated `createNotification`:
```typescript
const { data, error } = await client
  .from('notifications')
  .insert({
    user_id: dto.userId,
    title: dto.title,
    message: dto.message,
    type: dto.type,
    severity: dto.severity || 'info', // Default to 'info'
    metadata: dto.metadata || {},
  })
  .select()
  .single();
```

Updated `mapToNotification`:
```typescript
private mapToNotification(data: any): Notification {
  return {
    id: data.id,
    userId: data.user_id,
    title: data.title,
    message: data.message,
    type: data.type as NotificationType,
    severity: data.severity, // Map severity from DB
    read: data.read,
    createdAt: new Date(data.created_at),
    metadata: data.metadata || {},
  };
}
```

### 3. Service (`src/notifications/notification.service.ts`)

Updated `sendNotification` signature:
```typescript
async sendNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  metadata?: NotificationMetadata,
  severity?: NotificationSeverity, // New parameter
): Promise<Notification | null> {
  const notification = await this.repository.createNotification({
    userId,
    title,
    message,
    type,
    metadata,
    severity, // Pass to repository
  });
  // ...rest of method
}
```

### 4. Admin Controller (`src/admin/admin.controller.ts`)

Updated API documentation:
```typescript
@ApiBody({
  schema: {
    type: 'object',
    required: ['title', 'message', 'type'],
    properties: {
      // ...existing properties
      severity: {
        type: 'string',
        enum: Object.values(NotificationSeverity),
        example: NotificationSeverity.INFO,
        description: 'Severity level for visual feedback (optional, defaults to info)',
      },
    },
  },
})
```

Updated request body type:
```typescript
body: {
  userId?: string;
  title: string;
  message: string;
  type: NotificationType;
  severity?: NotificationSeverity; // New field
  metadata?: Record<string, any>;
}
```

Updated service call:
```typescript
const notification = await this.notificationService.sendNotification(
  userId || 'broadcast',
  title,
  message,
  type,
  metadata,
  severity, // Pass severity
);
```

## Usage Examples

### Admin API - Send Notification

**Endpoint:** `POST /admin/notifications/send`

**Headers:**
```
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

**Body:**
```json
{
  "userId": "123e4567-e89b-12d3-a456-426614174000",
  "title": "Analysis Complete",
  "message": "Your video analysis has completed successfully!",
  "type": "processing",
  "severity": "success",
  "metadata": {
    "videoId": "abc123",
    "duration": 45000
  }
}
```

### Severity Guidelines

| Severity | Use Case | Visual Style | Examples |
|----------|----------|--------------|----------|
| `info` | General information, default | Blue/neutral | Tips, updates, general notifications |
| `success` | Positive outcomes | Green | Analysis complete, upload success, action confirmed |
| `warning` | Caution required | Yellow/orange | Approaching limit, minor issues, deprecation notices |
| `error` | Critical issues | Red | Errors, failures, security alerts |

### Code Examples

**Success notification:**
```typescript
await notificationService.sendNotification(
  userId,
  'Upload Complete',
  'Your video has been uploaded successfully',
  NotificationType.PROCESSING,
  { videoId: '123' },
  NotificationSeverity.SUCCESS
);
```

**Warning notification:**
```typescript
await notificationService.sendNotification(
  userId,
  'Storage Limit',
  'You are approaching your storage limit (80% used)',
  NotificationType.USAGE,
  { usagePercent: 80 },
  NotificationSeverity.WARNING
);
```

**Error notification:**
```typescript
await notificationService.sendNotification(
  userId,
  'Analysis Failed',
  'Video analysis failed due to an error',
  NotificationType.PROCESSING,
  { error: 'Invalid format' },
  NotificationSeverity.ERROR
);
```

## Frontend Integration

### WebSocket Event
Notifications received via WebSocket now include severity:

```typescript
socket.on('notification', (notification: Notification) => {
  const { id, title, message, type, severity, metadata } = notification;
  
  // Use severity for visual styling
  const color = {
    info: 'blue',
    success: 'green',
    warning: 'orange',
    error: 'red',
  }[severity || 'info'];
  
  // Show notification with appropriate styling
  showNotification(title, message, color);
});
```

### REST API (Admin)
When fetching notifications via REST endpoints, severity is included in response:

```typescript
const response = await fetch('/api/notifications', {
  headers: { Authorization: `Bearer ${token}` }
});
const notifications = await response.json();

notifications.forEach(notif => {
  console.log(`[${notif.severity}] ${notif.title}: ${notif.message}`);
});
```

## Validation

Valid notification types (no change):
- `system`
- `processing`
- `usage`
- `update`
- `tip`
- `security`

Valid severity levels (new):
- `info` (default)
- `success`
- `warning`
- `error`

## Backward Compatibility

- Severity is optional and defaults to `'info'` if not provided
- Existing notifications without severity will work normally
- Old API calls without severity parameter will continue to work
- Database migration adds severity column with default value

## Testing Checklist

- [ ] Run database migration
- [ ] Create notification with severity='success'
- [ ] Create notification without severity (should default to 'info')
- [ ] Test admin endpoint with all severity levels
- [ ] Verify WebSocket push includes severity
- [ ] Check database records have correct severity values
- [ ] Test frontend displays different severities correctly

## Notes

- Type vs Severity: `type` categorizes the notification (what it's about), `severity` indicates urgency/importance (how it should look)
- Example: A processing notification can have success severity when complete, or error severity when failed
- Severity affects visual presentation only, not business logic
- All severity values are lowercase strings matching the enum
