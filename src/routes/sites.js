const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');
const { getTier, getScrapeDays } = require('../tiers');
const fs = require('fs');

const router = express.Router();

// GET /sites — browse all casino sites
router.get('/', requireAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customerId);
  const isSubscribed = customer.subscription_status === 'active';
  const tier = getTier(isSubscribed ? 'main' : 'trial');

  // Search/filter
  const search = req.query.q || '';
  const category = req.query.category || '';
  const status = req.query.status || '';

  let query = `SELECT s.*, 
    COALESCE(cs.enabled, 0) as user_enabled,
    COALESCE(cs.account_username, '') as user_username
    FROM sites s
    LEFT JOIN customer_sites cs ON cs.site_id = s.id AND cs.customer_id = ?
    WHERE 1=1`;
  const params = [req.customerId];

  if (search) {
    query += ` AND (s.name LIKE ? OR s.url LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }
  if (category) {
    query += ` AND s.category = ?`;
    params.push(category);
  }
  if (status) {
    query += ` AND s.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY s.bonuses_count DESC, s.name ASC LIMIT 200`;

  const sites = db.prepare(query).all(...params);
  
  // Count stats
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN s.has_bonuses = 1 THEN 1 ELSE 0 END) as with_bonuses,
      (SELECT COUNT(*) FROM customer_sites WHERE customer_id = ? AND enabled = 1) as user_enabled_count
    FROM sites s
  `).get(req.customerId);

  res.render('pages/sites', { 
    customer, 
    sites, 
    stats,
    tier,
    isSubscribed,
    search,
    category,
    status,
    registered: req.query.registered || null,
    imported: req.query.imported || null,
    error: req.query.error || null,
  });
});

// POST /sites/:id/toggle — enable/disable a site for your account
router.post('/:id/toggle', requireAuth, (req, res) => {
  const siteId = parseInt(req.params.id);
  const customerId = req.customerId;

  const existing = db.prepare(
    'SELECT id, enabled FROM customer_sites WHERE customer_id = ? AND site_id = ?'
  ).get(customerId, siteId);

  if (existing) {
    db.run('UPDATE customer_sites SET enabled = ? WHERE id = ?', 
      [existing.enabled ? 0 : 1, existing.id]);
  } else {
    db.run('INSERT INTO customer_sites (customer_id, site_id, enabled) VALUES (?, ?, 1)',
      [customerId, siteId]);
  }

  res.redirect('/sites');
});

// POST /sites/toggle-all — enable/disable all sites (bulk operation)
router.post('/toggle-all', requireAuth, (req, res) => {
  const customerId = req.customerId;
  const enable = req.body.action === 'enable' ? 1 : 0;

  const rawDb = db.getDb();
  rawDb.run('BEGIN TRANSACTION');
  try {
    rawDb.run('DELETE FROM customer_sites WHERE customer_id = ?', [customerId]);
    rawDb.run(
      'INSERT INTO customer_sites (customer_id, site_id, enabled) SELECT ?, id, ? FROM sites',
      [customerId, enable]
    );
    rawDb.run('COMMIT');
  } catch(e) {
    rawDb.run('ROLLBACK');
  }
  const d = db.getDb();
  const path = require('path');
  const fs2 = require('fs');
  fs2.writeFileSync(
    path.join(__dirname, '..', '..', 'data', 'app.db'),
    Buffer.from(d.export())
  );
  res.redirect('/sites');
});

// POST /sites/auto-signup — auto-register on all sites (subscribers only)
router.post('/auto-signup', requireAuth, async (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customerId);

  if (customer.subscription_status !== 'active') {
    return res.status(403).redirect('/sites?error=subscription+required');
  }

  const usernamePrefix = req.body.username_prefix || '';
  const basePassword = req.body.base_password || 'AutoGen123!';

  if (!usernamePrefix) {
    return res.redirect('/sites?error=need_prefix');
  }

  const allSites = db.prepare('SELECT id, url, name FROM sites WHERE status = ?').all('active');
  let queued = 0;

  for (const site of allSites) {
    const existing = db.prepare(
      'SELECT id FROM registration_queue WHERE customer_id = ? AND site_id = ? AND status IN (?, ?)'
    ).get(req.customerId, site.id, 'pending', 'completed');

    if (!existing) {
      const genUsername = `${usernamePrefix}_${site.name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
      db.run(
        'INSERT INTO registration_queue (customer_id, site_id, account_username, account_password, status) VALUES (?, ?, ?, ?, ?)',
        [req.customerId, site.id, genUsername, basePassword, 'pending']
      );
      queued++;
    }
  }

  res.redirect(`/sites?registered=${queued}`);
});

// GET /sites/registration-status — check auto-registration progress
router.get('/registration-status', requireAuth, (req, res) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM registration_queue WHERE customer_id = ?
  `).get(req.customerId);

  res.json(stats);
});

// GET /sites/seed — seed the sites database from scraper URL list
router.get('/seed', requireAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customerId);

  const urlsPath = '/data/data/com.termux/files/home/dev/codex/golf/in/config/urls.txt';
  let imported = 0;

  try {
    const content = fs.readFileSync(urlsPath, 'utf-8');
    const urls = content.split('\n')
      .map(l => l.trim())
      .filter(l => l && l.startsWith('http'));

    const rawDb = db.getDb();
    rawDb.run('BEGIN TRANSACTION');
    let count = 0;
    for (const url of urls) {
      let name = url.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
      name = name.split(/[.-]/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      try {
        rawDb.run('INSERT OR IGNORE INTO sites (url, name) VALUES (?, ?)', [url, name]);
        count++;
      } catch(e) {}
    }
    rawDb.run('COMMIT');
    const path = require('path');
    const fs2 = require('fs');
    fs2.writeFileSync(
      path.join(__dirname, '..', '..', 'data', 'app.db'),
      Buffer.from(rawDb.export())
    );
    imported = count;
  } catch(e) {
    return res.status(500).send(`Error reading scraper URLs: ${e.message}`);
  }

  res.redirect(`/sites?imported=${imported}`);
});

module.exports = router;
