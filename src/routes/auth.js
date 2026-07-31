const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const config = require('../config');

const router = express.Router();

router.get('/signup', (req, res) => {
  res.render('pages/signup', { error: null });
});

router.get('/login', (req, res) => {
  res.render('pages/login', { error: null, registered: req.query.registered || false });
});

router.post('/signup', (req, res) => {
  const { name, email, password } = req.body;
  if (!email || !password) return res.render('pages/signup', { error: 'Email and password required' });
  
  if (db.prepare('SELECT id FROM customers WHERE email = ?').get(email)) {
    return res.render('pages/signup', { error: 'Email already registered' });
  }
  
  const hash = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO customers (name, email, password) VALUES (?, ?, ?)', [name || email.split('@')[0], email, hash]);
  
  // Auto-login
  const customer = db.prepare('SELECT id, email FROM customers WHERE email = ?').get(email);
  const token = jwt.sign({ id: customer.id, email: customer.email }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  
  // Redirect to pricing to choose plan
  res.redirect('/pricing');
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const customer = db.prepare('SELECT * FROM customers WHERE email = ?').get(email);
  if (!customer || !bcrypt.compareSync(password, customer.password)) {
    return res.render('pages/login', { error: 'Invalid email or password', registered: false });
  }
  const token = jwt.sign({ id: customer.id, email: customer.email }, config.jwtSecret, { expiresIn: '7d' });
  res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 });
  
  res.redirect('/dashboard');
});

router.get('/logout', (req, res) => { res.clearCookie('token'); res.redirect('/'); });

module.exports = router;
