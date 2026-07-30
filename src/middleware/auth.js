const jwt = require('jsonwebtoken');
const config = require('../config');

function requireAuth(req, res, next) {
  const token = req.cookies?.token;
  if (!token) return res.redirect('/login');
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.customerId = decoded.id;
    req.customerEmail = decoded.email;
    next();
  } catch {
    res.clearCookie('token');
    res.redirect('/login');
  }
}

module.exports = { requireAuth };
