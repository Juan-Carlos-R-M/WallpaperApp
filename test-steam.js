const https = require('https');

function get(label, url, extraHeaders = {}) {
  return new Promise((resolve) => {
    const start = Date.now();
    console.log(`\n=== ${label} ===`);
    const parsed = new URL(url);
    const req = https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/html, */*',
        ...extraHeaders
      },
      timeout: 12000
    }, res => {
      let body = '';
      if ([301,302,303,307,308].includes(res.statusCode)) {
        console.log('REDIRECT ->', res.headers.location?.substring(0, 80));
        resolve(); return;
      }
      res.on('data', c => body += c);
      res.on('end', () => {
        console.log(`${res.statusCode} | ${Date.now()-start}ms | ${body.length} bytes`);
        try {
          const data = JSON.parse(body);
          // Look for workshop file IDs (10 digits)
          const str = JSON.stringify(data);
          const matches = str.match(/\b\d{10}\b/g) || [];
          const uniqueIds = [...new Set(matches)].slice(0, 8);
          console.log('10-digit IDs found:', uniqueIds.length > 0 ? uniqueIds.join(', ') : 'none');
          console.log('Keys:', Object.keys(data).join(', '));
          if (data.response) console.log('response keys:', Object.keys(data.response).join(', '));
        } catch {
          const matches = body.match(/\b\d{10}\b/g) || [];
          const uniqueIds = [...new Set(matches)].slice(0, 8);
          console.log('10-digit IDs in HTML:', uniqueIds.length > 0 ? uniqueIds.join(', ') : 'none');
          console.log('Snippet:', body.substring(0, 200));
        }
        resolve();
      });
    });
    req.on('error', e => { console.log('ERROR:', e.message); resolve(); });
    req.on('timeout', () => { req.destroy(); console.log('TIMEOUT'); resolve(); });
  });
}

async function main() {
  // Can we resolve api.steampowered.com? (we know this works)
  await get('api.steampowered.com DNS check',
    'https://api.steampowered.com/');

  // Try the storefront workshop search for app 431960
  await get('Store workshop search (WE app)',
    'https://store.steampowered.com/search/results/?appid=431960&filter=Workshop&infinite=1&start=0&count=20&action=query');

  // Try the steam workshop API v2 (sometimes public)
  const p = new URLSearchParams({
    appid: '431960', query: '', page: '1', numperpage: '24'
  });
  await get('Workshop search v2',
    `https://api.steampowered.com/IPublishedFileService/QueryFiles/v1/?${p}`);

  // Try GetAllPublishedFileDetails (alternate)
  const p2 = new URLSearchParams({ appid: '431960', page: '1' });
  await get('GetSectionList (no key)',
    `https://api.steampowered.com/ISteamRemoteStorage/GetSectionList/v1/?${p2}`);

  // Try the "Recommended" endpoint
  await get('Workshop recommended',
    `https://api.steampowered.com/IPlayerService/GetRecommendedGamesWithDetails/v1/?appid=431960`);

  // Test: does store.steampowered.com workshop work?
  await get('Store workshop page for WE',
    'https://store.steampowered.com/app/431960/Wallpaper_Engine/#Workshop');
}

main().catch(console.error);
