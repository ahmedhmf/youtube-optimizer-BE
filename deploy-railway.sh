# Railway deployment script
echo "🚀 Deploying YouTube Optimizer to Railway..."

# Install Railway CLI if not present
if ! command -v railway &> /dev/null; then
    echo "📦 Installing Railway CLI..."
    npm install -g @railway/cli
fi

# Login to Railway
echo "🔐 Please login to Railway..."
railway login

# Create new project
echo "🏗️ Creating Railway project..."
railway init

echo "⚙️ Setting environment variables..."
echo "Please set the following variables in Railway dashboard:"
echo "1. NODE_ENV=production"
echo "2. SUPABASE_URL=your-supabase-url"
echo "3. SUPABASE_ANON_KEY=your-supabase-anon-key"
echo "4. SUPABASE_SERVICE_KEY=your-supabase-service-key"
echo "5. JWT_SECRET=your-jwt-secret"
echo "6. YOUTUBE_API_KEY=your-youtube-api-key"
echo "7. OPENAI_API_KEY=your-openai-api-key"

read -p "Press Enter after setting environment variables in Railway dashboard..."

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

echo "✅ Deployment complete!"
echo "📊 Check your Railway dashboard for deployment status"
echo "🌐 Your API will be available at the Railway provided URL"