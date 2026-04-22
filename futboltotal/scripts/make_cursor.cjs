const fs = require('fs');
const img = fs.readFileSync('c:/Users/segur_1rk8zne/Documents/futotal-main/futboltotal/public/detailed-color-pizza-pack.png');
const b64 = img.toString('base64');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <image href="data:image/png;base64,${b64}" width="64" height="64" />
</svg>`;
fs.writeFileSync('c:/Users/segur_1rk8zne/Documents/futotal-main/futboltotal/public/pizza-cursor.svg', svg);
console.log('Done!');
