# AI Preferences Integration

## Overview
This document describes the integration of user content preferences into the AI content generation system. Users can save their preferred tone, language, thumbnail style, and image style in their profile, which the AI system automatically uses when generating content.

## Architecture

### Preference Override Chain
The system implements a three-level fallback chain for each preference:

1. **Method Parameters** (Highest Priority)
   - Explicit parameters passed to AI service methods
   - Used when user wants to temporarily override their saved preferences
   - Example: `languageOverride`, `toneOverride`, `thumbnailStyleOverride`, `imageStyleOverride`

2. **Saved User Preferences** (Medium Priority)
   - Preferences stored in `user_content_preferences` table
   - Retrieved from database at runtime
   - Automatically applied if no override parameters provided

3. **System Defaults** (Lowest Priority)
   - Fallback values when user has no saved preferences
   - Defaults: `language='en'`, `tone='professional'`
   - Triggers notification to complete preferences setup

### Notification System
When the system uses default values because user preferences are incomplete:
- Sends real-time WebSocket notification to user
- Notification includes:
  - **Severity**: `INFO`
  - **Title**: "Setup Content Preferences"
  - **Message**: Context-specific explanation
  - **Action**: Link to `/settings/content-preferences` with "Setup Now" button

## Modified Files

### 1. AI Service (`src/ai/ai.service.ts`)

#### Constructor Updates
```typescript
constructor(
  private readonly systemLogService: SystemLogService,
  private readonly userPreferencesService: UserPreferencesService,
  private readonly notificationService: NotificationService,
) {
  this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}
```

#### Method Signature Changes

**Before:**
```typescript
async generateTitleRewrite(
  transcript: string,
  language: string,
  tone: string,
  originalTitle: string,
): Promise<TitleRewriteResult>
```

**After:**
```typescript
async generateTitleRewrite(
  userId: string,
  transcript: string,
  originalTitle: string,
  languageOverride?: string,
  toneOverride?: string,
): Promise<TitleRewriteResult>
```

#### Implementation Pattern
```typescript
// 1. Fetch user preferences
const preferences = await this.userPreferencesService.getPreferences(userId);

// 2. Apply fallback chain
const language = languageOverride ?? preferences?.language ?? 'en';
const tone = toneOverride ?? preferences?.tone ?? 'professional';

// 3. Send notification if using defaults
if (!preferences?.isCompleted && !languageOverride && !toneOverride) {
  await this.notificationService.sendNotification(
    userId,
    'Setup Content Preferences',
    'Using default settings. Setup your preferences for personalized content.',
    NotificationType.SYSTEM,
    {},
    NotificationSeverity.INFO,
    '/settings/content-preferences',
    'Setup Now',
  );
}

// 4. Generate content with resolved preferences
const prompt = PromptsService.getTitleRewritePrompt(transcript, language, tone, originalTitle);
```

#### Updated Methods

1. **generateTitleRewrite**
   - Parameters: `userId`, `transcript`, `originalTitle`, `languageOverride?`, `toneOverride?`
   - Preferences: `language`, `tone`

2. **generateDescriptionRewrite**
   - Parameters: `userId`, `transcript`, `languageOverride?`
   - Preferences: `language`

3. **generateThumbnailIdeas**
   - Parameters: `userId`, `transcript`, `thumbnailStyleOverride?`
   - Preferences: `thumbnailStyle`

4. **generateThumbnailAIPrompts**
   - Parameters: `userId`, `transcript`, `imageStyleOverride?`
   - Preferences: `imageStyle`

5. **analyzeVideoComplete**
   - Parameters: `userId`, `transcript`, `languageOverride?`, `thumbnailStyleOverride?`, `imageStyleOverride?`
   - Combines all analyses with user preferences

### 2. AI Module (`src/ai/ai.module.ts`)

Added imports:
```typescript
@Module({
  imports: [
    YoutubeModule,
    LoggingModule,
    UserPreferencesModule,  // NEW
    NotificationModule,     // NEW
  ],
  providers: [AiService, PromptsService],
  exports: [AiService],
})
```

### 3. AI Controller (`src/ai/ai.controller.ts`)

#### Imports Added
```typescript
import { Req, Query } from '@nestjs/common';
```

#### Method Updates

**POST /ai/analyze/url**
```typescript
async analyzeVideoByUrl(
  @Req() req: any,
  @Body() dto: AnalyzeVideoByUrlDto,
  @Query('languageOverride') languageOverride?: string,
  @Query('toneOverride') toneOverride?: string,
): Promise<AnalyzeVideoResponseDto>
```

**POST /ai/analyze/text**
```typescript
async analyzeVideoByText(
  @Req() req: any,
  @Body() dto: AnalyzeVideoByTextDto,
  @Query('languageOverride') languageOverride?: string,
  @Query('toneOverride') toneOverride?: string,
): Promise<AnalyzeVideoResponseDto>
```

**POST /ai/analyze/file**
```typescript
async analyzeVideoByFile(
  @Req() req: any,
  @UploadedFile() file: Express.Multer.File,
  @Body() dto: AnalyzeVideoByFileDto,
): Promise<AnalyzeVideoResponseDto>
```

All methods now:
1. Extract `userId` from authenticated request: `const userId = req.user.id`
2. Pass `userId` as first parameter to AI service methods
3. Accept optional query parameters for preference overrides
4. Merge query parameters with DTO values (query params take precedence)

### 4. Prompts Service (`src/ai/prompts.service.ts`)

Updated static methods to accept all preference parameters including custom instructions:

