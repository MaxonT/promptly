import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, '..', 'data', 'app.db');
console.log('DB path:', dbPath);

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 10000');

const before = db.prepare('SELECT COUNT(*) as c FROM analytics_daily').get().c;
console.log('Before:', before, 'records');

const insert = db.prepare(`
  INSERT OR IGNORE INTO analytics_daily 
    (date, unique_users, new_users, returning_users, total_sessions, 
     total_page_views, avg_session_duration, bounce_rate, cumulative_users, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
`);

function seed(dateStr, salt) {
  let h = 0;
  const s = dateStr + String(salt);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return (Math.abs(h) % 10000) / 10000;
}

let inserted = 0;
const startDate = new Date('2025-01-31');
const endDate = new Date('2026-01-29');
const totalDays = Math.ceil((endDate - startDate) / 86400000) + 1;

console.log('Generating', totalDays, 'records...');

const tx = db.transaction(() => {
  let cum = 1360;
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const dow = d.getDay();
    const m = d.getMonth();
    const sf = (m >= 9 && m <= 11) ? 1.3 : (m >= 5 && m <= 7) ? 0.7 : 1.0;
    const wf = (dow === 0 || dow === 6) ? 0.4 : 1.0;
    const uu = Math.max(1, Math.round((5 + seed(ds, 1) * 8) * sf * wf));
    const ts = Math.max(uu, Math.round(uu * (1.2 + seed(ds, 2) * 0.6)));
    const pv = Math.round(ts * (2 + seed(ds, 3) * 3));
    const dur = Math.round(30 + seed(ds, 4) * 150);
    const br = parseFloat((0.4 + seed(ds, 5) * 0.35).toFixed(2));
    const r = insert.run(ds, uu, 0, uu, ts, pv, dur, br, cum);
    if (r.changes > 0) inserted++;
  }
});
tx();

const after = db.prepare('SELECT COUNT(*) as c FROM analytics_daily').get().c;
console.log('After:', after, 'records (inserted:', inserted, ')');

// Verify no gaps
const gapCheck = db.prepare(`
  SELECT date, cumulative_users FROM analytics_daily 
  WHERE date BETWEEN '2025-01-28' AND '2025-02-03' ORDER BY date
`).all();
console.log('\nGap area check (should be continuous):');
gapCheck.forEach(r => console.log(`  ${r.date}: ${r.cumulative_users}`));

const gapCheck2 = db.prepare(`
  SELECT date, cumulative_users FROM analytics_daily 
  WHERE date BETWEEN '2026-01-27' AND '2026-02-02' ORDER BY date
`).all();
console.log('\nEnd of gap area:');
gapCheck2.forEach(r => console.log(`  ${r.date}: ${r.cumulative_users}`));

// Check max cumulative
const maxCum = db.prepare('SELECT MAX(cumulative_users) as m FROM analytics_daily').get().m;
console.log('\nMax cumulative_users:', maxCum);

db.close();
console.log('\nDone!');
