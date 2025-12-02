# Video Analysis API - Testing Guide

## Overview
Three endpoints for analyzing videos with AI:
1. **URL Analysis** - Fetch YouTube transcript and analyze
2. **Text Analysis** - Analyze provided transcript text
3. **File Analysis** - Transcribe audio/video file and analyze

All endpoints require JWT authentication.

---

## 1. Analyze Video by URL

### Endpoint
```
POST /ai/analyze/url
```

### Headers
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

### Request Body
```json
{
  "videoUrl": "https://www.youtube.com/watch?v=VIDEO_ID",
  "language": "en",
  "tone": "professional"
}
```

**Fields:**
- `videoUrl` (required): YouTube video URL
- `language` (optional): Target language for titles (default: "en")
- `tone` (optional): Title tone - "professional", "casual", "energetic", "serious" (default: "professional")

### Response (200 OK)
```json
{
  "success": true,
  "videoInfo": {
    "originalTitle": "Original Video Title",
    "videoId": "VIDEO_ID",
    "duration": "10:30"
  },
  "analysis": {
    "titleRewrite": {
      "titles": [
        "Optimized Title Option 1",
        "Optimized Title Option 2",
        "Optimized Title Option 3",
        "Optimized Title Option 4",
        "Optimized Title Option 5",
        "Optimized Title Option 6",
        "Optimized Title Option 7"
      ],
      "reasoning": "These titles emphasize the key benefits..."
    },
    "descriptionRewrite": {
      "description": "SEO-optimized video description...",
      "hashtags": ["#keyword1", "#keyword2", "#keyword3"],
      "keyPoints": ["Key point 1", "Key point 2", "Key point 3"]
    },
    "keywordExtraction": {
      "primaryKeywords": ["main", "keywords"],
      "longTailKeywords": ["specific longer phrases"],
      "trendingKeywords": ["currently trending terms"],
      "competitorKeywords": ["terms competitors use"]
    },
    "chapters": {
      "chapters": [
        {
          "timestamp": "0:00",
          "title": "Introduction",
          "description": "Overview of the topic"
        },
        {
          "timestamp": "2:30",
          "title": "Main Content",
          "description": "Detailed explanation"
        }
      ],
      "totalDuration": "10:30"
    }
  },
  "transcriptLength": 5420
}
```

### Error Responses

**404 - No Transcript Available**
```json
{
  "statusCode": 404,
  "message": "No transcript available for this video",
  "error": "Transcript Not Found",
  "details": "This video does not have captions/subtitles enabled or available."
}
```

**400 - Invalid URL**
```json
{
  "statusCode": 400,
  "message": "Must be a valid URL",
  "error": "Bad Request"
}
```

---

## 2. Analyze Video by Text

### Endpoint
```
POST /ai/analyze/text
```

### Headers
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

### Request Body
```json
{
  "transcript": "Full transcript text here... (100-100,000 characters)",
  "originalTitle": "Original Video Title",
  "language": "en",
  "tone": "professional"
}
```

**Fields:**
- `transcript` (required): Full transcript text (100-100,000 characters)
- `originalTitle` (optional): Original video title for context
- `language` (optional): Target language for titles (default: "en")
- `tone` (optional): Title tone (default: "professional")

### Response (200 OK)
```json
{
  "success": true,
  "analysis": {
    "titleRewrite": { ... },
    "descriptionRewrite": { ... },
    "keywordExtraction": { ... },
    "chapters": { ... }
  },
  "transcriptLength": 5420
}
```

### Error Responses

**400 - Invalid Transcript**
```json
{
  "statusCode": 400,
  "message": "Transcript must be at least 100 characters",
  "error": "Bad Request"
}
```

---

## 3. Analyze Video by File

### Endpoint
```
POST /ai/analyze/file
```

### Headers
```
Authorization: Bearer <your-jwt-token>
Content-Type: multipart/form-data
```

### Request Body (Form Data)
```
file: <audio/video file>
originalTitle: "Original Video Title" (optional)
language: "en" (optional)
tone: "professional" (optional)
```

**Fields:**
- `file` (required): Audio or video file to transcribe
  - Supported formats: mp3, wav, m4a, mp4, mov
  - Max size: Check your server configuration
- `originalTitle` (optional): Original video title for context
- `language` (optional): Target language for titles (default: "en")
- `tone` (optional): Title tone (default: "professional")

### Response (200 OK)
```json
{
  "success": true,
  "fileInfo": {
    "originalName": "my-video.mp4",
    "size": 15728640,
    "mimeType": "video/mp4"
  },
  "analysis": {
    "titleRewrite": { ... },
    "descriptionRewrite": { ... },
    "keywordExtraction": { ... },
    "chapters": { ... }
  },
  "transcriptLength": 5420
}
```

### Error Responses

**400 - No File**
```json
{
  "statusCode": 400,
  "message": "No file uploaded",
  "error": "File Required"
}
```

**400 - Invalid File Type**
```json
{
  "statusCode": 400,
  "message": "Invalid file type",
  "error": "File Type Not Supported",
  "details": "Supported types: audio (mp3, wav, m4a) and video (mp4, mov)"
}
```

---

## Testing with cURL

### Test URL Analysis
```bash
curl -X POST http://localhost:3000/ai/analyze/url \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "language": "en",
    "tone": "energetic"
  }'
```

### Test Text Analysis
```bash
curl -X POST http://localhost:3000/ai/analyze/text \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "transcript": "This is a sample transcript with enough text to pass validation. It needs to be at least 100 characters long to be processed by the AI analysis system.",
    "originalTitle": "My Video Title",
    "language": "en",
    "tone": "professional"
  }'
```

### Test File Analysis
```bash
curl -X POST http://localhost:3000/ai/analyze/file \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "file=@/path/to/your/video.mp4" \
  -F "originalTitle=My Video Title" \
  -F "language=en" \
  -F "tone=professional"
```

---

## Testing with Postman

1. **Get JWT Token First** (from your auth endpoint)
2. **Create New Request**
   - Method: POST
   - URL: `http://localhost:3000/ai/analyze/url`
3. **Set Headers**
   - Authorization: `Bearer YOUR_JWT_TOKEN`
   - Content-Type: `application/json` (for URL/text) or `multipart/form-data` (for file)
4. **Set Body**
   - For URL/Text: Select "raw" and "JSON"
   - For File: Select "form-data" and add file field

---

## Notes

### Performance
- URL analysis: ~10-15 seconds (includes transcript fetch + AI analysis)
- Text analysis: ~8-12 seconds (AI analysis only)
- File analysis: Depends on file size (transcription + AI analysis)

### Rate Limiting
- Protected by JWT authentication
- Consider implementing rate limiting for expensive operations

### Error Handling
- All endpoints return structured error messages
- Transcript availability is checked before processing
- File uploads are validated for type and size
- Temporary files are cleaned up automatically

### AI Analysis Includes
1. **7 Title Options** - With reasoning
2. **SEO Description** - With hashtags and key points
3. **Keyword Extraction** - Primary, long-tail, trending, competitor keywords
4. **Chapter Timestamps** - Auto-generated chapters with descriptions

### YouTube Transcript Limitations
- Video must have captions/subtitles enabled
- Auto-generated or manual captions are both supported
- Some videos may have transcripts disabled by the creator
- Private or restricted videos cannot be accessed
