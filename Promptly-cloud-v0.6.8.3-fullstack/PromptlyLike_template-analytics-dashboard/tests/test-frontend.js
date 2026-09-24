#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Analytics Dashboard Frontend Test Script
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * 测试前端配置和基本功能
 * 
 * 用法:
 *   node test-frontend.js [API_BASE]
 * 
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const fs = require('fs');
const path = require('path');

// 配置
const API_BASE = process.argv[2] || 'http://localhost:8080';
const FRONTEND_DIR = path.join(__dirname, '../frontend');

// 颜色
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

// 计数器
let passed = 0;
let failed = 0;
let warnings = 0;

// ═══════════════════════════════════════════════════════════════════════════════
// 测试函数
// ═══════════════════════════════════════════════════════════════════════════════

function test(name, condition, message = '') {
  if (condition) {
    console.log(`${colors.green}✓${colors.reset} ${name}`);
    passed++;
    return true;
  } else {
    console.log(`${colors.red}✗${colors.reset} ${name}${message ? ': ' + message : ''}`);
    failed++;
    return false;
  }
}

function warn(name, message) {
  console.log(`${colors.yellow}⚠${colors.reset} ${name}: ${message}`);
  warnings++;
}

function info(message) {
  console.log(`${colors.blue}ℹ${colors.reset} ${message}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 测试用例
// ═══════════════════════════════════════════════════════════════════════════════

async function runTests() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                   Analytics Dashboard Frontend Tests                          ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  info(`Frontend directory: ${FRONTEND_DIR}`);
  info(`API Base: ${API_BASE}`);
  console.log('');
  console.log('─────────────────────────────────────────────────────────────────────────────────');
  console.log('');
  
  // 1. 检查文件存在
  console.log('File Existence:');
  console.log('');
  
  const requiredFiles = [
    'analytics-dashboard.html',
    'analytics-dashboard.css',
    'analytics-dashboard.js',
    'config.js'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(FRONTEND_DIR, file);
    test(`  ${file} exists`, fs.existsSync(filePath));
  }
  
  console.log('');
  console.log('─────────────────────────────────────────────────────────────────────────────────');
  console.log('');
  
  // 2. HTML 结构检查
  console.log('HTML Structure:');
  console.log('');
  
  const htmlPath = path.join(FRONTEND_DIR, 'analytics-dashboard.html');
  if (fs.existsSync(htmlPath)) {
    const html = fs.readFileSync(htmlPath, 'utf-8');
    
    test('  Has DOCTYPE', html.includes('<!DOCTYPE html>'));
    test('  Has viewport meta', html.includes('viewport'));
    test('  Links to CSS', html.includes('analytics-dashboard.css'));
    test('  Links to JS', html.includes('analytics-dashboard.js'));
    test('  Has Chart.js script', html.includes('chart.js') || html.includes('Chart'));
    test('  Has particles canvas', html.includes('particles'));
    test('  Has metric cards', html.includes('metric-card'));
    test('  Has chart canvas', html.includes('<canvas'));
    
    // 检查关键元素 ID
    const requiredIds = ['total-users', 'dau-value', 'wau-value', 'mau-value'];
    for (const id of requiredIds) {
      test(`  Has #${id} element`, html.includes(`id="${id}"`));
    }
  }
  
  console.log('');
  console.log('─────────────────────────────────────────────────────────────────────────────────');
  console.log('');
  
  // 3. CSS 检查
  console.log('CSS Structure:');
  console.log('');
  
  const cssPath = path.join(FRONTEND_DIR, 'analytics-dashboard.css');
  if (fs.existsSync(cssPath)) {
    const css = fs.readFileSync(cssPath, 'utf-8');
    
    test('  Has CSS variables (:root)', css.includes(':root'));
    test('  Has primary color variable', css.includes('--primary-color'));
    test('  Has glass effect styles', css.includes('backdrop-filter') || css.includes('glass'));
    test('  Has responsive media queries', css.includes('@media'));
    test('  Has particle styles', css.includes('.particle'));
    test('  Has metric card styles', css.includes('.metric-card'));
    test('  Has animation keyframes', css.includes('@keyframes'));
    
    // 统计 CSS 行数
    const lineCount = css.split('\n').length;
    info(`CSS file has ${lineCount} lines`);
    if (lineCount < 500) {
      warn('CSS', 'File seems small, may be missing styles');
    }
  }
  
  console.log('');
  console.log('─────────────────────────────────────────────────────────────────────────────────');
  console.log('');
  
  // 4. JavaScript 检查
  console.log('JavaScript Structure:');
  console.log('');
  
  const jsPath = path.join(FRONTEND_DIR, 'analytics-dashboard.js');
  if (fs.existsSync(jsPath)) {
    const js = fs.readFileSync(jsPath, 'utf-8');
    
    test('  Has API fetch calls', js.includes('fetch'));
    test('  Has Chart.js initialization', js.includes('new Chart') || js.includes('Chart('));
    test('  Has error handling', js.includes('catch') || js.includes('try'));
    test('  Has DOM ready check', js.includes('DOMContentLoaded') || js.includes('onload'));
    test('  Has refresh functionality', js.includes('setInterval') || js.includes('refresh'));
    test('  Has particle initialization', js.includes('particle') || js.includes('Particle'));
    
    // 检查函数定义
    const requiredFunctions = ['loadSummary', 'loadTimeseries', 'updateCharts', 'initParticles'];
    for (const func of requiredFunctions) {
      const hasFunc = js.includes(`function ${func}`) || js.includes(`${func} =`) || js.includes(`${func}(`);
      test(`  Has ${func} function/call`, hasFunc);
    }
  }
  
  console.log('');
  console.log('─────────────────────────────────────────────────────────────────────────────────');
  console.log('');
  
  // 5. Config 检查
  console.log('Config Structure:');
  console.log('');
  
  const configPath = path.join(FRONTEND_DIR, 'config.js');
  if (fs.existsSync(configPath)) {
    const config = fs.readFileSync(configPath, 'utf-8');
    
    test('  Has ANALYTICS_CONFIG', config.includes('ANALYTICS_CONFIG'));
    test('  Has API_BASE setting', config.includes('API_BASE'));
    test('  Has goals configuration', config.includes('goals'));
    test('  Has particle settings', config.includes('particles'));
    test('  Has chart colors', config.includes('color') || config.includes('Color'));
  }
  
  console.log('');
  console.log('─────────────────────────────────────────────────────────────────────────────────');
  console.log('');
  
  // 6. API 连接测试
  console.log('API Connectivity:');
  console.log('');
  
  try {
    const response = await fetch(`${API_BASE}/api/analytics/dashboard/health`);
    const data = await response.json();
    
    test('  API is reachable', response.ok);
    test('  Health check returns ok', data.ok === true);
    test('  Database is connected', data.database === 'connected');
    test('  Tables exist', data.tablesExist === true);
  } catch (error) {
    test('  API is reachable', false, error.message);
  }
  
  console.log('');
  console.log('─────────────────────────────────────────────────────────────────────────────────');
  console.log('');
  
  // 结果汇总
  console.log('╔═══════════════════════════════════════════════════════════════════════════════╗');
  console.log('║                              Test Results                                     ║');
  console.log('╚═══════════════════════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  Total:    ${passed + failed}`);
  console.log(`  Passed:   ${colors.green}${passed}${colors.reset}`);
  console.log(`  Failed:   ${colors.red}${failed}${colors.reset}`);
  console.log(`  Warnings: ${colors.yellow}${warnings}${colors.reset}`);
  console.log('');
  
  if (failed === 0) {
    console.log(`${colors.green}✓ All tests passed!${colors.reset}`);
    process.exit(0);
  } else {
    console.log(`${colors.red}✗ Some tests failed${colors.reset}`);
    process.exit(1);
  }
}

// 运行测试
runTests().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
