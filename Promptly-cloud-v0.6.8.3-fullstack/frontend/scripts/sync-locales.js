const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '../locales');
const enPath = path.join(localesDir, 'en.json');

if (!fs.existsSync(enPath)) {
  console.error('Error: en.json not found at', enPath);
  process.exit(1);
}

const enData = JSON.parse(fs.readFileSync(enPath, 'utf8'));

function syncKeys(source, target, prefix = '') {
  let changes = 0;
  for (const key in source) {
    const newPrefix = prefix ? `${prefix}.${key}` : key;
    
    if (typeof source[key] === 'object' && source[key] !== null) {
      if (!target[key] || typeof target[key] !== 'object') {
        target[key] = {};
        console.log(`[+] Created object: ${newPrefix}`);
        changes++;
      }
      changes += syncKeys(source[key], target[key], newPrefix);
    } else {
      if (!target.hasOwnProperty(key)) {
        target[key] = `[MISSING] ${source[key]}`;
        console.log(`[+] Added key: ${newPrefix}`);
        changes++;
      }
    }
  }
  return changes;
}

fs.readdirSync(localesDir).forEach(file => {
  if (file === 'en.json' || !file.endsWith('.json')) return;

  const filePath = path.join(localesDir, file);
  let targetData;
  try {
    targetData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) {
    console.error(`Error parsing ${file}, initializing empty object.`);
    targetData = {};
  }

  console.log(`\nSyncing ${file}...`);
  const changes = syncKeys(enData, targetData);

  if (changes > 0) {
    fs.writeFileSync(filePath, JSON.stringify(targetData, null, 2), 'utf8');
    console.log(`Saved ${file} with ${changes} additions.`);
  } else {
    console.log(`No changes for ${file}.`);
  }
});
