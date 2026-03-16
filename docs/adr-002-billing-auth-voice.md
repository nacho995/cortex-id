# ADR-002: Billing, Authentication & Voice Systems

## Status: Planned for v0.3

## Context

Cortex-ID v0.1-v0.2 runs fully local with BYOK (Bring Your Own Key). For v0.3, we need:
1. User authentication (Google/GitHub OAuth)
2. Credit-based billing with Stripe
3. Voice-to-code with Web Speech API + Whisper

These require a cloud backend and cannot run purely local.

## Decision: Phased Implementation

### Phase 1: Auth (v0.3)
- **Google OAuth** via Spring Security OAuth2 Client
- **GitHub OAuth** via Spring Security OAuth2 Client
- **JWT tokens** for session management
- **PostgreSQL** on Fly.io for user data (separate from local SQLite)
- **Welcome credits**: 500 free credits on registration

### Phase 2: Billing (v0.3)
- **Stripe Checkout** for credit purchases
- **Credit packs**: Starter(1K/1€), Basic(5.5K/5€), Pro(12K/10€), Power(30K/20€)
- **Per-model pricing**: Haiku=2cr/1K tokens, Sonnet=5, Opus=20, GPT-4o=8
- **Free tier**: 5 messages/day per IP without account
- **Webhook**: Stripe → add credits → notify frontend via WebSocket

### Phase 3: Voice (v0.4)
- **Web Speech API** for browser-based speech recognition
- **Whisper API** fallback for better accuracy
- **Text-to-Speech** for AI responses
- **Voice commands**: "open file", "run tests", "explain this"

## Architecture

```
User → Angular → Electron/Browser
         ↓ JWT
    Cloud Backend (Fly.io)
    ├── Auth Service (OAuth2)
    ├── Credit Service (PostgreSQL)
    └── Stripe Webhook
         ↓ WebSocket
    Local Backend (port 7432)
    ├── AI Orchestration (with credit check)
    └── File/Git/Memory services
```

## New Entities
- `User` (id, email, name, avatar, provider, credits, created_at)
- `CreditTransaction` (id, user_id, amount, type, model, stripe_id)
- `DailyFreeUsage` (ip, messages_used, date)

## API Endpoints
- `GET /auth/google` → OAuth redirect
- `GET /auth/github` → OAuth redirect
- `POST /credits/checkout` → Stripe session URL
- `POST /credits/webhook` → Stripe webhook
- `GET /api/me` → Current user + credits

## Security
- API keys stored in OS keychain (Electron) or encrypted in DB (cloud)
- JWT with 24h expiry, refresh tokens
- Stripe webhook signature verification
- HTTPS only in production

## Consequences
- Requires Fly.io deployment for cloud backend
- PostgreSQL instance ($7/month minimum)
- Stripe account and webhook configuration
- OAuth app registration with Google and GitHub
- Local-only mode must continue working without cloud
