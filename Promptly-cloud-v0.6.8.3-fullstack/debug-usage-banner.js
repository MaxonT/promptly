/**
 * 使用量横幅诊断脚本
 * 
 * 用于诊断为什么使用量统计不更新的问题
 * 
 * 使用方法：
 * node debug-usage-banner.js <your-user-id>
 * 
 * 如果不知道user ID，可以在浏览器控制台运行：
 * const token = localStorage.getItem('promptly.token');
 * const payload = JSON.parse(atob(token.split('.')[1]));
 * console.log('User ID:', payload.sub);
 */

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 获取命令行参数
const userId = process.argv[2];

if (!userId) {
  console.log('❌ 错误：请提供 user ID');
  console.log('\n使用方法：');
  console.log('  node debug-usage-banner.js <your-user-id>');
  console.log('\n如何获取 user ID：');
  console.log('  1. 在浏览器中打开你的网站');
  console.log('  2. 打开开发者工具（F12）');
  console.log('  3. 在 Console 中运行以下代码：');
  console.log('     const token = localStorage.getItem("promptly.token");');
  console.log('     const payload = JSON.parse(atob(token.split(".")[1]));');
  console.log('     console.log("User ID:", payload.sub);');
  process.exit(1);
}

console.log('\n🔍 开始诊断使用量统计问题...\n');
console.log('目标用户:', userId);
console.log('='.repeat(60));

