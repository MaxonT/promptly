# Timezone-aware User Usage Refresh Fix

## Problem
Previously, user daily token usage was being refreshed at a fixed UTC time (DAILY_REFRESH_HOUR_UTC), which meant:
- Users in different timezones would have their usage reset at different local times
- A user in Asia/Tokyo would have tokens reset at a different local time than a user in America/New_York
- This caused unfair distribution of daily token limits based on timezone

## Solution
Implemented timezone-aware daily refresh tracking that:
- Stores each user's timezone in the `users` table
- Tracks each user's last refresh date **in their local timezone** (YYYY-MM-DD format)
- Refreshes tokens when the user's **local date changes**, not UTC date
- Works consistently across all timezones

## Changes Made

### 1. Database Schema Updates

#### SQLite (db.js)
Added `user_daily_refresh_tracker` table:
```sql
CREATE TABLE IF NOT EXISTS user_daily_refresh_tracker (
  user_id TEXT PRIMARY KEY,
  last_daily_refresh_date TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id)
);
```

#### PostgreSQL (db-pg.js)
Added same table for PostgreSQL support:
```sql
CREATE TABLE IF NOT EXISTS user_daily_refresh_tracker (
  user_id VARCHAR(255) PRIMARY KEY,
  last_daily_refresh_date VARCHAR(10) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id)
);
```

### 2. Daily Refresh Job (dailyRefreshJob.js)

**Key Changes:**
- `getActiveUsers()`: Now includes user's timezone from the database
- `shouldRefreshUserToday()`: Compares user's local date (via `getLocalDateKey`) with stored `last_daily_refresh_date`
- `markUserRefreshedToday()`: Records user's local date after refresh
- `runDailyRefresh()`: Now checks each user individually based on their timezone
- `shouldRunRefresh()`: Always returns `true` (scheduler runs hourly to catch all timezone changes)
- `startScheduler()`: Still runs every hour, but now checks all users' local dates instead of fixed UTC time

**New Behavior:**
```
Every hour, the scheduler:
1. Gets all active users with their timezones
2. For each user:
   - Calculates their current local date based on timezone
   - Compares with last refresh date in tracker
   - If local date changed → refreshes tokens
   - Updates tracker with new local date
```

### 3. Migration File

Created `backend/migrations/002_timezone_refresh.js` to set up the tracking table:
```bash
node backend/migrations/002_timezone_refresh.js
```

## How It Works

### Example Scenario
**Current time: 2026-02-03 16:30 UTC**

| User | Timezone | Local Time | Local Date | Refresh? |
|------|----------|-----------|-----------|----------|
| Alice | UTC | Feb 3, 16:30 | 2026-02-03 | Compare with last record |
| Bob | America/New_York | Feb 3, 11:30 | 2026-02-03 | Compare with last record |
| Charlie | Asia/Tokyo | Feb 4, 01:30 | 2026-02-04 | Compare with last record |
| Diana | America/Los_Angeles | Feb 3, 08:30 | 2026-02-03 | Compare with last record |

Each user gets tokens reset when **their local midnight** passes (at their local time), regardless of UTC.

## Usage

### Setting User Timezone
Timezones are stored in the `users` table with default 'UTC':

```javascript
// Set during user setup
db.prepare(`
  UPDATE users SET timezone = ? WHERE id = ?
`).run('America/New_York', userId);
```

### Timezone Support
Uses standard IANA timezone format (e.g., 'America/New_York', 'Asia/Tokyo', 'Europe/London').
Validation via `normalizeTimeZone()` in `timezone.js`.

### Testing the Fix

**Manual test:**
```bash
cd backend
node -e "import('./src/lib/dailyRefreshJob.js').then(m => console.log(m.runDailyRefresh()))"
```

**Force refresh all users (clear trackers):**
```bash
cd backend
node -e "import('./src/lib/dailyRefreshJob.js').then(m => console.log(m.forceRefresh()))"
```

## Benefits

✅ **Fair token distribution**: All users get daily tokens at their local midnight
✅ **Transparent timing**: Users understand when their tokens reset (in their timezone)
✅ **Scalable**: Works for any number of timezones
✅ **Backward compatible**: Existing UTC-based system still works, new table tracks local dates
✅ **Database agnostic**: Works with both SQLite and PostgreSQL

## Files Modified

1. `backend/src/lib/dailyRefreshJob.js` - Core refresh logic (timezone-aware)
2. `backend/src/lib/db.js` - SQLite schema (added tracking table)
3. `backend/src/lib/db-pg.js` - PostgreSQL schema (added tracking table)
4. `backend/migrations/002_timezone_refresh.js` - Migration script (new)

## Rollout Checklist

- [x] Database schema updated (SQLite + PostgreSQL)
- [x] Daily refresh job refactored for timezone awareness
- [x] Migration script created
- [x] Tests passed
- [ ] Deploy to staging
- [ ] Test with users in different timezones
- [ ] Monitor token distribution logs
- [ ] Deploy to production

## Notes

- The scheduler runs **every hour** (not just at DAILY_REFRESH_HOUR_UTC)
- This ensures timely refresh for users in all timezones
- No performance impact: queries are indexed on `user_id`
- Old UTC-based configuration `DAILY_REFRESH_HOUR_UTC` is still respected but no longer primary
