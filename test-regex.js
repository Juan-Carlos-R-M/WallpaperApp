const ID_EXTRACTION_REGEX = /(?:sharedfiles\/filedetails\/\?id=|workshopfiledetails\/\?id=|data-publishedfileid=["']?|publishedfileid["']?\s*[:=]\s*["']?)(\d+)/gi;
const fs = require('fs');
const html = fs.readFileSync('steam-dump.html', 'utf8');

const ids = [];
let match;
while ((match = ID_EXTRACTION_REGEX.exec(html)) !== null) {
  ids.push(match[1]);
}
console.log('Matches:', [...new Set(ids)].slice(0, 10));
console.log('Total unique:', new Set(ids).size);
