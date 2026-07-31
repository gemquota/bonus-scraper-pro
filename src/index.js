const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const config = require('./config');
const db = require('./db');

async function createApp() {
  await db.init();

  const app = express();

  app.set('view engine', 'ejs');
  app.set('views', path.join(__dirname, '..', 'views'));

  app.use('/payments/webhook', express.raw({ type: 'application/json' }));
  app.use('/api/license', express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cors());
  app.use(cookieParser());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.use((req, res, next) => {
    res.locals.path = req.path;
    res.locals.customer = null;
    const token = req.cookies?.token;
    if (token) {
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, config.jwtSecret);
        res.locals.customer = { id: decoded.id, email: decoded.email };
      } catch {}
    }
    next();
  });

  // Routes
  app.use('/', require('./routes/auth'));
  app.use('/dashboard', require('./routes/dashboard'));
  app.use('/payments', require('./routes/payments'));
  app.use('/api/license', require('./routes/license'));
  app.use('/profile', require('./routes/profile'));
  app.use('/sites', require('./routes/sites'));
  app.use('/api', require('./routes/api'));

  // Pages
  app.get('/', (req, res) => res.render('pages/index'));
  // /home serves the landing page too (Vercel account-level root issue workaround)
  app.get('/home', (req, res) => res.render('pages/index'));
  app.get('/pricing', (req, res) => res.render('pages/pricing', { checkout: req.query.checkout }));
  app.get('/docs', (req, res) => res.render('pages/docs'));

  return app;
}

module.exports = createApp;

if (require.main === module) {
  createApp().then(app => {
    app.listen(config.port, () => {
      console.log(`\n╔══════════════════════════════════════════╗`);
      console.log(`║  🕸️  Bonus Scraper Pro                   ║`);
      console.log(`║  Subscription & License Management       ║`);
      console.log(`╚══════════════════════════════════════════╝`);
      console.log(`\n  📍 ${config.baseUrl}`);
      console.log(`  💰 Stripe: ${config.stripeSecretKey ? '✅ Ready' : '⚠️  Not configured'}`);
      console.log(`\n  🔑 License API:       POST /api/license/validate`);
      console.log(`  📊 Stripe Webhook:    POST /payments/webhook`);
      console.log(`  📖 Docs:              /docs`);
      console.log('');
    });
  }).catch(err => { console.error('Fatal:', err); process.exit(1); });
}
