const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// This endpoint serves all API credentials from Render environment variables.
// The frontend fetches /config on load — no keys are ever stored in the browser.
app.get('/config', (req, res) => {
  res.json({
    rapidKey:  process.env.RAPID_KEY       || '',
    spId:      process.env.SPOTIFY_ID      || '',
    spSec:     process.env.SPOTIFY_SECRET  || '',
    cxId:      process.env.CHARTEX_ID      || '',
    cxToken:   process.env.CHARTEX_TOKEN   || '',
    jbKey:     process.env.JSONBIN_KEY     || '',
    jbBin:     process.env.JSONBIN_BIN     || '',
  });
});

// Serve index.html for all routes (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Creator Dashboard running on port ${PORT}`);
});
