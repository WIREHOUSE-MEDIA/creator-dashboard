const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

const TT_HOST     = 'tiktok-scraper2.p.rapidapi.com';
const TT_MUS_HOST = 'tiktok-api23.p.rapidapi.com';
const IG_HOST     = 'instagram-scraper-stable-api.p.rapidapi.com';

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

// TikTok post — tiktok-scraper2
app.get('/api/tt-post', async (req, res) => {
  const { videoId, videoUrl } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    const url = videoUrl ? decodeURIComponent(videoUrl) : `https://www.tiktok.com/@user/video/${videoId}`;
    const r = await fetch(`https://${TT_HOST}/video/info_v2?video_url=${encodeURIComponent(url)}&video_id=${videoId}`, {
      headers: { 'x-rapidapi-key': process.env.RAPID_KEY, 'x-rapidapi-host': TT_HOST, 'Content-Type': 'application/json' }
    });
    const data = await r.json();
    console.log('[TT-POST] status:', r.status);
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// TikTok music info — tiktok-api23
app.get('/api/tt-music', async (req, res) => {
  const { musicId } = req.query;
  if (!musicId) return res.status(400).json({ error: 'Missing musicId' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    const r = await fetch(`https://${TT_MUS_HOST}/api/music/info?musicId=${musicId}`, {
      headers: { 'x-rapidapi-key': process.env.RAPID_KEY, 'x-rapidapi-host': TT_MUS_HOST, 'Content-Type': 'application/json' }
    });
    const data = await r.json();
    console.log('[TT-MUSIC] FULL:', JSON.stringify(data));
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Instagram post — instagram-statistics-api
// Takes full post URL directly — no shortcode needed
const IG_STATS_HOST = 'instagram-statistics-api.p.rapidapi.com';
app.get('/api/ig-post', async (req, res) => {
  const { postUrl } = req.query;
  if (!postUrl) return res.status(400).json({ error: 'Missing postUrl' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    const url = `https://${IG_STATS_HOST}/posts/one?postUrl=${encodeURIComponent(decodeURIComponent(postUrl))}`;
    console.log('[IG-POST] fetching:', url);
    const r = await fetch(url, {
      headers: {
        'x-rapidapi-key': process.env.RAPID_KEY,
        'x-rapidapi-host': IG_STATS_HOST,
        'Content-Type': 'application/json'
      }
    });
    const data = await r.json();
    console.log('[IG-POST] status:', r.status, '| FULL:', JSON.stringify(data));
    res.json(data);
  } catch(e) { console.error('[IG-POST] error:', e.message); res.status(500).json({ error: e.message }); }
});

// Proxy CDN images — bypass cross-origin blocks
app.get('/api/proxy-image', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('Missing url');
  try {
    const r = await fetch(decodeURIComponent(url), {
      headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.instagram.com/' }
    });
    res.set('Content-Type', r.headers.get('content-type') || 'image/jpeg');
    r.body.pipe(res);
  } catch(e) { res.status(500).send(e.message); }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
