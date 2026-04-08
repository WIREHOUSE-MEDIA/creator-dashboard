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

// Instagram post — tries instagram120 first, falls back to instagram-scraper-stable-api
app.get('/api/ig-post', async (req, res) => {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  if (!process.env.RAPID_KEY) return res.status(500).json({ error: 'RAPID_KEY not set' });
  try {
    // Primary: instagram120 POST mediaByShortcode
    const r1 = await fetch(`https://${IG_HOST}/api/instagram/mediaByShortcode`, {
      method: 'POST',
      headers: {
        'x-rapidapi-key': process.env.RAPID_KEY,
        'x-rapidapi-host': IG_HOST,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ shortcode: code })
    });
    const data1 = await r1.json();
    console.log('IG primary status:', r1.status);
    console.log('IG primary FULL response:', JSON.stringify(data1));

    // Check if we got usable data from primary
    const hasData = d => {
      const flat = JSON.stringify(d);
      return flat.includes('like_count') || flat.includes('view_count') ||
             flat.includes('username') || flat.includes('display_url') ||
             flat.includes('thumbnail');
    };

    if (r1.ok && hasData(data1)) {
      return res.json(data1);
    }

    // Fallback: instagram-scraper-stable-api GET get_media_data_v2
    console.log('IG primary had no usable data, trying fallback...');
    const FALLBACK_HOST = 'instagram-scraper-stable-api.p.rapidapi.com';
    const r2 = await fetch(`https://${FALLBACK_HOST}/get_media_data_v2.php?media_code=${code}`, {
      headers: {
        'x-rapidapi-key': process.env.RAPID_KEY,
        'x-rapidapi-host': FALLBACK_HOST,
        'Content-Type': 'application/json'
      }
    });
    const data2 = await r2.json();
    console.log('IG fallback status:', r2.status);
    console.log('IG fallback FULL response:', JSON.stringify(data2));
    res.json(data2);
  } catch(e) {
    console.error('IG error:', e.message);
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
