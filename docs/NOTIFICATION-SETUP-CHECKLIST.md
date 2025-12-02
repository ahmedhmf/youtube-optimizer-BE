# Notification System - Setup Checklist

## ✅ Implementation Checklist

### Phase 1: Database Setup
- [ ] Open Supabase Dashboard
- [ ] Navigate to SQL Editor
- [ ] Copy contents of `migrations/002_create_notifications_table.sql`
- [ ] Execute the migration
- [ ] Verify table created: `SELECT * FROM notifications LIMIT 1;`
- [ ] Verify enum created: `SELECT enum_range(NULL::notification_type);`
- [ ] Test RLS policies by querying as a user

### Phase 2: Test API Endpoints
- [ ] Start the application: `npm run start:dev`
- [ ] Open Swagger UI: `http://localhost:3000/api`
- [ ] Locate "Notifications" section
- [ ] Test each endpoint:
  - [ ] `GET /notifications` - List notifications
  - [ ] `GET /notifications/unread-count` - Get count
  - [ ] `GET /notifications/stats` - Get statistics
  - [ ] `POST /notifications/:id/read` - Mark as read
  - [ ] `POST /notifications/bulk-read` - Mark multiple
  - [ ] `POST /notifications/read-all` - Mark all
  - [ ] `DELETE /notifications/:id` - Delete notification

### Phase 3: Integration Testing

#### Test Case 1: Video Processing Notifications
- [ ] Create a test notification manually:
```typescript
// In a controller or test file
await this.notificationService.notifyAnalysisStarted(
  'user-id',
  'video-123',
  'https://youtube.com/watch?v=test'
);
```
- [ ] Verify notification appears in database
- [ ] Verify notification appears in API response
- [ ] Mark as read and verify status changes

#### Test Case 2: System Notifications
- [ ] Send subscription expiring notification
- [ ] Send payment failed notification
- [ ] Send quota reached notification
- [ ] Verify all appear in correct category

#### Test Case 3: Security Notifications
- [ ] Trigger new device login notification
- [ ] Trigger password change notification
- [ ] Verify metadata includes correct information

### Phase 4: Integration with Existing Services

#### Audit Service Integration
- [ ] Open `src/audit/audit.module.ts`
- [ ] Add `NotificationModule` to imports
- [ ] Open `src/audit/database-queue.service.ts`
- [ ] Add `NotificationService` to constructor
- [ ] Add notification calls to `processYouTubeVideo()`:
  - [ ] At start: `notifyAnalysisStarted()`
  - [ ] On success: `notifyAnalysisCompleted()`
  - [ ] On error: `notifyProcessingFailed()`
- [ ] Test full flow:
  - [ ] Submit video analysis
  - [ ] Verify "analysis started" notification received
  - [ ] Wait for completion
  - [ ] Verify "analysis completed" notification received

#### Auth Service Integration (Optional)
- [ ] Open `src/auth/auth.module.ts`
- [ ] Add `NotificationModule` to imports
- [ ] Open `src/auth/auth.service.ts`
- [ ] Add `NotificationService` to constructor
- [ ] Add security notifications:
  - [ ] On login: Check if new device → `notifyNewDeviceLogin()`
  - [ ] On password change: `notifyPasswordChanged()`
- [ ] Test login from new device
- [ ] Test password change

#### Usage Monitoring (Optional)
- [ ] Choose where to implement (audit controller or separate service)
- [ ] Add usage check logic:
```typescript
const usage = await this.getUserUsageCount(userId);
const limit = await this.getUserLimit(userId);
const percentage = (usage / limit) * 100;

if (percentage >= 80) {
  await this.notificationService.notifyUsageThreshold(userId, 80);
}
```
- [ ] Test by creating videos until 80% limit reached
- [ ] Verify notification received

### Phase 5: Frontend Development

#### Backend Ready Checklist
- [ ] All API endpoints returning correct data
- [ ] Notifications created successfully
- [ ] Mark as read working
- [ ] Delete working
- [ ] Filters working (type, read status)
- [ ] Pagination working

#### Frontend Tasks
- [ ] Create notification center component
- [ ] Add unread badge to header/navbar
- [ ] Implement polling (every 30s for unread count)
- [ ] Display notifications with:
  - [ ] Title
  - [ ] Message
  - [ ] Timestamp (relative, e.g., "2 minutes ago")
  - [ ] Read/unread indicator
  - [ ] Category icon/color
- [ ] Add "Mark as read" on click
- [ ] Add "Mark all as read" button
- [ ] Add "Delete" option
- [ ] Implement filtering by category
- [ ] Add action URL navigation (if exists in metadata)
- [ ] Add empty state ("No notifications")

### Phase 6: Real-time Delivery (Optional - Future)
- [ ] Research WebSocket vs Server-Sent Events (SSE)
- [ ] Implement WebSocket gateway or SSE endpoint
- [ ] Send notification via WebSocket when created
- [ ] Update frontend to listen for real-time events
- [ ] Add toast/snackbar for instant notifications
- [ ] Test real-time delivery

