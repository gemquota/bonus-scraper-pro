const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');
const stripe = require('../stripe');
const { getTier, getFeatureList } = require('../tiers');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customerId);
  const isSubscribed = customer.subscription_status === 'active';
  const license = db.prepare('SELECT * FROM licenses WHERE customer_id = ? ORDER BY created_at DESC').get(req.customerId);
  const payments = db.prepare('SELECT * FROM payments WHERE customer_id = ? ORDER BY created_at DESC LIMIT 10').all(req.customerId);
  
  // Usage for this month
  const usage = db.prepare(`
    SELECT COALESCE(SUM(urls_scraped), 0) as urls, COALESCE(SUM(api_calls), 0) as api_calls
    FROM usage_log WHERE license_id = (SELECT id FROM licenses WHERE customer_id = ? AND active = 1 LIMIT 1)
    AND date >= date('now', 'start of month')
  `).get(req.customerId);
  
  const tier = getTier(isSubscribed ? 'main' : 'trial');
  const features = getFeatureList(isSubscribed ? 'main' : 'trial');
  
  res.render('pages/dashboard', { customer, license, payments, usage, tier, features, checkout: req.query.checkout });
});

module.exports = router;
