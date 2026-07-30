# Stripe Setup Guide (2 minutes)

## Step 1: Create a Stripe Account
1. Go to https://dashboard.stripe.com/register
2. Enter your email and create a password
3. Skip the activation questions (you can do them later)

## Step 2: Get Your API Keys
1. Go to https://dashboard.stripe.com/apikeys
2. Copy your **Secret key** (starts with `sk_test_...`)
3. Run: `./scripts/setup-stripe.sh`

## Step 3: Create Your Product & Price
1. Go to https://dashboard.stripe.com/products
2. Click "Add Product"
3. Name: `ContentForge Pro`
4. Description: "Access to AI-powered content generation API"
5. Pricing: Recurring → $19/month
6. Click "Save Product"
7. Copy the **Price ID** (starts with `price_...`)
8. Run: `./scripts/setup-stripe.sh` again to set it

## Step 4: Configure Webhook
1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. Endpoint URL: `https://your-app.com/payments/webhook`
4. Listen for:
   - `checkout.session.completed`
   - `invoice.paid`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_...`)
7. Run: `./scripts/setup-stripe.sh` to set it

## Step 5: Go Live
1. In Stripe Dashboard → toggle "View test data" off
2. Switch to live mode keys
3. Update `.env` with live keys
4. Deploy!
