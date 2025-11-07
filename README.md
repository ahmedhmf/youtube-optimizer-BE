High-Level System

Client (Angular) → API (NestJS) → AI Providers + YouTube API + Supabase (DB/Auth/Storage) + Stripe (billing)

[Angular SPA]
   │ HTTPS (JWT from Supabase)
   ▼
[NestJS API Gateway]
   ├─ Auth (Supabase JWT verify)
   ├─ YouTube Ingestion Service
   ├─ AI Orchestrator (titles/descriptions/shorts/thumbnail-prompts)
   ├─ Channel Auditor (Top-10 Fixes scorer)
   ├─ Billing Webhooks (Stripe)
   └─ Usage & Rate Limits
   │
   ▼
[Supabase: Postgres + RLS]
   ├─ users / profiles
   ├─ channels / videos
   ├─ audits / suggestions
   ├─ brand_profiles
   ├─ usage_events
   └─ subscriptions (Stripe ids)

Core User Flows (MVP)

Auth: Sign in → Supabase Auth (email/password or Google). Angular stores Supabase session; passes JWT to Nest for every call.

Analyze single video: Paste URL → Nest fetches metadata via YouTube Data API → AI Orchestrator generates 3 titles, 1 description rewrite, tags, thumbnail prompts, Shorts pack if applicable → store in audits/suggestions → return to client.

Top-10 Fixes: Paste Channel URL → Nest pulls latest N videos (public stats) → ranks by “improvement potential” → batch-generate suggestions on click.

Billing: Free plan (5 audits). Stripe checkout for €9/mo Creator; webhooks update subscriptions. RLS enforces plan limits.

Frontend (Angular)

Libraries: Angular + Angular Material + Supabase JS + Stripe Checkout

Routes:

/ Landing (pricing, CTA)

/app Dashboard (list of videos, audits)

/analyze?url=<youtube> Analyze screen (results with copy buttons & export)

/channel?url=<channel> Channel audit (Top-10 Fixes)

/settings/brand Brand profile (tone, banned words, language)

/billing Subscription management

State: NgRx or simple signals; start simple with services.

UX Key: one text field + single “Analyze” button → results in <10s.

Backend (NestJS)

Modules

AuthModule — verifies Supabase JWT via JWKS; attaches user id.

YoutubeModule — Data API client; fetch video/channel meta.

AIModule — provider-agnostic orchestrator; prompt templates + safety.

AuditModule — persists audits/suggestions; scoring engine.

BillingModule — Stripe checkout sessions & webhooks.

UsageModule — limits (free vs paid), per-user quotas.

BrandModule — loads tone/language rules.

Key Services

VideoIngestionService:

fetchVideo(url|id): title, description, tags, duration, views, CTR proxy (if available), publish date, thumbnail URL.

AiSuggestionService:

generateTitles(context, brandProfile): string[3]

rewriteDescription(context, brandProfile): string

suggestTags(context, locale): string[]

thumbnailPrompts(context): string[3] (prompt = composition, subject, text/no text, style)

shortsPack(context): {hook, title, description, hashtags}

RankingService (Top-10 Fixes):

Score = f(views_last_28d, age, current_title_quality heuristics, competition) → sort desc.

BillingService:

createCheckoutSession(userId, priceId)

Webhooks: invoice.paid, customer.subscription.updated, checkout.session.completed

UsageService:

Track AUDIT_CREATED; enforce 5 free/mo; unlimited for paid.

Endpoint Sketch

POST /api/analyze/video { url } → returns suggestions set

POST /api/analyze/channel { channelUrl, limit } → returns ranked list

POST /api/checkout/session → Stripe URL

GET /api/me/usage → remaining quota

GET /api/me/subscription → status

POST /api/brand (upsert) → tone rules

POST /api/webhooks/stripe (raw body)

Data Model (Supabase / Postgres)

profiles(id uuid pk, email, created_at)

brand_profiles(id uuid pk, user_id fk, tone text, banned_words text[], persona jsonb, language text)

channels(id pk, user_id fk, platform text, external_id, title)

videos(id pk, channel_id fk, external_id, title, duration_s, views, published_at, is_shorts bool)

audits(id pk, user_id fk, video_id fk, score numeric, created_at)

suggestions(id pk, audit_id fk, type text, content jsonb)

types: title_set, description, tags, thumbnail_prompts, shorts_pack

subscriptions(user_id pk, stripe_customer_id, stripe_subscription_id, plan text, status text, current_period_end timestamptz)

usage_events(id pk, user_id fk, type text, meta jsonb, created_at)

RLS highlights

profiles, brand_profiles, audits, suggestions, usage_events row-level policies on user_id = auth.uid()

videos/channels scoped to owner.

Prompt Templates (MVP)

Titles (3x)
“You are a YouTube title specialist. Output 3 different titles (max 60 chars) that maximize curiosity without clickbait. Keep the creator’s tone: {brand.tone}. Avoid words: {brand.banned_words}. Video topic/keywords: {context.keywords}. Audience: {locale}. Return JSON array of strings.”

Description rewrite
“Rewrite the description to improve SEO and watch-time. Keep links. Add 3 keyword-rich lines at top, 5 bullet highlights, and a CTA. Language: {locale}. Output markdown.”

Tags
“Return 15 YouTube tags (no hashtags). Prioritize long-tail. Language: {locale}. JSON array.”

Thumbnail prompts (3x)
“Return 3 concise image prompts for an eye-catching YouTube thumbnail: subject, expression, setting, composition (rule of thirds), 3–5 words of on-image text (optional), avoid clutter. No logos. JSON list.”

Shorts pack
“If video is <60s, create a Shorts optimization pack: 1 hook (≤80 chars), 1 title (≤60), 1 description (≤120), 10 hashtags. Language: {locale}. JSON.”

Scoring: “Top-10 Fixes”

Heuristic to start (deterministic, cheap):

score =  w1 * log(views_last_28d + 1)
       + w2 * freshness_boost(published_at)
       + w3 * title_gap_estimate(current_title)
       + w4 * shorts_bonus(is_shorts)


title_gap_estimate: penalize ≥70 chars, passive voice, no number/benefit verb.

Tune weights by early data; persist score in audits.score.

Quotas & Plans

Free: 5 audits/month (tracked in usage_events)

Creator (€9/mo): unlimited audits; enable channel batch up to 50 videos

One-time (€29): generate “Quick Fix Pack” for selected 10 videos (CSV/ZIP export)

Deployment (fast + cheap)

Frontend: Vercel (Angular SSR optional later)

API: Fly.io / Railway / Render (Node 20), env secrets

DB/Auth/Storage: Supabase (Starter)

Stripe: Checkout + Customer Portal

AI: OpenAI GPT-4o (fallback: Anthropic for titles), no queue first week

Observability & Security

Logs & Tracing: pino logs + Logtail/Datadog (free tier ok)

Rate limiting: Nest middleware (per IP + per user), simple Redis optional (can start in-memory)

Secrets: .env only on server; never store YouTube OAuth tokens in MVP (use public Data API where possible)

Webhooks: Stripe endpoint with raw body; verify signature

Environment Variables (server)
SUPABASE_URL=
SUPABASE_JWT_SECRET=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
OPENAI_API_KEY=
YOUTUBE_API_KEY=
APP_BASE_URL=https://app.yourdomain.com