try {
  // 连接数据库
  const dbPath = process.env.SQLITE_PATH || './data/app-v0-7.db';
  console.log(`\n📁 数据库路径: ${dbPath}`);
  
  const db = new Database(dbPath);
  
  // 1. 检查用户是否存在
  console.log('\n1️⃣  检查用户是否存在');
  console.log('-'.repeat(60));
  const user = db.prepare('SELECT id, email, subscription_status, trial_used FROM users WHERE id = ?').get(userId);
  
  if (!user) {
    console.log('❌ 错误：用户不存在！');
    console.log('   可能的原因：');
    console.log('   - User ID 输入错误');
    console.log('   - 用户还未在数据库中创建');
    process.exit(1);
  }
  
  console.log('✅ 用户存在');
  console.log(`   Email: ${user.email}`);
  console.log(`   订阅状态: ${user.subscription_status || 'free'}`);
  console.log(`   是否使用过试用: ${user.trial_used ? '是' : '否'}`);
  
  // 2. 检查 plan_usage 表是否存在
  console.log('\n2️⃣  检查 plan_usage 表');
  console.log('-'.repeat(60));
  
  const tableExists = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='plan_usage'
  `).get();
  
  if (!tableExists) {
    console.log('❌ 错误：plan_usage 表不存在！');
    console.log('   需要运行数据库迁移');
    console.log('   运行命令: npm run migrate');
    process.exit(1);
  }
  
  console.log('✅ plan_usage 表存在');
  
  // 3. 检查今天的使用记录
  console.log('\n3️⃣  检查今天的使用记录');
  console.log('-'.repeat(60));
  
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  console.log(`   今天的日期: ${today}`);
  
  const promptUsage = db.prepare(`
    SELECT COUNT(*) as count
    FROM plan_usage
    WHERE user_id = ? AND feature_type = 'prompt_optimization' AND date = ?
  `).get(userId, today);
  
  const wizardUsage = db.prepare(`
    SELECT COUNT(*) as count
    FROM plan_usage
    WHERE user_id = ? AND feature_type = 'question_wizard' AND date = ?
  `).get(userId, today);
  
  console.log(`   Prompt Optimization 使用次数: ${promptUsage.count}`);
  console.log(`   Question Wizard 使用次数: ${wizardUsage.count}`);
  
  // 4. 显示最近的使用记录
  console.log('\n4️⃣  最近10条使用记录');
  console.log('-'.repeat(60));
  
  const recentUsage = db.prepare(`
    SELECT id, feature_type, date, created_at
    FROM plan_usage
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT 10
  `).all(userId);
  
  if (recentUsage.length === 0) {
    console.log('⚠️  没有任何使用记录');
    console.log('   可能的原因：');
    console.log('   1. 用户还未使用任何功能');
    console.log('   2. recordUsage() 函数没有被调用');
    console.log('   3. recordUsage() 调用失败但错误被忽略了');
  } else {
    console.log(`   找到 ${recentUsage.length} 条记录：`);
    recentUsage.forEach((record, index) => {
      console.log(`   ${index + 1}. ${record.feature_type.padEnd(25)} | ${record.date} | ${new Date(record.created_at).toLocaleString('zh-CN')}`);
    });
  }
  
  // 5. 检查 token 余额
  console.log('\n5️⃣  检查 Token 余额');
  console.log('-'.repeat(60));
  
  const tokenBalances = db.prepare(`
    SELECT bucket, balance
    FROM token_ledger
    WHERE user_id = ?
    ORDER BY bucket
  `).all(userId);
  
  if (tokenBalances.length === 0) {
    console.log('⚠️  没有 token 余额记录');
  } else {
    tokenBalances.forEach(bucket => {
      console.log(`   ${bucket.bucket}: ${bucket.balance} tokens`);
    });
  }
  
  // 6. 模拟 API 返回的数据
  console.log('\n6️⃣  模拟 /api/billing/status 返回的数据');
  console.log('-'.repeat(60));
  
  const mockApiResponse = {
    ok: true,
    plan: user.subscription_status === 'active' || user.subscription_status === 'trialing' ? 'premium' : 'free',
    limits: {
      promptOptimization: {
        daily: 8
      },
      questionWizard: {
        daily: 5
      }
    },
    usage: {
      promptOptimization: promptUsage.count,
      questionWizard: wizardUsage.count
    }
  };
  
  console.log(JSON.stringify(mockApiResponse, null, 2));
  
  // 7. 建议和诊断
  console.log('\n7️⃣  诊断结果和建议');
  console.log('='.repeat(60));
  
  if (recentUsage.length === 0) {
    console.log('\n⚠️  问题诊断：没有使用记录');
    console.log('\n可能的原因：');
    console.log('  1. 后端代码中 recordUsage() 没有被调用');
    console.log('  2. Pipeline 执行失败，没有到达 recordUsage() 调用点');
    console.log('  3. recordUsage() 执行出错但错误被忽略');
    console.log('\n调试步骤：');
    console.log('  1. 打开 Render Dashboard → 后端服务 → Logs');
    console.log('  2. 使用一次 Prompt Optimization 功能');
    console.log('  3. 在日志中搜索：');
    console.log('     "[planLimits] Recording usage"');
    console.log('     "[planLimits] ✅ Usage recorded successfully"');
    console.log('  4. 如果没有这些日志，说明 recordUsage() 没有被调用');
    console.log('  5. 如果有错误日志，查看具体的错误信息');
  } else {
    console.log('\n✅ 使用记录正常');
    console.log('\n前端检查清单：');
    console.log('  1. 打开浏览器开发者工具（F12）→ Console');
    console.log('  2. 使用一次功能');
    console.log('  3. 查看是否有以下日志：');
    console.log('     "[Plan Banner] 🔄 Auth state changed, refreshing banner..."');
    console.log('     "[Plan Banner] API response data: {...}"');
    console.log('     "[Plan Banner] ✅ Showing FREE plan info: X/8 prompts..."');
    console.log('  4. 检查 Network 面板：');
    console.log('     - 查找 /api/billing/status 请求');
    console.log('     - 确认响应数据中 usage.promptOptimization 是否正确');
    console.log('  5. 如果 API 返回数据正确但页面没更新：');
    console.log('     - 检查是否有 JavaScript 错误');
    console.log('     - 确认 window.refreshPlanBanner() 是否被调用');
  }
  
  // 8. 手动测试记录使用
  console.log('\n8️⃣  手动测试记录使用（仅用于测试）');
  console.log('-'.repeat(60));
  console.log('如果要手动添加一条测试记录，可以运行：');
  console.log(`
const testId = 'usage_' + Date.now() + '_test';
db.prepare(\`
  INSERT INTO plan_usage (id, user_id, feature_type, date, created_at)
  VALUES (?, ?, 'prompt_optimization', '${today}', datetime('now'))
\`).run(testId, '${userId}');
console.log('✅ 测试记录已添加');
  `);
  
  db.close();
  
  console.log('\n' + '='.repeat(60));
  console.log('✅ 诊断完成！\n');
  
} catch (err) {
  console.error('\n❌ 诊断过程中发生错误：', err);
  console.error('\n错误详情：', err.message);
  process.exit(1);
}
