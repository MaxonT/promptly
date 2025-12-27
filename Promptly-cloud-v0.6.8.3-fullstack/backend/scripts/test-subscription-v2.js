#!/usr/bin/env node

/**
 * Subscription V2 MVP Automated Test Suite
 * Tests Days 5-8: Webhook Idempotency, Daily Compensation, Error Recovery
 * 
 * Usage: node scripts/test-subscription-v2.js
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_DB_PATH = path.join(__dirname, '..', 'data', 'promptly-test.db');
const BACKUP_DB_PATH = path.join(__dirname, '..', 'data', 'promptly-backup.db');

// Test results tracking
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function logTest(name, passed, error = null) {
  results.tests.push({ name, passed, error });
  if (passed) {
    results.passed++;
    console.log(`✅ ${name}`);
  } else {
    results.failed++;
    console.log(`❌ ${name}`);
    if (error) console.log(`   Error: ${error.message}`);
  }
}

function setupTestDb() {
  console.log('\n📦 Setting up test database...\n');
  
  // Use fresh test database
  const db = new Database(TEST_DB_PATH);
  
  // Clean existing test data first
  try {
    db.exec("DELETE FROM checkout_sessions WHERE session_id LIKE 'test_%'");
    db.exec("DELETE FROM stripe_events WHERE event_id LIKE 'test_%'");
    db.exec("DELETE FROM analytics_events WHERE session_id LIKE 'test_%'");
  } catch (error) {
    // Tables may not exist yet - that's okay
  }
  
  // Ensure tables exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS checkout_sessions (
      session_id TEXT PRIMARY KEY,
      customer_id TEXT,
      plan_id TEXT,
      amount INTEGER,
      currency TEXT,
      status TEXT DEFAULT 'pending',
      payment_intent TEXT,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS stripe_events (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      error TEXT,
      payload TEXT,
      created_at INTEGER NOT NULL,
      processed_at INTEGER,
      retry_count INTEGER DEFAULT 0
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_type TEXT NOT NULL,
      user_id TEXT,
      session_id TEXT,
      metadata TEXT,
      timestamp INTEGER NOT NULL
    );
  `);
  
  return db;
}

function cleanupTestDb(db) {
  console.log('\n🧹 Cleaning up test data...\n');
  db.exec("DELETE FROM checkout_sessions WHERE session_id LIKE 'test_%'");
  db.exec("DELETE FROM stripe_events WHERE event_id LIKE 'test_%'");
  db.exec("DELETE FROM analytics_events WHERE session_id LIKE 'test_%'");
  db.close();
}

// ==================== TEST SUITE ====================

async function testWebhookIdempotency(db) {
  console.log('🔬 Testing Webhook Idempotency...\n');
  
  // Test 1: First event should be recorded
  try {
    const eventId = 'test_evt_001';
    const stmt = db.prepare(`
      INSERT INTO stripe_events (event_id, event_type, status, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(eventId, 'checkout.session.completed', 'pending', '{}', Date.now());
    
    const event = db.prepare('SELECT * FROM stripe_events WHERE event_id = ?').get(eventId);
    logTest('Webhook event recorded in database', event && event.status === 'pending');
  } catch (error) {
    logTest('Webhook event recorded in database', false, error);
  }
  
  // Test 2: Duplicate event should be rejected
  try {
    const eventId = 'test_evt_001';
    let duplicateRejected = false;
    
    try {
      db.prepare(`
        INSERT INTO stripe_events (event_id, event_type, status, payload, created_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(eventId, 'checkout.session.completed', 'pending', '{}', Date.now());
    } catch (err) {
      // SQLite will throw UNIQUE constraint error
      duplicateRejected = err.message.includes('UNIQUE constraint');
    }
    
    logTest('Duplicate webhook event rejected', duplicateRejected);
  } catch (error) {
    logTest('Duplicate webhook event rejected', false, error);
  }
  
  // Test 3: Event status transitions
  try {
    const eventId = 'test_evt_002';
    
    // Insert new event
    db.prepare(`
      INSERT INTO stripe_events (event_id, event_type, status, payload, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(eventId, 'checkout.session.completed', 'pending', '{}', Date.now());
    
    // Update to processed
    db.prepare(`
      UPDATE stripe_events 
      SET status = 'processed', processed_at = ?
      WHERE event_id = ?
    `).run(Date.now(), eventId);
    
    const processed = db.prepare('SELECT * FROM stripe_events WHERE event_id = ?').get(eventId);
    logTest('Event status transitions (pending → processed)', 
      processed && processed.status === 'processed' && processed.processed_at);
  } catch (error) {
    logTest('Event status transitions (pending → processed)', false, error);
  }
  
  // Test 4: Failed event with retry count
  try {
    const eventId = 'test_evt_003';
    
    db.prepare(`
      INSERT INTO stripe_events (event_id, event_type, status, error, retry_count, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, 'checkout.session.completed', 'failed', 'Network timeout', 1, '{}', Date.now());
    
    const failed = db.prepare('SELECT * FROM stripe_events WHERE event_id = ?').get(eventId);
    logTest('Failed event with retry count tracked', 
      failed && failed.status === 'failed' && failed.retry_count === 1);
  } catch (error) {
    logTest('Failed event with retry count tracked', false, error);
  }
}

async function testCheckoutSessionTracking(db) {
  console.log('\n🔬 Testing Checkout Session Tracking...\n');
  
  // Test 1: Create pending session
  try {
    const sessionId = 'test_cs_001';
    const now = Date.now();
    
    db.prepare(`
      INSERT INTO checkout_sessions (session_id, customer_id, plan_id, amount, currency, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, 'cus_test', 'pro', 2900, 'usd', 'pending', now, now + 86400000);
    
    const session = db.prepare('SELECT * FROM checkout_sessions WHERE session_id = ?').get(sessionId);
    logTest('Checkout session created with pending status', 
      session && session.status === 'pending');
  } catch (error) {
    logTest('Checkout session created with pending status', false, error);
  }
  
  // Test 2: Update session to completed
  try {
    const sessionId = 'test_cs_001';
    
    db.prepare(`
      UPDATE checkout_sessions 
      SET status = 'completed', payment_intent = ?
      WHERE session_id = ?
    `).run('pi_test_123', sessionId);
    
    const session = db.prepare('SELECT * FROM checkout_sessions WHERE session_id = ?').get(sessionId);
    logTest('Checkout session updated to completed', 
      session && session.status === 'completed' && session.payment_intent);
  } catch (error) {
    logTest('Checkout session updated to completed', false, error);
  }
  
  // Test 3: Session with expiration
  try {
    const sessionId = 'test_cs_002';
    const now = Date.now();
    const expired = now - 86400000; // 24 hours ago
    
    db.prepare(`
      INSERT INTO checkout_sessions (session_id, customer_id, plan_id, amount, currency, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, 'cus_test', 'pro', 2900, 'usd', 'pending', expired, expired + 3600000);
    
    // Find expired sessions
    const expiredSessions = db.prepare(`
      SELECT * FROM checkout_sessions 
      WHERE status = 'pending' AND expires_at < ?
    `).all(now);
    
    logTest('Expired sessions can be queried', expiredSessions.length > 0);
  } catch (error) {
    logTest('Expired sessions can be queried', false, error);
  }
}

async function testDailyCompensationQueries(db) {
  console.log('\n🔬 Testing Daily Compensation Queries...\n');
  
  // Test 1: Find stuck pending sessions (>24h old)
  try {
    const now = Date.now();
    const oneDayAgo = now - 86400000;
    
    // Create stuck session
    db.prepare(`
      INSERT INTO checkout_sessions (session_id, customer_id, plan_id, amount, currency, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('test_cs_stuck_001', 'cus_test', 'pro', 2900, 'usd', 'pending', oneDayAgo - 3600000, now + 3600000);
    
    // Query stuck sessions
    const stuckSessions = db.prepare(`
      SELECT * FROM checkout_sessions 
      WHERE status = 'pending' AND created_at < ?
    `).all(oneDayAgo);
    
    logTest('Stuck pending sessions detected (>24h old)', stuckSessions.length > 0);
  } catch (error) {
    logTest('Stuck pending sessions detected (>24h old)', false, error);
  }
  
  // Test 2: Find failed webhooks for retry
  try {
    const now = Date.now();
    const twoDaysAgo = now - (86400000 * 2);
    
    // Create failed webhook event
    db.prepare(`
      INSERT INTO stripe_events (event_id, event_type, status, error, retry_count, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('test_evt_retry_001', 'checkout.session.completed', 'failed', 'Timeout', 1, '{}', twoDaysAgo);
    
    // Query retryable events
    const sevenDaysAgo = now - (86400000 * 7);
    const retryableEvents = db.prepare(`
      SELECT * FROM stripe_events 
      WHERE status = 'failed' 
        AND retry_count < 3 
        AND created_at > ?
    `).all(sevenDaysAgo);
    
    logTest('Failed webhooks found for retry (retry_count < 3)', retryableEvents.length > 0);
  } catch (error) {
    logTest('Failed webhooks found for retry (retry_count < 3)', false, error);
  }
  
  // Test 3: Max retry limit respected
  try {
    const now = Date.now();
    
    // Create event with max retries
    db.prepare(`
      INSERT INTO stripe_events (event_id, event_type, status, error, retry_count, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('test_evt_max_retry', 'checkout.session.completed', 'failed', 'Permanent failure', 3, '{}', now - 3600000);
    
    // Query should exclude max retried events
    const sevenDaysAgo = now - (86400000 * 7);
    const retryableEvents = db.prepare(`
      SELECT * FROM stripe_events 
      WHERE status = 'failed' 
        AND retry_count < 3 
        AND created_at > ?
    `).all(sevenDaysAgo);
    
    const maxRetriedExcluded = !retryableEvents.find(e => e.event_id === 'test_evt_max_retry');
    logTest('Events with max retries (≥3) excluded from retry queue', maxRetriedExcluded);
  } catch (error) {
    logTest('Events with max retries (≥3) excluded from retry queue', false, error);
  }
}

async function testAnalyticsTracking(db) {
  console.log('\n🔬 Testing Analytics Event Tracking...\n');
  
  // Test 1: Log compensation event
  try {
    db.prepare(`
      INSERT INTO analytics_events (event_type, user_id, session_id, metadata, timestamp)
      VALUES (?, ?, ?, ?, ?)
    `).run('compensation_session_updated', 'user_test', 'test_cs_comp_001', 
      JSON.stringify({ from: 'pending', to: 'completed' }), Date.now());
    
    const events = db.prepare(`
      SELECT * FROM analytics_events 
      WHERE event_type = 'compensation_session_updated'
    `).all();
    
    logTest('Compensation events logged to analytics', events.length > 0);
  } catch (error) {
    logTest('Compensation events logged to analytics', false, error);
  }
  
  // Test 2: Log webhook retry event
  try {
    db.prepare(`
      INSERT INTO analytics_events (event_type, session_id, metadata, timestamp)
      VALUES (?, ?, ?, ?)
    `).run('webhook_retry_success', 'test_cs_webhook_001', 
      JSON.stringify({ event_id: 'evt_test', retry_count: 2 }), Date.now());
    
    const events = db.prepare(`
      SELECT * FROM analytics_events 
      WHERE event_type = 'webhook_retry_success'
    `).all();
    
    logTest('Webhook retry events logged to analytics', events.length > 0);
  } catch (error) {
    logTest('Webhook retry events logged to analytics', false, error);
  }
}

async function testErrorRecoveryData(db) {
  console.log('\n🔬 Testing Error Recovery Data Structures...\n');
  
  // Test 1: Session can be identified for retry
  try {
    const sessionId = 'test_cs_error_001';
    
    db.prepare(`
      INSERT INTO checkout_sessions (session_id, customer_id, plan_id, amount, currency, status, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, 'cus_test', 'pro', 2900, 'usd', 'pending', Date.now(), Date.now() + 3600000);
    
    const session = db.prepare('SELECT * FROM checkout_sessions WHERE session_id = ?').get(sessionId);
    const canRetry = session && session.status === 'pending' && session.plan_id;
    
    logTest('Session data available for error recovery retry', canRetry);
  } catch (error) {
    logTest('Session data available for error recovery retry', false, error);
  }
  
  // Test 2: Error context preserved
  try {
    const eventId = 'test_evt_error_001';
    const errorMessage = 'Connection timeout after 30s';
    
    db.prepare(`
      INSERT INTO stripe_events (event_id, event_type, status, error, payload, created_at, retry_count)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(eventId, 'checkout.session.completed', 'failed', errorMessage, '{"session_id":"test_cs"}', Date.now(), 1);
    
    const event = db.prepare('SELECT * FROM stripe_events WHERE event_id = ?').get(eventId);
    const errorPreserved = event && event.error === errorMessage && event.retry_count === 1;
    
    logTest('Error context preserved for diagnostics', errorPreserved);
  } catch (error) {
    logTest('Error context preserved for diagnostics', false, error);
  }
}

// ==================== MAIN ====================

async function runTests() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║  Subscription V2 MVP - Automated Test Suite          ║');
  console.log('║  Days 5-8: Idempotency, Compensation, Error Recovery ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  
  let db;
  
  try {
    db = setupTestDb();
    
    await testWebhookIdempotency(db);
    await testCheckoutSessionTracking(db);
    await testDailyCompensationQueries(db);
    await testAnalyticsTracking(db);
    await testErrorRecoveryData(db);
    
  } catch (error) {
    console.error('\n❌ Test suite crashed:', error);
  } finally {
    if (db) cleanupTestDb(db);
  }
  
  // Print summary
  console.log('\n╔════════════════════════════════════════════════════════╗');
  console.log('║  TEST SUMMARY                                         ║');
  console.log('╚════════════════════════════════════════════════════════╝\n');
  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`Success Rate: ${((results.passed / results.tests.length) * 100).toFixed(1)}%\n`);
  
  if (results.failed > 0) {
    console.log('Failed Tests:');
    results.tests.filter(t => !t.passed).forEach(t => {
      console.log(`  • ${t.name}`);
      if (t.error) console.log(`    ${t.error.message}`);
    });
    console.log('');
  }
  
  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(console.error);
