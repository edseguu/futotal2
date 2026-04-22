const fs = require('fs');
let svg = fs.readFileSync('c:/Users/segur_1rk8zne/Documents/futotal-main/futboltotal/public/detailed-color-pizza-pack (1).svg', 'utf8');
svg = svg.replace('width="336" height="326"', 'width="64" height="64" viewBox="0 0 336 326"');
fs.writeFileSync('c:/Users/segur_1rk8zne/Documents/futotal-main/futboltotal/public/pizza-cursor.svg', svg);
console.log('done');
