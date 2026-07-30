const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');
const stripe = require('../stripe');
const { getTier, getTierPrice } = require('../tiers');

const router = express.Router();

// POST /payments/checkout/:tier?period=monthly
router.post('/checkout/:tier', requireAuth, async (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customerId);
    const tierId = req.params.tier;
    const period = req.body.period || req.query.period || 'monthly';
    const tier = getTier(tierId);
    const price = getTierPrice(tierId, period);
    
    if (!price.stripePriceId) {
      return res.status(400).json({ error: `No Stripe price configured for ${tierId} ${period}. Run the Stripe setup script first.` });
    }
    
    const session = await stripe.createCheckoutSession(customer, tierId, tier, period);
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/portal', requireAuth, async (req, res) => {
  try {
    const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customerId);
    if (!customer.stripe_customer_id) return res.status(400).json({ error: 'No active subscription' });
    const session = await stripe.createPortalSession(customer.stripe_customer_id);
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const result = await stripe.handleWebhook(req.body, sig);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
