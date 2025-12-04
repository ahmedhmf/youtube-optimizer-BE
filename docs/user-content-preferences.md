# User Content Preferences System

## Overview
Created a user content preferences system that stores user's style choices for AI content generation. System automatically notifies users on login if they haven't completed their preferences setup.

## Features

### Preference Fields
- **tone**: User's preferred tone (e.g., casual, professional, enthusiastic)
- **thumbnail_style**: Preferred thumbnail design style  
- **image_style**: AI image generation style preferences
- **language**: Preferred language for content
- **custom_instructions**: Additional custom instructions for AI

### Auto-Notification on Login
- Checks if user has completed preferences on every login
- Sends notification if incomplete with direct link to setup page
- Non-blocking - login succeeds even if notification fails

## Database Setup

**Run Migration:**
```bash
# In Supabase SQL Editor
scripts/create-user-content-preferences.sql
```

**Table Structure:**
```sql
user_content_preferences (
  id uuid PRIMARY KEY,
  user_id uuid UNIQUE,
  tone TEXT,
  thumbnail_style TEXT,
  image_style TEXT,
  language TEXT,
  custom_instructions TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## API Endpoints

### Get User Preferences
```http
GET /api/v1/user-preferences
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "userId": "uuid",
  "tone": "professional",
  "thumbnailStyle": "bold",
  "imageStyle": "realistic",
  "language": "en",
  "customInstructions": "Always include CTA",
  "isCompleted": true,
  "createdAt": "2024-12-03T...",
  "updatedAt": "2024-12-03T..."
}
```

### Create/Update Preferences
```http
POST /api/v1/user-preferences
PUT /api/v1/user-preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "tone": "professional",
  "thumbnailStyle": "bold",
  "imageStyle": "realistic",
  "language": "en",
  "customInstructions": "Always include CTAs"
}
```

## Frontend Integration

### Fetch Preferences on Load
```typescript
async function loadUserPreferences() {
  const response = await fetch('/api/v1/user-preferences', {
    headers: { Authorization: `Bearer ${token}` }
  });
  
  if (response.ok) {
    const preferences = await response.json();
    return preferences;
  }
  return null;
}
```

### Save Preferences
```typescript
async function savePreferences(preferences) {
  const response = await fetch('/api/v1/user-preferences', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(preferences)
  });
  
  return response.json();
}
```

### Handle Login Notification
```typescript
// Listen for preferences notification on login
socket.on('notification', (notification) => {
  if (notification.actionUrl === '/settings/content-preferences') {
    // Show prominent banner or modal
    showPreferencesSetupPrompt({
      title: notification.title,
      message: notification.message,
      actionUrl: notification.actionUrl,
      actionButtonText: notification.actionButtonText
    });
  }
});
```

## Usage in AI Generation

When generating content, fetch user preferences and include in AI prompt:

```typescript
const preferences = await userPreferencesService.getPreferences(userId);

const aiPrompt = `
  Generate YouTube content with these preferences:
  - Tone: ${preferences.tone || 'neutral'}
  - Language: ${preferences.language || 'en'}
  - Thumbnail Style: ${preferences.thumbnailStyle || 'standard'}
  - Image Style: ${preferences.imageStyle || 'default'}
  
  Additional instructions: ${preferences.customInstructions || 'None'}
  
  [Your content generation prompt here]
`;
```

## Login Flow

1. User logs in via `/api/v1/auth/login`
2. Auth service validates credentials
3. **NEW:** Checks if `user_content_preferences.is_completed === false`
4. **NEW:** If incomplete, sends notification via WebSocket
5. Returns auth tokens and user data
6. Frontend receives notification and shows setup prompt

## Notification Details

**Sent when:** User logs in with incomplete preferences

**Notification:**
- **Type:** `system`
- **Severity:** `info`
- **Title:** "Complete Your Content Preferences"
- **Message:** "Set up your content style preferences to get personalized AI-generated content that matches your brand."
- **Action URL:** `/settings/content-preferences`
- **Button Text:** "Complete Setup"

## Completion Logic

Preferences are marked `is_completed = true` when:
- At least ONE of these fields is filled: `tone`, `thumbnailStyle`, `imageStyle`, or `language`
- Updates automatically on POST/PUT

## Files Created/Modified

**New Files:**
- `scripts/create-user-content-preferences.sql` - Database migration
- `src/user-preferences/types/user-content-preferences.types.ts` - Type definitions
- `src/user-preferences/user-preferences.service.ts` - Business logic
- `src/user-preferences/user-preferences.controller.ts` - API endpoints
- `src/user-preferences/user-preferences.module.ts` - Module config

**Modified Files:**
- `src/app.module.ts` - Added UserPreferencesModule
- `src/auth/auth.module.ts` - Imported UserPreferencesModule & NotificationModule
- `src/auth/auth.service.ts` - Added preferences check on login

## Testing

1. **Run migration** in Supabase
2. **Login** as existing user
3. **Check WebSocket** for notification (if preferences incomplete)
4. **Navigate to** `/settings/content-preferences`
5. **Fill out form** and save
6. **Logout and login** again - should NOT receive notification
7. **Verify API:**
   ```bash
   curl -H "Authorization: Bearer <token>" \
     http://localhost:3000/api/v1/user-preferences
   ```

## Security

- ✅ RLS enabled on `user_content_preferences` table
- ✅ Users can only view/edit their own preferences
- ✅ Service role can manage all records (for admin operations)
- ✅ JWT authentication required for all endpoints
- ✅ Preferences tied to auth.users via user_id FK

## Next Steps

1. Create frontend preference setup page at `/settings/content-preferences`
2. Design UI with form fields for each preference
3. Test notification display on login
4. Integrate preferences into AI content generation pipelines
5. Add analytics to track preference completion rate
