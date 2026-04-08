const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;
app.use(express.json());

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

// TEST ENDPOINT — visit /api/test-ig?code=DLUWkieNc0u in browser to see raw API response
app.get('/api/test-ig', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.send('Add ?code=YOUR_SHORTCODE to the URL');
  const KEY = process.env.RAPID_KEY;
  const HOST = 'instagram-scraper-stable-api.p.rapidapi.com';
  const results = {};
  // Try every endpoint from your API list
  try {
    const r1 = await fetch(`https://${HOST}/get_media_data_v2.php?media_code=${code}`, {
      headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST }
    });
    results.get_media_data_v2 = { status: r1.status, data: await r1.json() };
  } catch(e) { results.get_media_data_v2 = { error: e.message }; }
  try {
    const postUrl = `https://www.instagram.com/reel/${code}/`;
    const r2 = await fetch(`https://${HOST}/get_media_data.php?reel_post_code_or_url=${encodeURIComponent(postUrl)}&type=reel`, {
      headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST }
    });
    results.get_media_data_reel = { status: r2.status, data: await r2.json() };
  } catch(e) { results.get_media_data_reel = { error: e.message }; }
  try {
    const postUrl = `https://www.instagram.com/p/${code}/`;
    const r3 = await fetch(`https://${HOST}/get_media_data.php?reel_post_code_or_url=${encodeURIComponent(postUrl)}&type=post`, {
      headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST }
    });
    results.get_media_data_post = { status: r3.status, data: await r3.json() };
  } catch(e) { results.get_media_data_post = { error: e.message }; }
  res.send(`<pre style="font-size:12px;padding:2rem;background:#111;color:#0f0;overflow:auto;min-height:100vh">${JSON.stringify(results, null, 2)}</pre>`);
});

// TikTok post — tiktok-scraper2
app.get('/api/tt-post', async (req, res) => {
  const { videoId, videoUrl } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    const url = videoUrl ? decodeURIComponent(videoUrl) : `https://www.tiktok.com/@user/video/${videoId}`;
    const r = await fetch(`https://tiktok-scraper2.p.rapidapi.com/video/info_v2?video_url=${encodeURIComponent(url)}&video_id=${videoId}`, {
      headers: { 'x-rapidapi-key': process.env.RAPID_KEY, 'x-rapidapi-host': 'tiktok-scraper2.p.rapidapi.com' }
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
    const r = await fetch(`https://tiktok-api23.p.rapidapi.com/api/music/info?musicId=${musicId}`, {
      headers: { 'x-rapidapi-key': process.env.RAPID_KEY, 'x-rapidapi-host': 'tiktok-api23.p.rapidapi.com' }
    });
    const data = await r.json();
    console.log('[TT-MUSIC] FULL:', JSON.stringify(data));
    res.json(data);
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// Instagram post — tries both endpoints, returns whichever has data
app.get('/api/ig-post', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  const KEY = process.env.RAPID_KEY;
  const HOST = 'instagram-scraper-stable-api.p.rapidapi.com';
  const hasData = d => {
    const s = JSON.stringify(d||{});
    return s.includes('like') || s.includes('view') || s.includes('username') || s.includes('display_url') || s.includes('thumbnail');
  };
  // Try get_media_data_v2 first
  try {
    const r = await fetch(`https://${HOST}/get_media_data_v2.php?media_code=${code}`, {
      headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST }
    });
    const data = await r.json();
    console.log('[IG v2] status:', r.status, 'FULL:', JSON.stringify(data));
    if (r.ok && hasData(data)) return res.json({ _src: 'v2', ...data });
  } catch(e) { console.error('[IG v2]', e.message); }
  // Fallback: get_media_data with full reel URL
  try {
    const postUrl = `https://www.instagram.com/reel/${code}/`;
    const r = await fetch(`https://${HOST}/get_media_data.php?reel_post_code_or_url=${encodeURIComponent(postUrl)}&type=reel`, {
      headers: { 'x-rapidapi-key': KEY, 'x-rapidapi-host': HOST }
    });
    const data = await r.json();
    console.log('[IG reel] status:', r.status, 'FULL:', JSON.stringify(data));
    if (r.ok && hasData(data)) return res.json({ _src: 'reel', ...data });
  } catch(e) { console.error('[IG reel]', e.message); }
  res.status(404).json({ error: 'No data from any endpoint' });
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
