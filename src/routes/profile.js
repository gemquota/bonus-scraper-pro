const express = require('express');
const { requireAuth } = require('../middleware/auth');
const db = require('../db');
const { getTier } = require('../tiers');

const router = express.Router();

// GET /profile — show casino account management page
router.get('/', requireAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customerId);

  // Parse casino credentials (JSON array)
  let casinoAccounts = [];
  try {
    casinoAccounts = JSON.parse(customer.casino_credentials || '[]');
  } catch { casinoAccounts = []; }

  // Get all sites the user has enabled
  const enabledSites = db.prepare(`
    SELECT cs.*, s.url, s.name 
    FROM customer_sites cs 
    JOIN sites s ON cs.site_id = s.id 
    WHERE cs.customer_id = ? AND cs.enabled = 1
    ORDER BY s.name
  `).all(req.customerId);

  res.render('pages/profile', { 
    customer, 
    casinoAccounts, 
    enabledSites,
    saved: req.query.saved,
    error: null,
  });
});

// POST /profile — save casino credentials
router.post('/', requireAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customerId);
  
  // Parse the submitted accounts
  const accounts = [];
  const usernames = req.body.username || [];
  const passwords = req.body.password || [];
  const labels = req.body.label || [];

  // Support both array and single submission
  const usernameList = Array.isArray(usernames) ? usernames : [usernames];
  const passwordList = Array.isArray(passwords) ? passwords : [passwords];
  const labelList = Array.isArray(labels) ? labels : [labels];

  for (let i = 0; i < usernameList.length; i++) {
    if (usernameList[i] && usernameList[i].trim()) {
      accounts.push({
        id: i + 1,
        label: labelList[i] || `Account ${i + 1}`,
        username: usernameList[i].trim(),
        password: passwordList[i] || '',
      });
    }
  }

  db.run('UPDATE customers SET casino_credentials = ? WHERE id = ?', [
    JSON.stringify(accounts), req.customerId
  ]);

  res.redirect('/profile?saved=1');
});

// POST /profile/delete-account/:id — remove a specific casino account
router.post('/delete-account/:id', requireAuth, (req, res) => {
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.customerId);
  let accounts = [];
  try { accounts = JSON.parse(customer.casino_credentials || '[]'); } catch {}
  
  const deleteId = parseInt(req.params.id);
  accounts = accounts.filter(a => a.id !== deleteId);
  
  db.run('UPDATE customers SET casino_credentials = ? WHERE id = ?', [
    JSON.stringify(accounts), req.customerId
  ]);
  res.redirect('/profile?saved=1');
});

module.exports = router;
