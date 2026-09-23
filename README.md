# MindPath v2 — Foundation

MindPath is a private personal Telegram AI assistant rebuilt as a modular application.

## Foundation features

- Telegram webhook
- Owner-only private interaction
- Persistent D1 conversation history
- Gemini adapter
- Image input
- Configurable channel URL monitoring
- Telegram URL filtering
- Duplicate event protection
- Health endpoint
- Explicit Google Drive integration boundary
- Environment-based secrets
- Provider-oriented architecture

## Architecture

```text
Telegram
   ↓
Webhook
   ↓
Owner verification
   ↓
MindPath core
   ↓
AI provider
   ↓
D1 conversation storage
   ↓
Telegram
```

Channel monitoring:

```text
Configured channel
   ↓
channel_post
   ↓
deterministic URL detection
   ↓
ignore Telegram URLs
   ↓
external URL
   ↓
notify owner
```

The foundation does not open or crawl external URLs.

## Setup

### 1. Install

```bash
npm install
```

### 2. Create D1

```bash
npx wrangler d1 create mindpath
```

Put the returned database ID into `wrangler.jsonc`.

### 3. Apply schema

```bash
npx wrangler d1 execute mindpath --remote --file=./schema.sql
```

### 4. Configure secrets

Create a local `.dev.vars` from `.env.example` for development.

For production, use Wrangler secrets:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
npx wrangler secret put OWNER_TELEGRAM_ID
npx wrangler secret put GEMINI_API_KEY
```

### 5. Deploy

```bash
npm run deploy
```

### 6. Register Telegram webhook

After deployment, send a POST request to:

```text
https://YOUR-WORKER-DOMAIN/admin/set-webhook
```

with:

```text
X-MindPath-Admin-Key: YOUR_TELEGRAM_WEBHOOK_SECRET
```

## Important

`wrangler.jsonc` contains a placeholder D1 ID. Replace it before deployment.

Google Drive, research, email, reminders, GitHub, and other advanced features are intentionally not wired yet.

The architecture is designed so these can be added as adapters without rewriting the core.

## Development rule

Build in small verified stages:

1. Foundation
2. Research provider
3. Google Drive
4. Memory
5. Tasks/reminders
6. Notifications/email
7. GitHub/project tools
8. Additional automations

Do not add paid services silently.

Do not put secrets into Git.

Prompts are not security boundaries. Application code must enforce permissions.
