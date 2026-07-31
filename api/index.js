// Vercel serverless entry — boots the Express app per invocation
const createApp = require('../src/index');

let appPromise = null;

module.exports = async function handler(req, res) {
  const t0 = Date.now();
  try {
    if (!appPromise) {
      console.log('BOOT: starting');
      appPromise = createApp().then(app => {
        console.log('BOOT: app ready in', Date.now() - t0, 'ms');
        return app;
      }).catch(err => {
        console.error('BOOT FAILED:', err && err.stack || err);
        throw err;
      });
    }
    const app = await appPromise;
    console.log('HANDLER:', req.method, req.url, '-> app ready in', Date.now() - t0, 'ms');
    return app(req, res);
  } catch (err) {
    console.error('HANDLER ERROR:', err && err.stack || err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error: ' + (err && err.message));
    }
  }
};
