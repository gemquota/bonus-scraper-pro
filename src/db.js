const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const SEED_DB = path.join(dataDir, 'seed.db');
let dbPath = path.join(dataDir, 'app.db');

// Serverless platforms (Vercel) have a read-only project dir — use /tmp.
if (process.env.VERCEL) {
  fs.mkdirSync('/tmp/bonus-scraper', { recursive: true });
  dbPath = '/tmp/bonus-scraper/app.db';
}

fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Seed fresh instances (serverless cold start / ephemeral disk) from committed seed DB
if (!fs.existsSync(dbPath) && fs.existsSync(SEED_DB)) {
  fs.copyFileSync(SEED_DB, dbPath);
}

let db = null;

function save() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

async function init() {
  // sql.js needs its WASM binary; serverless bundles may not include .wasm
  // files, so use the base64-embedded copy (guaranteed to be in the bundle).
  const wasmBinary = require('./sql-wasm-b64');
  const SQL = await initSqlJs({ wasmBinary });
  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }
  
  db.run('PRAGMA foreign_keys = ON');
  
  // --- Schema Version Management ---
  db.run(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY
  )`);
  
  let version = 0;
  const verRow = db.exec("SELECT MAX(version) as v FROM schema_version");
  if (verRow.length > 0 && verRow[0].values.length > 0 && verRow[0].values[0][0] !== null) {
    version = verRow[0].values[0][0];
  }
  
  // --- Base Tables (v0 initial) ---
  if (version < 1) {
    db.run(`CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      password TEXT NOT NULL,
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_tier TEXT DEFAULT 'trial',
      subscription_status TEXT DEFAULT 'inactive',
      license_key TEXT UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS licenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      key TEXT UNIQUE NOT NULL,
      tier TEXT NOT NULL,
      max_urls INTEGER DEFAULT 50,
      max_workers INTEGER DEFAULT 1,
      features TEXT DEFAULT '{}',
      expires_at DATETIME,
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS usage_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      license_id INTEGER NOT NULL,
      urls_scraped INTEGER DEFAULT 0,
      api_calls INTEGER DEFAULT 0,
      date DATE DEFAULT (DATE('now')),
      FOREIGN KEY (license_id) REFERENCES licenses(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      stripe_payment_id TEXT UNIQUE,
      amount INTEGER NOT NULL,
      tier TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    )`);

    db.run(`INSERT INTO schema_version (version) VALUES (1)`);
    version = 1;
    console.log('  📦 Schema v1: base tables');
  }

  // --- v2: Casino credentials & sites ---
  if (version < 2) {
    // Add casino_credentials JSON column to customers
    try {
      db.run(`ALTER TABLE customers ADD COLUMN casino_credentials TEXT DEFAULT '[]'`);
    } catch(e) {
      // Column may already exist
    }

    // Sites master list (from scraper config)
    db.run(`CREATE TABLE IF NOT EXISTS sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      category TEXT DEFAULT 'casino',
      status TEXT DEFAULT 'active',
      has_bonuses INTEGER DEFAULT 0,
      last_scraped DATETIME,
      bonuses_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Per-user site preferences
    db.run(`CREATE TABLE IF NOT EXISTS customer_sites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      site_id INTEGER NOT NULL,
      enabled INTEGER DEFAULT 1,
      account_username TEXT DEFAULT '',
      account_password TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(customer_id, site_id),
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (site_id) REFERENCES sites(id)
    )`);

    // Auto-registration queue (for Elite tier)
    db.run(`CREATE TABLE IF NOT EXISTS registration_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      site_id INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      account_username TEXT,
      account_password TEXT,
      error_message TEXT,
      attempted_at DATETIME,
      completed_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (site_id) REFERENCES sites(id)
    )`);

    db.run(`INSERT INTO schema_version (version) VALUES (2)`);
    version = 2;
    console.log('  📦 Schema v2: casino credentials, sites, registrations');
  }

  // --- v3: Detailed site fields, pricing periods ---
  if (version < 3) {
    // Add detailed fields to sites
    try {
      db.run(`ALTER TABLE sites ADD COLUMN merchant_name TEXT DEFAULT ''`);
      db.run(`ALTER TABLE sites ADD COLUMN http_status INTEGER`);
      db.run(`ALTER TABLE sites ADD COLUMN bonus_total_value REAL DEFAULT 0`);
      db.run(`ALTER TABLE sites ADD COLUMN established TEXT DEFAULT ''`);
      db.run(`ALTER TABLE sites ADD COLUMN software TEXT DEFAULT ''`);
      db.run(`ALTER TABLE sites ADD COLUMN license_info TEXT DEFAULT ''`);
      db.run(`ALTER TABLE sites ADD COLUMN region TEXT DEFAULT 'Australia'`);
      db.run(`ALTER TABLE sites ADD COLUMN min_deposit REAL`);
      db.run(`ALTER TABLE sites ADD COLUMN max_withdrawal REAL`);
      db.run(`ALTER TABLE sites ADD COLUMN currencies TEXT DEFAULT 'AUD'`);
      db.run(`ALTER TABLE sites ADD COLUMN has_mobile INTEGER DEFAULT 0`);
      db.run(`ALTER TABLE sites ADD COLUMN rating REAL`);
      db.run(`ALTER TABLE sites ADD COLUMN tags TEXT DEFAULT ''`);
      db.run(`ALTER TABLE sites ADD COLUMN description TEXT DEFAULT ''`);
      db.run(`ALTER TABLE sites ADD COLUMN error_count INTEGER DEFAULT 0`);
    } catch(e) {
      console.log('  ⚠️  Some site columns already exist (migration safe)');
    }

    db.run(`INSERT INTO schema_version (version) VALUES (3)`);
    version = 3;
    console.log('  📦 Schema v3: detailed site fields');
  }

  save();

  // --- Helper: prepare a statement with bind/get/all/run ---
  db._prepare = (sql) => {
    const stmt = db.prepare(sql);
    return {
      get: (...params) => {
        stmt.bind(params);
        if (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          const obj = {};
          cols.forEach((c, i) => { obj[c] = vals[i]; });
          stmt.reset();
          return obj;
        }
        stmt.reset();
        return undefined;
      },
      all: (...params) => {
        const results = [];
        stmt.bind(params);
        while (stmt.step()) {
          const cols = stmt.getColumnNames();
          const vals = stmt.get();
          const obj = {};
          cols.forEach((c, i) => { obj[c] = vals[i]; });
          results.push(obj);
        }
        stmt.reset();
        return results;
      },
      run: (...params) => {
        stmt.bind(params);
        stmt.step();
        stmt.reset();
        save();
        return { changes: db.getRowsModified() };
      },
    };
  };

  db._run = (sql, params = []) => {
    db.run(sql, params);
    save();
  };

  return db;
}

module.exports = { 
  init, 
  prepare: (sql) => { 
    if (!db) throw new Error('DB not initialized'); 
    return db._prepare(sql); 
  }, 
  run: (sql, params) => { 
    if (!db) throw new Error('DB not initialized'); 
    db.run(sql, params); 
    save();
  },
  // Expose db for admin operations
  getDb: () => db,
};
