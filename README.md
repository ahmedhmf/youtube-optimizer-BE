# YouTube Optimizer - Backend API

A powerful NestJS backend service that provides AI-powered YouTube video optimization suggestions. This API works in conjunction with an Angular frontend to help content creators improve their video titles, descriptions, tags, and thumbnails using advanced AI analysis.

## 🚀 Features

- **AI-Powered Suggestions**: Generate optimized titles, descriptions, and tags using OpenAI/Groq
- **YouTube Integration**: Fetch video metadata using YouTube Data API
- **User Authentication**: Secure authentication via Supabase
- **Usage Tracking**: Monitor user audit counts and enforce limits
- **Audit History**: Store and retrieve user's optimization history
- **Rate Limiting**: Built-in protection against API abuse

## 🏗️ Architecture

```
Angular Frontend ←→ NestJS API ←→ External Services
                                  ├── YouTube Data API
                                  ├── OpenAI/Groq AI
                                  └── Supabase (Database & Auth)
```

## 📋 Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- Supabase account and project
- YouTube Data API key
- OpenAI API key or Groq API key

## 🔧 Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd youtube-optimizer-BE
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url
   SUPABASE_KEY=your_supabase_anon_key

   # YouTube Data API
   YOUTUBE_API_KEY=your_youtube_api_key

   # AI Service (choose one)
   OPENAI_API_KEY=your_openai_api_key
   # OR
   GROQ_API_KEY=your_groq_api_key

   # Server Configuration
   PORT=3000
   ```

4. **Database Setup**
   Run the SQL script in your Supabase SQL Editor:
   ```bash
   # Copy the contents of database-setup.sql and run in Supabase
   ```

## 🗄️ Database Schema

The application uses the following main tables in Supabase:

- **audits**: Stores video analysis results
- **usage_events**: Tracks user API usage
- **profiles**: User profile information (handled by Supabase Auth)

## 🚀 Running the Application

### Development Mode
```bash
npm run start:dev
```

### Production Mode
```bash
npm run build
npm run start:prod
```

### Testing
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## 📚 API Documentation

### Authentication
All protected endpoints require a Bearer token from Supabase authentication.

```http
Authorization: Bearer <supabase_jwt_token>
```

### Monitoring & Observability

#### **GET** `/metrics`
Prometheus metrics endpoint for monitoring application performance.

**Features:**
- System metrics (CPU, memory, event loop)
- HTTP request metrics (count, duration, status codes)
- Database query performance
- AI service request tracking
- Authentication events
- Error tracking
- Cache hit/miss ratios

See [Metrics Documentation](docs/metrics.md) for detailed information.

**Quick Setup:**
```bash
# Start Prometheus
docker run -d -p 9090:9090 -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml prom/prometheus

# Start Grafana
docker run -d -p 3001:3000 grafana/grafana
```

#### **GET** `/health`
Comprehensive health check endpoint with service status.

### Endpoints

#### **POST** `/analyze/video`
Analyze a YouTube video and generate AI suggestions.

**Request:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "user_uuid",
  "video_url": "youtube_url",
  "video_title": "Original Video Title",
  "ai_titles": ["Suggested Title 1", "Suggested Title 2", "Suggested Title 3"],
  "ai_description": "AI-generated optimized description",
  "ai_tags": ["tag1", "tag2", "tag3"],
  "created_at": "2024-01-01T00:00:00Z"
}
```

#### **GET** `/analyze/history`
Retrieve user's audit history.

**Response:**
```json
[
  {
    "id": "uuid",
    "video_title": "Video Title",
    "ai_titles": ["Title 1", "Title 2", "Title 3"],
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

#### **GET** `/youtube/video`
Fetch YouTube video metadata.

**Query Parameters:**
- `url`: YouTube video URL

**Response:**
```json
{
  "id": "video_id",
  "title": "Video Title",
  "description": "Video Description",
  "tags": ["tag1", "tag2"],
  "thumbnail": "thumbnail_url",
  "publishedAt": "2024-01-01T00:00:00Z",
  "duration": "PT4M13S",
  "views": 12345,
  "likes": 567,
  "comments": 89
}
```

## 🔧 Configuration

### AI Service Configuration
The application is configured to use Groq (via OpenRouter) by default. You can modify the AI service in [`src/ai/ai.service.ts`](src/ai/ai.service.ts):

```typescript
this.openai = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1',
});
```

### CORS Configuration
The API is configured to accept requests from `http://localhost:4200` (Angular dev server). Update this in [`src/main.ts`](src/main.ts) for production:

```typescript
app.enableCors({
  origin: 'http://localhost:4200', // Update for production
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
});
```

## 📁 Project Structure

```
src/
├── ai/                 # AI service for generating suggestions
├── audit/             # Audit management and history
├── common/            # Shared utilities and guards
├── database/          # Database setup service
├── supabase/          # Supabase client configuration
├── youtube/           # YouTube API integration
├── app.module.ts      # Main application module
└── main.ts           # Application bootstrap
```

## 🧪 Testing

The project includes comprehensive testing setup:

- **Unit Tests**: Test individual services and controllers
- **E2E Tests**: Test complete API workflows
- **Coverage Reports**: Track test coverage

Example test commands:
```bash
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:cov
```

## 🔒 Security Features

- **JWT Authentication**: Via Supabase Auth Guard
- **Rate Limiting**: Built-in usage tracking
- **Input Validation**: URL validation for YouTube videos
- **Error Handling**: Comprehensive error responses

## 🚀 Deployment

### Environment Variables for Production
```env
NODE_ENV=production
SUPABASE_URL=your_production_supabase_url
SUPABASE_KEY=your_production_supabase_key
YOUTUBE_API_KEY=your_youtube_api_key
GROQ_API_KEY=your_groq_api_key
PORT=3000
```

### Build for Production
```bash
npm run build
npm run start:prod
```

## 🤝 Frontend Integration

This backend is designed to work with an Angular frontend. The frontend should:

1. Handle Supabase authentication
2. Pass JWT tokens in request headers
3. Make HTTP requests to the API endpoints
4. Display AI suggestions to users

Expected frontend structure:
```
Angular Frontend/
├── Authentication Service (Supabase)
├── HTTP Interceptor (JWT tokens)
├── Video Analysis Component
├── History Component
└── API Service (HTTP client)
```

## 📝 Usage Limits

- **Free Tier**: 100 audits per user
- **Upgrade Path**: Configurable limits for paid plans

## 🐛 Troubleshooting

### Common Issues

1. **Database Connection Issues**
   - Verify Supabase credentials
   - Run database setup SQL
   - Check table permissions

2. **YouTube API Errors**
   - Verify API key validity
   - Check quota limits
   - Ensure video is public

3. **AI Service Errors**
   - Verify API key
   - Check rate limits
   - Monitor response format

## 📄 License

This project is licensed under the UNLICENSED license.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For support and questions, please refer to the project documentation or create an issue in the repository.