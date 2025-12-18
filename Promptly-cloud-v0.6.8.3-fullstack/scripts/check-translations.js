const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../frontend/locales');
const enPath = path.join(localesDir, 'en.json');

if (!fs.existsSync(enPath)) {
  console.error('Error: en.json source file not found at', enPath);
  process.exit(1);
}

const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

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

const enKeys = getKeys(enData);
console.log(`Base (English) has ${enKeys.length} keys.`);

const files = fs.readdirSync(localesDir).filter(f => f.endsWith('.json') && f !== 'en.json');

let totalMissing = 0;

files.forEach(file => {
  const filePath = path.join(localesDir, file);
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const localKeys = getKeys(data);
  
  const missing = enKeys.filter(k => !localKeys.includes(k));
  
  if (missing.length > 0) {
    console.log(`\n❌ ${file}: Missing ${missing.length} keys`);
    // Uncomment to see first 5 missing keys
    // console.log(missing.slice(0, 5).map(k => '  - ' + k).join('\n'));
    // console.log('  ...');
    totalMissing += missing.length;
  } else {
    console.log(`\n✅ ${file}: Complete`);
  }
});

if (totalMissing > 0) {
  console.log(`\nTotal missing translations: ${totalMissing}`);
  process.exit(1);
} else {
  console.log('\nAll translations are complete!');
}
