const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

// Serves all API credentials from Render environment variables.
// Frontend fetches /config on load — no keys stored in the browser.
app.get('/config', (req, res) => {
  res.json({
    firebaseUrl:   process.env.FIREBASE_URL      || '',   // Firebase Realtime DB URL
    rapidKey:      process.env.RAPID_KEY          || '',   // RapidAPI key
    spId:          process.env.SPOTIFY_ID         || '',
    spSec:         process.env.SPOTIFY_SECRET     || '',
    cxId:          process.env.CHARTEX_ID         || '',
    cxToken:       process.env.CHARTEX_TOKEN      || '',
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Running on port ${PORT}`));
