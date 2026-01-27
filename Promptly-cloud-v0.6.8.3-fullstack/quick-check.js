/**
 * 快速检查脚本
 * 
 * 快速验证数据库和后端配置是否正常
 * 
 * 使用方法：
 * node quick-check.js
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import fs from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));

console.log('\n🔍 Promptly 快速健康检查\n');
console.log('='.repeat(60));

let allGood = true;

// 1. 检查数据库文件
console.log('\n1️⃣  数据库文件检查');
console.log('-'.repeat(60));

const dbPath = process.env.SQLITE_PATH || './data/app-v0-7.db';
console.log(`数据库路径: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.log('❌ 数据库文件不存在！');
  console.log('   需要运行: npm run migrate');
  allGood = false;
} else {
  console.log('✅ 数据库文件存在');
  
  try {
    const db = new Database(dbPath);
    
    // 2. 检查必要的表
    console.log('\n2️⃣  数据库表检查');
    console.log('-'.repeat(60));
    
    const requiredTables = [
      'users',
      'plan_usage',
      'token_ledger',
      'subscriptions',
      'specs',
      'runs'
    ];
    
    for (const table of requiredTables) {
      const exists = db.prepare(`
        SELECT name FROM sqlite_master 
        WHERE type='table' AND name=?
      `).get(table);
      
      if (exists) {
        console.log(`✅ ${table.padEnd(20)} 表存在`);
      } else {
        console.log(`❌ ${table.padEnd(20)} 表不存在！`);
        allGood = false;
      }
    }
    
    // 3. 检查 plan_usage 表结构
    console.log('\n3️⃣  plan_usage 表结构检查');
    console.log('-'.repeat(60));
    
    const columns = db.prepare(`PRAGMA table_info(plan_usage)`).all();
    const requiredColumns = ['id', 'user_id', 'feature_type', 'date', 'created_at'];
    
    for (const col of requiredColumns) {
      const exists = columns.some(c => c.name === col);
      if (exists) {
        console.log(`✅ ${col.padEnd(20)} 列存在`);
      } else {
        console.log(`❌ ${col.padEnd(20)} 列不存在！`);
        allGood = false;
      }
    }
    
    // 4. 检查索引
    console.log('\n4️⃣  数据库索引检查');
    console.log('-'.repeat(60));
    
    const indexes = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' AND tbl_name='plan_usage'
    `).all();
    
    if (indexes.length > 0) {
      console.log(`✅ plan_usage 表有 ${indexes.length} 个索引`);
      indexes.forEach(idx => {
        console.log(`   - ${idx.name}`);
      });
    } else {
      console.log('⚠️  plan_usage 表没有索引（性能可能受影响）');
    }
    
    // 5. 统计数据
    console.log('\n5️⃣  数据统计');
    console.log('-'.repeat(60));
    
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    console.log(`用户数量: ${userCount.count}`);
    
    const usageCount = db.prepare('SELECT COUNT(*) as count FROM plan_usage').get();
    console.log(`使用记录数量: ${usageCount.count}`);
    
    const today = new Date().toISOString().split('T')[0];
    const todayUsageCount = db.prepare(`
      SELECT COUNT(*) as count FROM plan_usage WHERE date = ?
    `).get(today);
    console.log(`今天的使用记录: ${todayUsageCount.count}`);
    
    // 6. 最近的使用记录
    console.log('\n6️⃣  最近的使用记录（最多显示 5 条）');
    console.log('-'.repeat(60));
    
    const recentUsage = db.prepare(`
      SELECT u.email, p.feature_type, p.date, p.created_at
      FROM plan_usage p
      LEFT JOIN users u ON p.user_id = u.id
      ORDER BY p.created_at DESC
      LIMIT 5
    `).all();
    
    if (recentUsage.length === 0) {
      console.log('⚠️  还没有任何使用记录');
    } else {
      recentUsage.forEach((record, index) => {
        const email = record.email || '(unknown)';
        const datetime = new Date(record.created_at).toLocaleString('zh-CN');
        console.log(`${index + 1}. ${email.padEnd(25)} | ${record.feature_type.padEnd(25)} | ${datetime}`);
      });
    }
    
    db.close();
    
  } catch (err) {
    console.log('\n❌ 数据库操作失败:', err.message);
    allGood = false;
  }
}

// 7. 检查环境变量
console.log('\n7️⃣  环境变量检查');
console.log('-'.repeat(60));

const requiredEnvVars = {
  'NODE_ENV': process.env.NODE_ENV,
  'OPENAI_API_KEY': process.env.OPENAI_API_KEY ? '✅ 已设置' : '❌ 未设置',
  'JWT_SECRET': process.env.JWT_SECRET ? '✅ 已设置' : '❌ 未设置',
  'SQLITE_PATH': process.env.SQLITE_PATH || '(使用默认值)',
  'CORS_ORIGIN': process.env.CORS_ORIGIN || '(未设置)',
  'FRONTEND_URL': process.env.FRONTEND_URL || '(未设置)'
};

for (const [key, value] of Object.entries(requiredEnvVars)) {
  if (key === 'OPENAI_API_KEY' || key === 'JWT_SECRET') {
    console.log(`${key.padEnd(20)}: ${value}`);
  } else {
    console.log(`${key.padEnd(20)}: ${value}`);
  }
}

// 8. 检查代码文件
console.log('\n8️⃣  关键代码文件检查');
console.log('-'.repeat(60));

const criticalFiles = [
  'backend/src/lib/db.js',
  'backend/src/lib/planLimits.js',
  'backend/src/routes/billing.js',
  'backend/src/routes/pipeline.js',
  'frontend/index.html'
];

for (const file of criticalFiles) {
  if (fs.existsSync(file)) {
    console.log(`✅ ${file}`);
  } else {
    console.log(`❌ ${file} 不存在！`);
    allGood = false;
  }
}

// 9. 检查 recordUsage 是否在正确位置
console.log('\n9️⃣  代码修复验证');
console.log('-'.repeat(60));

try {
  const pipelineCode = fs.readFileSync('backend/src/routes/pipeline.js', 'utf-8');
  
  // 检查是否在 complete 事件后调用 recordUsage
  if (pipelineCode.includes('Recording usage for user') && 
      pipelineCode.includes('recordUsage(userId, \'prompt_optimization\')')) {
    console.log('✅ recordUsage() 在正确的位置（pipeline 成功路径中）');
  } else {
    console.log('⚠️  recordUsage() 位置可能不正确');
    allGood = false;
  }
  
  // 检查是否有详细日志
  if (pipelineCode.includes('[pipeline] [${runId}] Recording usage')) {
    console.log('✅ 添加了详细的调试日志');
  } else {
    console.log('⚠️  缺少详细的调试日志');
  }
  
} catch (err) {
  console.log('⚠️  无法读取 pipeline.js 文件');
}

// 最终结果
console.log('\n' + '='.repeat(60));
if (allGood) {
  console.log('✅ 所有检查通过！系统应该能正常工作。');
  console.log('\n下一步：');
  console.log('1. 如果是本地开发，启动后端：cd backend && npm start');
  console.log('2. 如果是云端部署，推送代码到 Git');
  console.log('3. 使用功能并查看日志，确认 recordUsage 被调用');
} else {
  console.log('❌ 发现问题！请根据上面的提示修复。');
  console.log('\n可能需要：');
  console.log('1. 运行数据库迁移：cd backend && npm run migrate');
  console.log('2. 检查环境变量是否正确配置');
  console.log('3. 确保所有必要的代码文件都存在');
}
console.log('='.repeat(60));
console.log();
