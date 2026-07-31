const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');

const router = express.Router();

router.get('/signup', (req, res) => {
  const tier = req.query.tier || null;
  res.render('pages/signup', { error: null, tier });
});

router.get('/login', (req, res) => {
  const tier = req.query.tier || null;
  res.render('pages/login', { error: null, registered: req.query.registered || false, tier });
});

router.post('/signup', (req, res) => {
  const { name, email, password, tier } = req.body;
  if (!email || !password) return res.render('pages/signup', { error: 'Email and password required', tier: tier || null });
  
  if (db.prepare('SELECT id FROM customers WHERE email = ?').get(email)) {
    return res.render('pages/signup', { error: 'Email already registered', tier: tier || null });
  }
  
  const hash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO customers (name, email, password) VALUES (?, ?, ?)', [name || email.split('@')[0], email, hash]);
  
  const customer = db.prepare('SELECT id, email FROM customers WHERE email = ?').get(email);
  const token = jwt.sign({ id: customer.id, email: customer.email }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  
  if (tier && ['tier1','tier2','tier3'].includes(tier)) {
    return res.redirect(`/pricing?checkout=${tier}`);
  }
  res.redirect('/pricing');
});

router.post('/login', (req, res) => {
  const { email, password, tier } = req.body;
  const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
  if (!customer || !bcrypt.compareSync(password, customer.password)) {
    return res.render('pages/login', { error: 'Invalid email or password', registered: false, tier: tier || null });
  }
  const token = jwt.sign({ id: customer.id, email: customer.email }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  
  if (tier && ['tier1','tier2','tier3'].includes(tier)) {
    return res.redirect(`/pricing?checkout=${tier}`);
  }
  res.redirect('/dashboard');
});

router.get('/logout', (req, res) => { res.clearCookie('token'); res.redirect('/'); });

module.exports = router;
