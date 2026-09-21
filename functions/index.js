const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

// Proxy HTTP function that forwards requests to your ML API.
// Set the ML API URL with: `firebase functions:config:set ml.api_url="https://..."`
// Then deploy with `firebase deploy --only functions`
exports.api = functions.https.onRequest(async (req, res) => {
  const mlUrl = (functions.config().ml && functions.config().ml.api_url) || process.env.ML_API_URL;
  if (!mlUrl) {
    res.status(500).send({ error: 'ML API URL not configured. Set functions config ml.api_url.' });
    return;
  }

  // Build target URL: append path (e.g., /predict) and forward query
  const target = mlUrl.replace(/\/$/, '') + req.path;

  try {
    const response = await axios({
      method: req.method,
      url: target,
      data: req.body,
      params: req.query,
      headers: { 'Content-Type': req.get('content-type') || 'application/json' },
      timeout: 15000
    });

    res.status(response.status).send(response.data);
  } catch (err) {
    const status = err.response ? err.response.status : 500;
    const data = err.response ? err.response.data : { message: err.message };
    res.status(status).send(data);
  }
});
