const https = require('https'); 
const url = 'https://steamcommunity.com/workshop/browse/?appid=431960&browsesort=trend&section=readytouseitems&p=1'; 
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => { 
  let b=''; 
  res.on('data', c=>b+=c); 
  res.on('end', () => { 
    const match = b.match(/"id":"(\d{10})"/g) || b.match(/"publishedfileid":"(\d+)"/g) || b.match(/"publishedfileid":(\d+)/g) || b.match(/publishedfiledetails.*?id.*?(\d+)/i) || b.match(/"id":(\d{10})/g); 
    console.log(match ? match.slice(0, 10) : 'No IDs found in HTML'); 
    
    // Check if there's a JSON payload injected in the HTML
    const jsonMatch = b.match(/application\/json".*?>(.*?)<\/script>/i);
    if (jsonMatch) {
      console.log('Found injected JSON block! Length:', jsonMatch[1].length);
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        console.log('JSON keys:', Object.keys(parsed));
      } catch (e) {}
    }
  }); 
});
