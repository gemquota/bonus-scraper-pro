const express = require('express');
const db = require('../db');
const { getTier, getScrapeDays } = require('../tiers');
const fs = require('fs');
const path = require('path');

const router = express.Router();

const GOLF_LICENSE_DIR = '/data/data/com.termux/files/home/dev/codex/golf/data';
const LICENSE_FILE = path.join(GOLF_LICENSE_DIR, 'license.json');

function writeGolfLicense(data) {
  try {
    if (!fs.existsSync(GOLF_LICENSE_DIR)) fs.mkdirSync(GOLF_LICENSE_DIR, { recursive: true });
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch { return false; }
}

// POST /api/license/validate — called by the Python scraper
router.post('/validate', (req, res) => {
  const { license_key } = req.body;
  
  if (!license_key) {
    return res.json({
      valid: false,
      tier: 'trial',
      tier_name: 'Free Trial',
      scrape_days: ['Monday'],
      data_level: 'basic',
      data_label: 'Standard Data',
      schedule_label: 'Monday',
      scrape_today: false,
      features: {},
      error: 'License key required. Subscribe to continue after your free trial.',
      trial_info: 'Your free trial includes 1 Monday scrape. Subscribe to keep access.',
    });
  }
  
  const license = db.prepare(`
    SELECT l.*, c.email, c.subscription_status
    FROM licenses l JOIN customers c ON l.customer_id = c.id
    WHERE l.key = ? AND l.active = 1
  `).get(license_key);
  
  if (!license) {
    return res.json({
      valid: false,
      tier: 'trial',
      error: 'Invalid or expired license key',
    });
  }
  
  if (license.subscription_status !== 'active') {
    return res.json({
      valid: false,
      tier: 'trial',
      error: 'Subscription not active. Please renew.',
    });
  }
  
  // Check expiry
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    db.run('UPDATE licenses SET active = 0 WHERE id = ?', [license.id]);
    return res.json({ valid: false, tier: 'trial', error: 'License expired' });
  }
  
  const tierConfig = getTier(license.tier);
  const features = JSON.parse(license.features || '{}');
  const scrapeDays = getScrapeDays(license.tier);
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
  const scrapesToday = scrapeDays.includes(today);
  
  // Record validation
  db.run('INSERT INTO usage_log (license_id, api_calls) VALUES (?, 1)', [license.id]);
  
  // Auto-write license to golf project
  writeGolfLicense({
    valid: true,
    key: license_key,
    tier: license.tier,
    tierName: tierConfig.name,
    scrapeDays,
    dataLevel: 'expert',
    features,
    customerEmail: license.email,
    scrapesToday,
    validatedAt: new Date().toISOString(),
    expiresAt: license.expires_at,
  });
  
  console.log(`🔑 License validated: ${license.tier} — ${license.email} (${scrapesToday ? 'scraping today ✓' : 'no scrape today'})`);
  
  // Get customer's casino credentials and enabled sites
  let casino_credentials = [];
  let enabled_sites = [];
  try {
    const customer = db.prepare('SELECT casino_credentials FROM customers WHERE id = ?').get(license.customer_id);
    if (customer && customer.casino_credentials) {
      casino_credentials = JSON.parse(customer.casino_credentials);
    }
    enabled_sites = db.prepare(`
      SELECT s.url, s.name, cs.account_username, cs.account_password
      FROM customer_sites cs JOIN sites s ON cs.site_id = s.id
      WHERE cs.customer_id = ? AND cs.enabled = 1
    `).all(license.customer_id);
  } catch(e) {}
  
  res.json({
    valid: true,
    tier: license.tier,
    tier_name: tierConfig.name,
    scrape_days: scrapeDays,
    data_level: 'expert',
    data_label: tierConfig.dataLabel,
    schedule_label: tierConfig.scheduleLabel,
    scrape_today: scrapesToday,
    features,
    customer_email: license.email,
    expires_at: license.expires_at,
    casino_credentials,
    enabled_sites: enabled_sites.map(s => s.url),
    total_sites_enabled: enabled_sites.length,
  });
});

// GET /api/license/status — quick check
router.get('/status', (req, res) => {
  const key = req.query.key;
  if (!key) return res.json({ valid: false });
  
  const license = db.prepare(`
    SELECT l.tier, l.max_urls, l.max_workers, l.expires_at, c.subscription_status
    FROM licenses l JOIN customers c ON l.customer_id = c.id
    WHERE l.key = ? AND l.active = 1
  `).get(key);
  
  res.json({
    valid: !!license,
    tier: license?.tier || 'trial',
    status: license?.subscription_status || 'expired',
    expires: license?.expires_at || null,
  });
});

// GET /api/license/features/:tier
router.get('/features/:tier', (req, res) => {
  const tier = getTier(req.params.tier);
  res.json({
    tier: req.params.tier,
    name: tier.name,
    scrapeDays: tier.scrapeDays,
    dataLevel: tier.dataLevel,
    scheduleLabel: tier.scheduleLabel,
  });
});

module.exports = router;
