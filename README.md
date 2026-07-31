# Bonus Scraper Pro — Subscription & License Server

Stripe subscription management + license validation layer for the Bonus Scraper engine.

## Pricing

### Starter — $6/wk · $20/mo · $50/qtr · $180/yr
- Monday scrapes, Standard Data, CSV export, free first month

### Pro — $12/wk · $35/mo · $90/qtr · $300/yr
- Mon+Thu+Sat scrapes, Advanced Data, CSV+JSON export, value scoring

### Elite — $24/wk · $70/mo · $180/qtr · $600/yr
- Daily scrapes, Expert Data, full-text search, raw data, auto-registration

Free first month on Starter monthly only. No free tier beyond that.

## Quick Start

```bash
npm install
export STRIPE_SECRET_KEY=sk_live_...
bash scripts/01-setup-stripe.sh
# Then set STRIPE_WEBHOOK_SECRET in .env
npm start
```

## API

- `POST /api/license/validate` — validate a license key
- `GET /api/license/status?key=...` — quick status check
- `POST /payments/webhook` — Stripe webhook receiver
- `POST /payments/checkout/:tier?period=monthly` — checkout (tier1/tier2/tier3)
- `GET /api/sync-config` — generate config.ini

## Setup Stripe

```bash
STRIPE_SECRET_KEY=sk_live_... bash scripts/01-setup-stripe.sh
```

Creates 12 Stripe prices (3 tiers × 4 periods). Configure webhook at `/payments/webhook`.


## One-Click Deploy (Render — recommended)

Vercel's root path is broken on this account (SSO protection bug), so use Render for a stable URL:

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/gemquota/bonus-scraper-pro)

1. Click the button (or go to render.com → New → Blueprint → select the repo)
2. It reads `render.yaml` automatically — no config needed
3. After deploy: set `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in Render Dashboard → Environment
4. URL: `https://bonus-scraper-pro.onrender.com`

Note: free Render services sleep after 15 min idle and wake on the first request.
