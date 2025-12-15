const fs = require('fs');
const en = JSON.parse(fs.readFileSync('frontend/locales/en.json', 'utf8'));
const zh = JSON.parse(fs.readFileSync('frontend/locales/zh-CN.json', 'utf8'));

function getKeys(obj, prefix = '') {
  let keys = [];
  for (const key in obj) {
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys = keys.concat(getKeys(obj[key], prefix + key + '.'));
    } else {
      keys.push(prefix + key);
    }
  }
  return keys;
}

const enKeys = getKeys(en);
const zhKeys = getKeys(zh);
const missing = enKeys.filter(k => !zhKeys.includes(k));
console.log('Missing keys in zh-CN:', missing);
