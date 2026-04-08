const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

const TT_HOST = 'tiktok-scraper2.p.rapidapi.com';
const TT_OLD_HOST = 'tiktok-api23.p.rapidapi.com';
const IG_HOST = 'instagram120.p.rapidapi.com';

app.get('/config', (req, res) => {
  res.json({
    jbKey:    process.env.JSONBIN_KEY    || '',
    jbBin:    process.env.JSONBIN_BIN    || '',
    spId:     process.env.SPOTIFY_ID     || '',
    spSec:    process.env.SPOTIFY_SECRET || '',
    cxId:     process.env.CHARTEX_ID     || '',
    cxToken:  process.env.CHARTEX_TOKEN  || '',
    hasRapid: !!process.env.RAPID_KEY,
  });
});

app.get('/debug', (req, res) => {
  const check = v => v ? `SET (${v.length} chars)` : 'NOT SET';
  res.send(`<pre style="font-size:15px;padding:2rem;background:#111;color:#fff;min-height:100vh">
JSONBIN_KEY     ${check(process.env.JSONBIN_KEY)}
JSONBIN_BIN     ${check(process.env.JSONBIN_BIN)}
RAPID_KEY       ${check(process.env.RAPID_KEY)}
SPOTIFY_ID      ${check(process.env.SPOTIFY_ID)}
SPOTIFY_SECRET  ${check(process.env.SPOTIFY_SECRET)}
CHARTEX_ID      ${check(process.env.CHARTEX_ID)}
CHARTEX_TOKEN   ${check(process.env.CHARTEX_TOKEN)}
  </pre>`);
});

// TikTok post — tiktok-scraper2 /video/info_v2
// Requires both video_url (with real @username) and video_id
app.get('/api/tt-post', async (req, res) => {
  const { videoId, videoUrl } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    // Use the real URL if passed, otherwise construct a best-guess one
    const url = videoUrl ? decodeURIComponent(videoUrl) : `https://www.tiktok.com/@user/video/${videoId}`;
    const apiUrl = `https://${TT_HOST}/video/info_v2?video_url=${encodeURIComponent(url)}&video_id=${videoId}`;
    console.log('TT fetching:', apiUrl);
    const r = await fetch(apiUrl, {
      headers: {
        'x-rapidapi-key': process.env.RAPID_KEY,
        'x-rapidapi-host': TT_HOST,
        'Content-Type': 'application/json'
      }
    });
    const data = await r.json();
    console.log('TT status:', r.status, '| sample:', JSON.stringify(data).slice(0, 300));
    res.json(data);
  } catch(e) {
    console.error('TT error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// TikTok music — tiktok-api23 (best for sound creates count)
app.get('/api/tt-music', async (req, res) => {
  const { musicId } = req.query;
  if (!musicId) return res.status(400).json({ error: 'Missing musicId' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    const r = await fetch(`https://${TT_OLD_HOST}/api/music/info?musicId=${musicId}`, {
      headers: {
        'x-rapidapi-key': process.env.RAPID_KEY,
        'x-rapidapi-host': TT_OLD_HOST,
        'Content-Type': 'application/json'
      }
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Instagram post — instagram120 POST /api/instagram/mediaByShortcode
app.get('/api/ig-post', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    const r = await fetch(`https://${IG_HOST}/api/instagram/mediaByShortcode`, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': process.env.RAPID_KEY,
        'x-rapidapi-host': IG_HOST,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ shortcode: code })
    });
    const data = await r.json();
    // Log full response to Render logs so we can see exact field names
    console.log('IG status:', r.status);
    console.log('IG FULL response:', JSON.stringify(data));
    res.json(data);
  } catch(e) {
    console.error('IG error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Instagram audio creates count — extract reelId from audio URL
// e.g. https://www.instagram.com/reels/audio/123456789/
app.get('/api/ig-audio', async (req, res) => {
  const { audioId } = req.query;
  if (!audioId) return res.status(400).json({ error: 'Missing audioId' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    // instagram120 reels endpoint with audio filter
    const r = await fetch(`https://${IG_HOST}/api/instagram/reels`, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': process.env.RAPID_KEY,
        'x-rapidapi-host': IG_HOST,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ audio_id: audioId, maxId: '' })
    });
    const data = await r.json();
    console.log('IG audio status:', r.status);
    console.log('IG audio FULL response:', JSON.stringify(data).slice(0, 500));
    res.json(data);
  } catch(e) {
    console.error('IG audio error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Proxy CDN images to bypass cross-origin blocks
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');
  try {
    const r = await fetch(decodeURIComponent(url), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.instagram.com/'
      }
    });
    res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    r.body.pipe(res);
  } catch(e) { res.status(500).send(e.message); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Running on port ${PORT}`));
