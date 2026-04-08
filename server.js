const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

const IG_HOST = 'instagram-looter2.p.rapidapi.com';
const TT_HOST = 'tiktok-scraper2.p.rapidapi.com';
const TT_MUS  = 'tiktok-api23.p.rapidapi.com';

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

// TEST — visit /api/test-ig?code=DLUWkieNc0u to see exact raw response
app.get('/api/test-ig', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send('Add ?code=SHORTCODE — e.g. /api/test-ig?code=DLUWkieNc0u');
  try {
    const postUrl = code.startsWith('http') ? code : `https://www.instagram.com/p/${code}/`;
    const r = await fetch(`https://${IG_HOST}/post?url=${encodeURIComponent(postUrl)}`, {
      headers: { 'x-rapidapi-key': process.env.RAPID_KEY, 'x-rapidapi-host': IG_HOST }
    });
    const data = await r.json();
    res.send(`<pre style="font-size:12px;padding:2rem;background:#111;color:#0f0;overflow:auto;min-height:100vh">STATUS: ${r.status}\n\n${JSON.stringify(data, null, 2)}</pre>`);
  } catch(e) {
    res.send(`<pre style="color:red;padding:2rem">ERROR: ${e.message}</pre>`);
  }
});

// TikTok post — tiktok-scraper2
app.get('/api/tt-post', async (req, res) => {
  const { videoId, videoUrl } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    const url = videoUrl ? decodeURIComponent(videoUrl) : `https://www.tiktok.com/@user/video/${videoId}`;
    const r = await fetch(`https://${TT_HOST}/video/info_v2?video_url=${encodeURIComponent(url)}&video_id=${videoId}`, {
      headers: { 'x-rapidapi-key': process.env.RAPID_KEY, 'x-rapidapi-host': TT_HOST }
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// TikTok music — tiktok-api23
app.get('/api/tt-music', async (req, res) => {
  const { musicId } = req.query;
  if (!musicId) return res.status(400).json({ error: 'Missing musicId' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    const r = await fetch(`https://${TT_MUS}/api/music/info?musicId=${musicId}`, {
      headers: { 'x-rapidapi-key': process.env.RAPID_KEY, 'x-rapidapi-host': TT_MUS }
    });
    const data = await r.json();
    console.log('[TT-MUSIC]', JSON.stringify(data));
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Instagram post — instagram-looter2 GET /post?url=
app.get('/api/ig-post', async (req, res) => {
  const { postUrl } = req.query;
  if (!postUrl) return res.status(400).json({ error: 'Missing postUrl' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    const url = decodeURIComponent(postUrl);
    console.log('[IG-POST] fetching:', url);
    const r = await fetch(`https://${IG_HOST}/post?url=${encodeURIComponent(url)}`, {
      headers: { 'x-rapidapi-key': process.env.RAPID_KEY, 'x-rapidapi-host': IG_HOST }
    });
    const data = await r.json();
    console.log('[IG-POST] status:', r.status);
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Proxy images
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

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