```typescript
static getTitleRewritePrompt(
  transcript: string,
  language: string,
  tone: string,
  originalTitle: string,
  customInstructions?: string,
): string

static getDescriptionRewritePrompt(
  transcript: string,
  language?: string,
  tone?: string,
  customInstructions?: string,
): string

static getThumbnailIdeaPrompt(
  transcript: string,
  thumbnailStyle?: string,
  customInstructions?: string,
): string

static getThumbnailAIPrompt(
  transcript: string,
  imageStyle?: string,
  customInstructions?: string,
): string
```

**Enhanced Prompt Customization:**
- Each method now accepts `customInstructions` parameter
- Custom instructions are injected into prompts as special sections
- Tone parameter added to description prompts for consistent voice
- Style requirements are more detailed and specific
- All user preferences are fully utilized in content generation

## API Usage Examples

### Using Saved Preferences
```bash
# User has preferences: { language: 'es', tone: 'casual' }
POST /ai/analyze/url
Authorization: Bearer <jwt_token>
{
  "videoUrl": "https://youtube.com/watch?v=..."
}
# Result: Uses Spanish language and casual tone from saved preferences
```

### Overriding Preferences
```bash
# Override saved preferences for this request only
POST /ai/analyze/url?languageOverride=fr&toneOverride=formal
Authorization: Bearer <jwt_token>
{
  "videoUrl": "https://youtube.com/watch?v=..."
}
# Result: Uses French language and formal tone, ignoring saved preferences
```

### First-Time User (No Preferences)
```bash
# User has no saved preferences
POST /ai/analyze/url
Authorization: Bearer <jwt_token>
{
  "videoUrl": "https://youtube.com/watch?v=..."
}
# Result: 
# 1. Uses defaults (language='en', tone='professional')
# 2. Sends WebSocket notification: "Setup Content Preferences"
```

### DTO Fallback
```bash
# No overrides, no saved preferences, but DTO has values
POST /ai/analyze/url
Authorization: Bearer <jwt_token>
{
  "videoUrl": "https://youtube.com/watch?v=...",
  "language": "de",
  "tone": "enthusiastic"
}
# Result: Uses DTO values (language='de', tone='enthusiastic')
```

## Testing

### Unit Tests
Test file updated: `src/ai/ai.service.spec.ts`

Added mocks:
```typescript
{
  provide: 'UserPreferencesService',
  useValue: {
    getPreferences: jest.fn().mockResolvedValue({
      tone: 'professional',
      language: 'en',
      thumbnailStyle: 'modern',
      imageStyle: 'realistic',
      isCompleted: true,
    }),
    hasCompletedPreferences: jest.fn().mockResolvedValue(true),
  },
},
{
  provide: 'NotificationService',
  useValue: {
    sendNotification: jest.fn().mockResolvedValue(undefined),
  },
}
```

### Integration Testing Scenarios

1. **User with Complete Preferences**
   - Setup: Create user preferences with all fields
   - Test: Call AI endpoint without overrides
   - Expected: Uses saved preferences, no notification sent

2. **User with Incomplete Preferences**
   - Setup: Create user preferences with missing fields
   - Test: Call AI endpoint
   - Expected: Uses defaults for missing fields, sends notification

3. **Parameter Override**
   - Setup: User with saved preferences
   - Test: Call AI endpoint with override query parameters
   - Expected: Uses override parameters, ignores saved preferences

4. **First-Time User**
   - Setup: User without any preferences
   - Test: Call AI endpoint
   - Expected: Uses all defaults, sends notification

5. **WebSocket Notification Delivery**
   - Setup: User connected via WebSocket
   - Test: Trigger AI generation with missing preferences
   - Expected: User receives real-time notification with action button

## Database Schema

User preferences are stored in `user_content_preferences` table:

```sql
CREATE TABLE user_content_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tone TEXT,                    -- e.g., 'professional', 'casual', 'enthusiastic', 'friendly'
  thumbnail_style TEXT,         -- e.g., 'modern', 'minimalist', 'bold', 'elegant'
  image_style TEXT,             -- e.g., 'photorealistic', 'illustration', '3D render', 'anime'
  language TEXT,                -- e.g., 'en', 'es', 'fr', 'de', 'ar'
  custom_instructions TEXT,     -- Free-form user instructions for personalization
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);
```

### Preference Fields Usage

| Field | Used In | Impact | Example |
|-------|---------|--------|---------|
| `tone` | Titles, Descriptions | Sets the writing style and voice | "professional", "casual", "enthusiastic" |
| `thumbnailStyle` | Thumbnail Ideas | Influences visual concepts and composition | "modern", "minimalist", "bold", "colorful" |
| `imageStyle` | AI Image Prompts | Specifies art style for AI generators | "photorealistic", "illustration", "3D render" |
| `language` | Titles, Descriptions | Generates content in specified language | "en", "es", "fr", "de", "ar", "ja" |
| `customInstructions` | All prompts | Custom user requirements and preferences | "Always mention my brand name", "Avoid certain keywords" |

## Benefits

### User Experience
- **Personalization**: Content generated in user's preferred style automatically
- **Flexibility**: Can override preferences on a per-request basis
- **Discoverability**: Notifications guide users to setup preferences

### Developer Experience
- **Consistent Pattern**: All AI methods follow same fallback chain
- **Type Safety**: TypeScript interfaces for all preferences
- **Testability**: Easy to mock preferences in tests

### System Design
- **Separation of Concerns**: Preferences managed separately from AI logic
- **Scalability**: Database-backed preferences, no code changes for new users
- **Extensibility**: Easy to add new preference fields

## Future Enhancements

1. **Preference Presets**: Pre-defined preference combinations (e.g., "YouTube Gaming", "Educational Content")
2. **A/B Testing**: Track which preferences generate better content performance
3. **Machine Learning**: Learn optimal preferences from user's content history
4. **Preference History**: Track how preferences change over time
5. **Team Preferences**: Share preferences across team members
6. **Preference Export/Import**: Allow users to backup and restore preferences
