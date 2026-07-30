# 🕸️ Bonus Scraper Pro

**Subscription & License Management** for the Bonus Scraper Engine.

Scrape casino bonus offers on your schedule. Three tiers — pay how you want.

## Tiers

| Tier | Price | Schedule | Data Level |
|------|-------|----------|------------|
| **Starter** | $47/mo ($12/wk · $120/qtr · $400/yr) | Monday | Standard (CSV) |
| **Pro** | $97/mo ($25/wk · $250/qtr · $840/yr) | Mon + Thu + Sat | Advanced (CSV+JSON, scoring) |
| **Elite** | $197/mo ($50/wk · $500/qtr · $1,600/yr) | Daily | Expert (all formats, raw, FTS) |

**Free first month on Starter.** Cancel anytime.

## Key Features

- **Account Portal** — Manage casino credentials, enable/disable scrape targets
- **Sites Database** — Browse 1,000+ casino sites with merchant details
- **License Validation API** — Scraper validates your license on startup
- **Config Sync** — Auto-generate `config.ini` from your saved accounts + sites
- **Elite Auto-Registration** — Generate accounts on all casino sites automatically
- **Background Worker** — Processes registration queue & syncs scraper data
- **Multi-Period Billing** — Weekly, monthly, quarterly, annual via Stripe

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up Stripe products
export STRIPE_SECRET_KEY=sk_live_...
bash scripts/01-setup-stripe.sh

# 3. Set webhook secret
# Stripe Dashboard → Webhooks → Add endpoint → /payments/webhook

# 4. Start server
npm start
```

## API

| Endpoint | Description |
|----------|-------------|
| `POST /api/license/validate` | Validate a license key |
| `GET /api/license/features/:tier` | Get tier features |
| `GET /api/sync-config` | Generate config.ini from your profile |
| `GET /api/sync-config/download` | Download config.ini |

## Architecture

```
User → Website (Express) → Stripe Checkout → Webhook → License Created
                                                         ↓
Scraper (Python) → POST /api/license/validate → Returns tier + credentials + sites
                                                         ↓
                                              Enforces schedule & data level
```
