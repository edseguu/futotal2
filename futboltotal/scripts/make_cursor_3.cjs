const fs = require('fs');
let svg = fs.readFileSync('c:/Users/segur_1rk8zne/Documents/futotal-main/futboltotal/public/detailed-color-pizza-pack (1) (1).svg', 'utf8');
// Scale to 96 height, maintain aspect ratio
// Original: 265 x 326. New height: 96. New width: 96 * (265 / 326) ~= 78
svg = svg.replace('width="265" height="326"', 'width="78" height="96" viewBox="0 0 265 326"');
fs.writeFileSync('c:/Users/segur_1rk8zne/Documents/futotal-main/futboltotal/public/pizza-pointer.svg', svg);
console.log('done');
