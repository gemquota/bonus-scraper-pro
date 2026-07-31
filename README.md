# Bonus Scraper Pro — Subscription & License Server

Stripe subscription management + license validation layer for the Bonus Scraper engine.

## Single Plan Pricing

| Period | Price | Effective /mo |
|--------|-------|--------------|
| Weekly | $6/wk | $26/mo |
| Monthly | $20/mo | $20/mo |
| Quarterly | $50/qtr | $17/mo |
| Annual | $180/yr | $15/mo |

**Free first month trial** on the monthly plan only. No free tier — just a free month.

## What's Included

- **1,000+ casino sites** scraped daily
- **Expert data level** — most detailed bonus information
- **CSV + JSON + Raw** export formats
- **Full-text search** across all scraped data
- **Value scoring** — ranked bonuses by value
- **Filtered export** — narrow down by criteria
- **Custom fields** — bring your own data schema
- **Auto-registration** — we create accounts on all casino sites for you
- **Priority support** — email and chat

## Quick Start

```bash
# Install dependencies
npm install

# Set up Stripe (creates 4 price IDs)
export STRIPE_SECRET_KEY=sk_live_...
bash scripts/01-setup-stripe.sh

# Set webhook secret in .env
STRIPE_WEBHOOK_SECRET=whsec_...

# Start
npm start
```

## API

- `POST /api/license/validate` — validate a license key, returns tier/data/scrape schedule
- `GET /api/license/status?key=...` — quick license status check
- `POST /payments/webhook` — Stripe webhook receiver
- `POST /payments/checkout/main?period=monthly` — create Stripe checkout session
- `GET /api/sync-config` — generate config.ini from user's casino accounts + enabled sites

## Architecture

- **Express** web server with EJS templates
- **sql.js** (SQLite via WebAssembly) for user/account/site data
- **Stripe** for subscription billing and payment processing
- **Background worker** processes registration queue and syncs scraper data

## Setup Stripe

1. Create a Stripe account at https://dashboard.stripe.com
2. Get your secret key: `sk_live_...`
3. Run the setup script to create 4 prices:

```bash
STRIPE_SECRET_KEY=sk_live_... bash scripts/01-setup-stripe.sh
```

4. Configure the webhook endpoint in Stripe Dashboard:
   - Endpoint: `https://your-app.com/payments/webhook`
   - Events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted`, `customer.subscription.updated`
   - Copy the signing secret to `STRIPE_WEBHOOK_SECRET` in `.env`

## Deployment

The server is designed to run alongside the Python scraper engine.
