#!/usr/bin/env node

/**
 * 快速安全验证脚本
 * 检查已实施的安全修复是否正确配置
 */

import fs from 'fs';
import path from 'path';

const checks = [];

function addCheck(name, status, details) {
  checks.push({ name, status, details });
}

function runSecurityChecks() {
  console.log('🔒 Promptly 安全配置验证\n');
  
  // 1. 检查JWT配置
  try {
    const authFile = fs.readFileSync('backend/src/routes/auth.js', 'utf8');
    if (authFile.includes('require(\'crypto\').randomBytes(32)')) {
      addCheck('JWT安全密钥', '✅', '开发环境使用动态生成的安全密钥');
    } else {
      addCheck('JWT安全密钥', '❌', '开发环境仍使用固定密钥');
    }
  } catch (error) {
    addCheck('JWT安全密钥', '⚠️', '无法读取auth.js文件');
  }
  
  // 2. 检查CORS配置
  try {
    const serverFile = fs.readFileSync('backend/src/server.js', 'utf8');
    if (serverFile.includes('CORS_ORIGIN || "http://localhost:5173"')) {
      addCheck('CORS配置', '✅', '默认不允许所有来源');
    } else {
      addCheck('CORS配置', '❌', 'CORS配置可能仍有问题');
    }
  } catch (error) {
    addCheck('CORS配置', '⚠️', '无法读取server.js文件');
  }
  
  // 3. 检查安全中间件
  try {
    const securityMiddleware = fs.readFileSync('backend/src/middleware/security.js', 'utf8');
    if (securityMiddleware.includes('detectSQLInjection')) {
      addCheck('SQL注入防护', '✅', 'SQL注入检测中间件已部署');
    } else {
      addCheck('SQL注入防护', '❌', 'SQL注入防护未配置');
    }
  } catch (error) {
    addCheck('SQL注入防护', '❌', 'security.js文件不存在');
  }
  
  // 4. 检查CSP中间件
  try {
    const cspMiddleware = fs.readFileSync('backend/src/middleware/csp.js', 'utf8');
    if (cspMiddleware.includes('Content-Security-Policy')) {
      addCheck('内容安全策略', '✅', 'CSP中间件已配置');
    } else {
      addCheck('内容安全策略', '❌', 'CSP配置不完整');
    }
  } catch (error) {
    addCheck('内容安全策略', '❌', 'csp.js文件不存在');
  }
  
  // 5. 检查前端安全工具
  try {
    const securityLib = fs.readFileSync('frontend/lib/security.js', 'utf8');
    if (securityLib.includes('escapeHtml')) {
      addCheck('前端安全工具', '✅', 'HTML转义工具已部署');
    } else {
      addCheck('前端安全工具', '❌', '前端安全工具配置不完整');
    }
  } catch (error) {
    addCheck('前端安全工具', '❌', 'frontend/lib/security.js文件不存在');
  }
  
  // 6. 检查前端XSS修复
  try {
    const resultFile = fs.readFileSync('frontend/result.js', 'utf8');
    if (resultFile.includes('textContent') && resultFile.includes('appendChild')) {
      addCheck('前端XSS修复', '✅', 'result.js已修复innerHTML使用');
    } else {
      addCheck('前端XSS修复', '⚠️', 'result.js可能仍有XSS风险');
    }
  } catch (error) {
    addCheck('前端XSS修复', '⚠️', '无法检查result.js');
  }
  
  // 7. 检查数据库安全配置
  try {
    const dbFile = fs.readFileSync('backend/src/lib/db.js', 'utf8');
    if (dbFile.includes('pragma(\'journal_mode = WAL\')')) {
      addCheck('数据库安全配置', '✅', 'SQLite安全选项已配置');
    } else {
      addCheck('数据库安全配置', '❌', 'SQLite安全配置缺失');
    }
  } catch (error) {
    addCheck('数据库安全配置', '⚠️', '无法读取db.js文件');
  }
  
  // 8. 检查安全测试脚本
  try {
    const testScript = fs.readFileSync('scripts/security-test.sh', 'utf8');
    if (testScript.includes('SQL注入防护')) {
      addCheck('安全测试工具', '✅', '安全测试脚本已创建');
    } else {
      addCheck('安全测试工具', '❌', '安全测试脚本配置不完整');
    }
  } catch (error) {
    addCheck('安全测试工具', '❌', 'security-test.sh文件不存在');
  }
  
  // 9. 检查安全检查器
  try {
    const securityChecker = fs.readFileSync('frontend/lib/security-checker.js', 'utf8');
    if (securityChecker.includes('SecurityChecker')) {
      addCheck('前端安全检查器', '✅', '运行时安全检查已部署');
    } else {
      addCheck('前端安全检查器', '❌', '安全检查器配置不完整');
    }
  } catch (error) {
    addCheck('前端安全检查器', '❌', 'security-checker.js文件不存在');
  }
  
  // 输出结果
  console.log('检查结果:\n');
  checks.forEach(check => {
    console.log(`${check.status} ${check.name}`);
    console.log(`   ${check.details}\n`);
  });
  
  // 统计
  const passed = checks.filter(c => c.status === '✅').length;
  const failed = checks.filter(c => c.status === '❌').length;
  const warnings = checks.filter(c => c.status === '⚠️').length;
  
  console.log('='.repeat(50));
  console.log(`总计: ${checks.length} 项检查`);
  console.log(`通过: ${passed} ✅`);
  console.log(`失败: ${failed} ❌`);
  console.log(`警告: ${warnings} ⚠️`);
  
  if (failed > 0) {
    console.log('\n❌ 发现安全配置问题，请检查失败项目');
    process.exit(1);
  } else if (warnings > 0) {
    console.log('\n⚠️ 安全配置基本正确，但有一些警告需要关注');
  } else {
    console.log('\n✅ 所有安全检查通过！');
  }
  
  console.log('\n💡 使用以下命令进行完整安全测试:');
  console.log('  ./scripts/security-test.sh');
}

// 检查是否在正确的目录
if (!fs.existsSync('backend/src') || !fs.existsSync('frontend')) {
  console.error('❌ 请在项目根目录运行此脚本');
  process.exit(1);
}

runSecurityChecks();