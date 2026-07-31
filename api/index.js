// Vercel serverless entry — boots the Express app per invocation
const createApp = require('../src/index');

let appPromise = null;

module.exports = async function handler(req, res) {
  if (!appPromise) appPromise = createApp();
  const app = await appPromise;
  return app(req, res);
};
