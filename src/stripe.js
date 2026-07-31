const Stripe = require('stripe');
const config = require('./config');

let stripe = null;
if (config.stripeSecretKey) {
  stripe = Stripe(config.stripeSecretKey);
}

// Map period to Stripe interval
const INTERVAL_MAP = {
  weekly: { interval: 'week', count: 1 },
  monthly: { interval: 'month', count: 1 },
  quarterly: { interval: 'month', count: 3 },
  annual: { interval: 'year', count: 1 },
};

async function createCheckoutSession(customer, tierId, tier, period) {
  if (!stripe) throw new Error('Stripe not configured. Set STRIPE_SECRET_KEY');

  const price = tier.prices?.[period];
  if (!price || !price.stripePriceId) {
    throw new Error(`No Stripe price configured for ${tierId} ${period}`);
  }

  const params = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: price.stripePriceId, quantity: 1 }],
    customer_email: customer.email,
    client_reference_id: String(customer.id),
    metadata: {
      customer_id: String(customer.id),
      tier: tierId,
      period: period,
    },
    success_url: `${config.baseUrl}/dashboard?checkout=success`,
    cancel_url: `${config.baseUrl}/pricing?cancelled=1`,
  };

  // Trial: only monthly period gets the free first month
  if (period === 'monthly') {
    params.subscription_data = { trial_period_days: 30 };
  }

  const session = await stripe.checkout.sessions.create(params);
  return session;
}

async function createPortalSession(stripeCustomerId) {
  if (!stripe) throw new Error('Stripe not configured.');
  return await stripe.billingPortal.sessions.create({
    customer: stripeCustomerId,
    return_url: `${config.baseUrl}/dashboard`,
  });
}

async function handleWebhook(body, signature) {
  if (!stripe) throw new Error('Stripe not configured.');
  const event = stripe.webhooks.constructEvent(body, signature, config.stripeWebhookSecret);
  const db = require('./db');
  const crypto = require('crypto');
  const { getTier } = require('./tiers');

  function generateLicenseKey() {
    const raw = crypto.randomBytes(24).toString('hex').toUpperCase();
    return `SCRPR-${raw.slice(0, 8)}-${raw.slice(8, 16)}-${raw.slice(16, 24)}`;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const customerId = parseInt(session.metadata.customer_id);
      const tier = session.metadata.tier || 'main';
      const period = session.metadata.period || 'monthly';
      const tierConfig = getTier(tier);
      const licenseKey = generateLicenseKey();

      const subscriptionStatus = session.status === 'complete' ? 'active' : 'trialing';
      db.run(
        'UPDATE customers SET stripe_customer_id = ?, stripe_subscription_id = ?, subscription_tier = ?, subscription_status = ?, license_key = ? WHERE id = ?',
        [session.customer, session.subscription, tier, subscriptionStatus, licenseKey, customerId]
      );

      const features = JSON.stringify(tierConfig.features);
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      db.run(
        'INSERT INTO licenses (customer_id, key, tier, features, expires_at) VALUES (?, ?, ?, ?, ?)',
        [customerId, licenseKey, tier, features, expiresAt]
      );

      console.log(`🎉 New subscription: ${session.customer_email} (${tier}/${period}) — License: ${licenseKey}`);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object;
      const subId = invoice.subscription;
      const customer = db.prepare('SELECT * FROM customers WHERE stripe_subscription_id = ?').get(subId);
      if (customer) {
        db.run('UPDATE customers SET subscription_status = ? WHERE id = ?', ['active', customer.id]);
        db.run('UPDATE licenses SET active = 1 WHERE customer_id = ?', [customer.id]);
        const newExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        db.run('UPDATE licenses SET expires_at = ? WHERE customer_id = ?', [newExpiry, customer.id]);
        db.run(
          'INSERT INTO payments (customer_id, stripe_payment_id, amount, tier, status) VALUES (?, ?, ?, ?, ?)',
          [customer.id, invoice.payment_intent, invoice.amount_paid, customer.subscription_tier, 'succeeded']
        );
        console.log(`💰 Invoice paid: ${customer.email} — $${(invoice.amount_paid / 100).toFixed(2)}`);
      }
      break;
    }

    case 'customer.subscription.deleted':
    case 'customer.subscription.updated': {
      const sub = event.data.object;
      const isActive = sub.status === 'active' || sub.status === 'trialing';
      const status = isActive ? 'active' : 'canceled';
      db.run('UPDATE customers SET subscription_status = ? WHERE stripe_subscription_id = ?', [status, sub.id]);
      if (!isActive) {
        const cust = db.prepare('SELECT id FROM customers WHERE stripe_subscription_id = ?').get(sub.id);
        if (cust) {
          db.run('UPDATE licenses SET active = 0 WHERE customer_id = ?', [cust.id]);
          console.log(`🚫 Subscription canceled: customer ${cust.id}`);
        }
      }
      break;
    }
  }
  return { received: true };
}

module.exports = { createCheckoutSession, createPortalSession, handleWebhook };
