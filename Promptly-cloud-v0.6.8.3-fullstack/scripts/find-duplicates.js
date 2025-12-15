const fs = require('fs');
const content = fs.readFileSync('frontend/locales/zh-CN.json', 'utf8');

const regex = /"([^"]+)":\s*\{/g;
let match;
const found = new Set();
const duplicates = [];

while ((match = regex.exec(content)) !== null) {
  const key = match[1];
  if (found.has(key)) {
    duplicates.push(key);
  }
  found.add(key);
}

console.log('Duplicate root keys:', duplicates);
