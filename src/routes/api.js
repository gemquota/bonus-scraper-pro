const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');

const router = express.Router();

// GET /api/sync-config — generate a scraper config.ini from user's profile
router.get('/sync-config', requireAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customerId);

  // Parse casino credentials
  let accounts = [];
  try { accounts = JSON.parse(customer.casino_credentials || '[]'); } catch {}

  // Get enabled sites
  const enabledSites = db.prepare(`
    SELECT s.url FROM customer_sites cs 
    JOIN sites s ON cs.site_id = s.id 
    WHERE cs.customer_id = ? AND cs.enabled = 1
  `).all(req.customerId);

  if (accounts.length === 0) {
    return res.status(400).json({
      error: 'No casino accounts configured. Add accounts in your Profile first.',
      config: null,
    });
  }

  // Build config.ini content
  const lines = ['[SETTINGS]'];
  lines.push('workers = 10');
  lines.push('min_delay = 2.0');
  lines.push('max_delay = 4.0');
  lines.push('');

  accounts.forEach((acct, i) => {
    lines.push(`[U${i + 1}]`);
    lines.push(`u = ${acct.username}`);
    lines.push(`p = ${acct.password}`);
    lines.push('');
  });

  lines.push('# URLs to scrape');
  if (enabledSites.length > 0) {
    enabledSites.forEach(site => {
      lines.push(site.url);
    });
  } else {
    lines.push('# No sites enabled. Visit /sites to enable sites.');
  }
  lines.push('');

  const configContent = lines.join('\n');

  res.json({
    accounts_count: accounts.length,
    sites_count: enabledSites.length,
    config: configContent,
    download_url: `/api/sync-config/download?t=${Date.now()}`,
  });
});

// GET /api/sync-config/download — download as file
router.get('/sync-config/download', requireAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customerId);

  let accounts = [];
  try { accounts = JSON.parse(customer.casino_credentials || '[]'); } catch {}

  const enabledSites = db.prepare(`
    SELECT s.url FROM customer_sites cs 
    JOIN sites s ON cs.site_id = s.id 
    WHERE cs.customer_id = ? AND cs.enabled = 1
  `).all(req.customerId);

  const lines = ['[SETTINGS]', 'workers = 10', 'min_delay = 2.0', 'max_delay = 4.0', ''];
  accounts.forEach((acct, i) => {
    lines.push(`[U${i + 1}]`);
    lines.push(`u = ${acct.username}`);
    lines.push(`p = ${acct.password}`);
    lines.push('');
  });
  enabledSites.forEach(site => { lines.push(site.url); });
  lines.push('');

  res.setHeader('Content-Type', 'text/plain');
  res.setHeader('Content-Disposition', 'attachment; filename=config.ini');
  res.send(lines.join('\n'));
});

module.exports = router;
