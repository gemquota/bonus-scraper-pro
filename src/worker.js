/**
 * Background Worker — processes registration queue and syncs scraper data.
 * 
 * Run: node src/worker.js
 * This runs continuously, polling for pending registrations and data syncs.
 */
const path = require('path');
const fs = require('fs');

// Initialize DB
const db = require('./db');

const SCRAPER_DB_PATH = '/data/data/com.termux/files/home/dev/codex/golf/data/base.db';
const POLL_INTERVAL = 10000; // 10 seconds

async function main() {
  await db.init();
  console.log('🧠 Background worker started');
  
  // Start polling loops
  syncScraperData();
  processRegistrations();
  
  // Keep alive
  setInterval(() => {}, 60000);
}

// --- Sync Scraper Data ---
async function syncScraperData() {
  const syncInterval = 5 * 60 * 1000; // every 5 minutes
  
  async function sync() {
    try {
      if (!fs.existsSync(SCRAPER_DB_PATH)) return;
      
      // Read scraper's SQLite DB
      const initSqlJs = require('sql.js');
      const SQL = await initSqlJs();
      const scraperDb = new SQL.Database(fs.readFileSync(SCRAPER_DB_PATH));
      
      // Get all site data from scraper
      const stmt = scraperDb.prepare(`
        SELECT t.u as url, t.m as merchant_name, t.ts as last_scraped, t.ec as http_status,
          (SELECT COUNT(*) FROM b WHERE b.u = t.u) as bonus_count,
          (SELECT COALESCE(SUM(pv), 0) FROM b WHERE b.u = t.u) as bonus_value
        FROM t
      `);
      
      const updates = [];
      while (stmt.step()) {
        const row = stmt.getAsObject();
        updates.push(row);
      }
      stmt.free();
      scraperDb.close();
      
      // Batch update our sites table
      const rawDb = db.getDb();
      rawDb.run('BEGIN TRANSACTION');
      
      const updateStmt = rawDb.prepare(`
        UPDATE sites SET 
          merchant_name = ?,
          last_scraped = ?,
          http_status = ?,
          bonuses_count = ?,
          bonus_total_value = ?,
          has_bonuses = CASE WHEN ? > 0 THEN 1 ELSE 0 END
        WHERE url = ?
      `);
      
      let synced = 0;
      for (const u of updates) {
        if (!u.url) continue;
        try {
          updateStmt.run([
            u.merchant_name || '',
            u.last_scraped || null,
            u.http_status || null,
            u.bonus_count || 0,
            u.bonus_value || 0,
            u.bonus_count || 0,
            u.url
          ]);
          synced++;
        } catch(e) {}
      }
      updateStmt.free();
      rawDb.run('COMMIT');
      
      // Save DB
      fs.writeFileSync(
        path.join(__dirname, '..', 'data', 'app.db'),
        Buffer.from(rawDb.export())
      );
      
      if (synced > 0) {
        console.log(`📡 Synced ${synced} sites from scraper`);
      }
    } catch(e) {
      console.error('❌ Sync error (will retry):', e.message);
    }
  }
  
  // Immediate first sync, then interval
  await sync();
  setInterval(sync, syncInterval);
}

// --- Process Registrations ---
async function processRegistrations() {
  async function process() {
    try {
      const rawDb = db.getDb();
      
      // Get pending registrations
      const pending = rawDb.exec(`
        SELECT rq.id, rq.customer_id, rq.site_id, rq.account_username, rq.account_password,
               s.url, s.name 
        FROM registration_queue rq 
        JOIN sites s ON rq.site_id = s.id 
        WHERE rq.status = 'pending' 
        ORDER BY rq.id ASC 
        LIMIT 5
      `);
      
      if (pending.length === 0 || !pending[0].values.length) return;
      
      for (const row of pending[0].values) {
        const [id, customerId, siteId, username, password, siteUrl, siteName] = row;
        
        // Mark as processing
        rawDb.run('UPDATE registration_queue SET status = ?, attempted_at = datetime(\'now\') WHERE id = ?', 
          ['processing', id]);
        
        try {
          console.log(`  🤖 Registering ${username}@${siteName || siteUrl}...`);
          
          // Attempt registration via HTTP
          const result = await attemptRegistration(siteUrl, username, password);
          
          if (result.success) {
            rawDb.run('UPDATE registration_queue SET status = ?, completed_at = datetime(\'now\') WHERE id = ?',
              ['completed', id]);
            // Save credentials to customer_sites
            rawDb.run(`UPDATE customer_sites SET account_username = ?, account_password = ? 
              WHERE customer_id = ? AND site_id = ?`,
              [username, password, customerId, siteId]);
            console.log(`    ✅ Registered ${username}`);
          } else {
            rawDb.run('UPDATE registration_queue SET status = ?, error_message = ?, completed_at = datetime(\'now\') WHERE id = ?',
              ['failed', result.error || 'Unknown error', id]);
            console.log(`    ❌ Failed ${username}: ${result.error}`);
          }
        } catch(e) {
          rawDb.run('UPDATE registration_queue SET status = ?, error_message = ?, completed_at = datetime(\'now\') WHERE id = ?',
            ['failed', e.message, id]);
        }
      }
      
      // Save DB
      fs.writeFileSync(
        path.join(__dirname, '..', 'data', 'app.db'),
        Buffer.from(rawDb.export())
      );
      
    } catch(e) {
      console.error('❌ Registration error:', e.message);
    }
  }
  
  // Process immediately, then every 30 seconds
  await process();
  setInterval(process, 30000);
}

// --- Registration Attempt ---
async function attemptRegistration(siteUrl, username, password) {
  try {
    const cloudscraper = require('cloudscraper');
    
    // Step 1: Fetch the site homepage
    const html = await cloudscraper.get({ uri: siteUrl, timeout: 15000 });
    
    // Try to extract MERCHANTID from the HTML
    const midMatch = html.match(/var\s+MERCHANTID\s*=\s*["']?(\d+)["']?/);
    if (!midMatch) {
      return { success: false, error: 'Could not find merchant ID on site' };
    }
    const merchantId = midMatch[1];
    
    // Step 2: Attempt registration via API
    const apiUrl = `${siteUrl.replace(/\/$/, '')}/api/v1/index.php`;
    const payload = {
      module: '/users/register',
      mobile: username,
      password: password,
      confirmPassword: password,
      merchantId: merchantId,
      currencyId: '1', // AUD
    };
    
    const result = await cloudscraper.post({
      uri: apiUrl,
      form: payload,
      timeout: 15000,
      json: true,
    });
    
    if (result && result.status === 'SUCCESS') {
      return { success: true, data: result.data };
    } else {
      return { success: false, error: result?.message || 'Registration failed' };
    }
  } catch (e) {
    return { success: false, error: `Connection error: ${e.message}` };
  }
}

main().catch(e => { console.error('Worker fatal:', e); process.exit(1); });
