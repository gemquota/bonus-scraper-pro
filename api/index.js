// Vercel serverless entry — boots the Express app per invocation
const createApp = require('../src/index');

let appPromise = null;

module.exports = async function handler(req, res) {
  try {
    if (!appPromise) appPromise = createApp();
    const app = await appPromise;
    return app(req, res);
  } catch (err) {
    console.error('HANDLER ERROR:', err && err.stack || err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error: ' + (err && err.message));
    }
  }
};
