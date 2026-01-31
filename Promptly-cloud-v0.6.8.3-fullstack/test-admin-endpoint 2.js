#!/usr/bin/env node

/**
 * 测试admin端点状态
 * 用于诊断安全检测问题
 */

import fetch from 'node-fetch';

const cloudUrl = process.argv[2] || 'https://promptly-v0-6-cloudtest-cursor-dev.onrender.com';

console.log('════════════════════════════════════════════════════════════');
console.log('🔍 Admin 端点检测');
console.log('════════════════════════════════════════════════════════════');
console.log(`☁️  云端URL: ${cloudUrl}`);
console.log('');

async function testEndpoint() {
  try {
    console.log('【1】测试简单JSON数据...');
    const simpleResponse = await fetch(`${cloudUrl}/api/admin/sync-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Skip-Validation': 'true'
      },
      body: JSON.stringify({
        test: 'simple'
      })
    });
    
    console.log(`    Status: ${simpleResponse.status}`);
    const simpleText = await simpleResponse.text();
    try {
      const data = JSON.parse(simpleText);
      console.log(`    Response: ${JSON.stringify(data).substring(0, 200)}`);
    } catch {
      console.log(`    Response: ${simpleText.substring(0, 200)}`);
    }
    
    console.log('');
    console.log('【2】测试带有analytics用户数据...');
    const analyticsResponse = await fetch(`${cloudUrl}/api/admin/sync-data`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Skip-Validation': 'true'
      },
      body: JSON.stringify({
        analytics: {
          users: [
            {
              id: 'user_1',
              source: 'organic',
              timezone: 'UTC',
              country: 'US',
              device_type: 'desktop',
              browser: 'Chrome',
              is_active: 1,
              created_at: '2025-01-01T00:00:00Z',
              last_active_at: '2025-01-30T12:00:00Z',
              metadata: '{}'
            }
          ]
        }
      })
    });
    
    console.log(`    Status: ${analyticsResponse.status}`);
    const analyticsText = await analyticsResponse.text();
    try {
      const data = JSON.parse(analyticsText);
      console.log(`    Response: ${JSON.stringify(data).substring(0, 200)}`);
    } catch {
      console.log(`    Response: ${analyticsText.substring(0, 200)}`);
    }
    
    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log('✅ 测试完成');
    console.log('');
    console.log('💡 诊断建议:');
    console.log('   - 如果都返回200，说明admin端点工作正常');
    console.log('   - 如果返回400，说明安全检测仍在拦截');
    console.log('   - 如果返回404，说明云端未部署新代码');
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testEndpoint();