### Phase 7: Maintenance Setup

#### Cleanup Cron Job
- [ ] Create or use existing cron service
- [ ] Add scheduled task:
```typescript
import { Cron, CronExpression } from '@nestjs/schedule';

@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
async cleanupOldNotifications() {
  const count = await this.notificationService.cleanupOldNotifications(30);
  this.logger.log(`Deleted ${count} old notifications`);
}
```
- [ ] Test manually: `await notificationService.cleanupOldNotifications(0);`
- [ ] Verify old read notifications are deleted

#### Monitoring
- [ ] Add metrics for notification creation rate
- [ ] Monitor unread notification count per user
- [ ] Track notification delivery success rate
- [ ] Set up alerts for errors

### Phase 8: Documentation & Training

#### Documentation
- [ ] Review `docs/notification-system.md`
- [ ] Review `docs/notification-quick-reference.md`
- [ ] Review `docs/NOTIFICATION-SYSTEM-SUMMARY.md`
- [ ] Add any project-specific notes

#### Team Training
- [ ] Share documentation with team
- [ ] Demo notification system features
- [ ] Walk through integration examples
- [ ] Explain when to use each notification type

## 🧪 Testing Scenarios

### Manual Testing Script

1. **Create Test User**
```bash
# Use your existing user or create one
USER_ID="your-user-id-here"
```

2. **Test Notification Creation**
```bash
# Using curl or Postman
curl -X POST http://localhost:3000/notifications/test \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id",
    "title": "Test Notification",
    "message": "This is a test",
    "type": "system"
  }'
```

3. **Test List Notifications**
```bash
curl -X GET "http://localhost:3000/notifications?limit=10" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

4. **Test Unread Count**
```bash
curl -X GET "http://localhost:3000/notifications/unread-count" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

5. **Test Mark as Read**
```bash
curl -X POST "http://localhost:3000/notifications/{notification-id}/read" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

6. **Test Statistics**
```bash
curl -X GET "http://localhost:3000/notifications/stats" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Integration Testing Script

```typescript
// test/notification-integration.e2e-spec.ts
describe('Notification Integration (e2e)', () => {
  it('should create notification when video analysis starts', async () => {
    // Submit video for analysis
    const response = await request(app.getHttpServer())
      .post('/audits/analyze')
      .set('Authorization', `Bearer ${token}`)
      .send({ url: 'https://youtube.com/watch?v=test' })
      .expect(201);

    // Wait a moment for notification to be created
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check notifications
    const notifications = await request(app.getHttpServer())
      .get('/notifications?type=processing')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(notifications.body.notifications).toContainEqual(
      expect.objectContaining({
        title: 'AI Analysis Started',
        type: 'processing',
        read: false
      })
    );
  });

  it('should notify when usage threshold reached', async () => {
    // Create videos until 80% limit
    // ... test logic ...
    
    // Check for usage notification
    const notifications = await request(app.getHttpServer())
      .get('/notifications?type=usage')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(notifications.body.notifications).toContainEqual(
      expect.objectContaining({
        title: '80% of Plan Limit Reached',
        type: 'usage'
      })
    );
  });
});
```

## 📊 Success Metrics

- [ ] Database migration completed without errors
- [ ] All 7 API endpoints working correctly
- [ ] Notifications created successfully from services
- [ ] Users can view their notifications
- [ ] Users can mark notifications as read
- [ ] Users can delete notifications
- [ ] Filters and pagination working
- [ ] RLS policies enforcing user isolation
- [ ] No performance issues with queries
- [ ] Cleanup job running successfully

## 🐛 Troubleshooting

### Issue: Notifications not appearing
- Check user ID matches between creation and retrieval
- Verify RLS policies are set correctly
- Check database logs for errors
- Verify user has active session

### Issue: Cannot mark as read
- Check user ID in request
- Verify notification belongs to user
- Check RLS policies allow UPDATE

### Issue: Slow queries
- Verify indexes are created
- Check query execution plan
- Consider adding more specific indexes
- Implement caching for frequently accessed data

### Issue: Notifications not created from services
- Verify NotificationModule imported in service module
- Check NotificationService injected in constructor
- Verify no errors in service logs
- Check database connection

## 📞 Support

If you encounter issues:
1. Check error logs in console
2. Review database logs in Supabase
3. Check Swagger UI for API documentation
4. Review documentation in `docs/` folder
5. Check integration examples in `src/notifications/examples/`

## 🎉 Completion

When all checkboxes are complete:
- [ ] Notification system fully functional
- [ ] Integrated with existing services
- [ ] Frontend notification center working
- [ ] Cleanup job scheduled
- [ ] Team trained and documentation shared
- [ ] Monitoring in place

**Congratulations! Your notification system is production-ready! 🚀**
