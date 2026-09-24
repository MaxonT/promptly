# 📊 数据规范化与历史数据处理指南

> **模板版本**: 2.0.0  
> **目标读者**: 数据工程师、后端开发者

本指南详细说明如何处理 Analytics Dashboard 的 **历史数据生成、规范化、迁移、同步**。

---

## 目录

1. [数据规范化概述](#1-数据规范化概述)
2. [历史数据生成策略](#2-历史数据生成策略)
3. [S-曲线增长模型](#3-s-曲线增长模型)
4. [数据一致性保证](#4-数据一致性保证)
5. [跨环境数据同步](#5-跨环境数据同步)
6. [数据验证检查清单](#6-数据验证检查清单)

---

## 1. 数据规范化概述

### 1.1 为什么需要规范化？

Analytics Dashboard 面临的常见数据问题：

| 问题 | 症状 | 解决方案 |
|------|------|---------|
| **时间断层** | 数据有空白期，指标计算失真 | 填充缺失日期 |
| **数量级不一致** | DAU=100, MAU=50 (不合理) | 交叉验证修正 |
| **精度丢失** | 8.40% 显示为 8.4% | 字符串格式保留 |
| **时区混乱** | 同一用户不同时区记录 | 统一时区处理 |

### 1.2 规范化原则

```
┌─────────────────────────────────────────────────────────────┐
│                    数据规范化金字塔                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    ┌───────────────┐                        │
│                    │   业务语义    │ ← 指标定义一致          │
│                    │   正确性      │                        │
│                    └───────┬───────┘                        │
│               ┌────────────┴────────────┐                   │
│               │      数据完整性          │ ← 无断层、无重复   │
│               │                          │                   │
│               └────────────┬────────────┘                   │
│          ┌─────────────────┴─────────────────┐              │
│          │          技术一致性                 │ ← 类型、精度  │
│          │                                     │              │
│          └─────────────────────────────────────┘             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 历史数据生成策略

### 2.1 数据生成场景

| 场景 | 需求 | 推荐方案 |
|------|------|---------|
| **新产品演示** | 展示完整 dashboard | 完全模拟数据 |
| **测试环境** | 功能验证 | 小规模模拟 |
| **迁移上线** | 保留历史 | 真实数据 + 补全 |
| **灾难恢复** | 重建分析能力 | 从日志重建 |

### 2.2 生成时间范围

推荐时间范围配置：

```javascript
// config/data-generation.js

const GENERATION_CONFIG = {
  // 时间范围
  startDate: '2024-11-01',    // 建议至少60天历史
  endDate: 'today',            // 动态：当前日期
  
  // 或者使用相对配置
  relativeDays: {
    past: 90,                  // 过去90天
    future: 0                  // 不生成未来数据
  },
  
  // 特殊日期处理
  holidays: [
    '2024-12-25',              // 圣诞节 - 低活跃
    '2025-01-01'               // 新年 - 低活跃
  ],
  
  // 周末系数
  weekendMultiplier: 0.6       // 周末活跃度是工作日的60%
};
```

### 2.3 数据生成顺序

```
Step 1: analytics_users (基础)
   │
   ├── 生成用户ID、创建时间、时区、设备等
   │
   ▼
Step 2: analytics_sessions (依赖 users)
   │
   ├── 为每个用户生成会话
   ├── 确保 session.user_id 存在于 users
   │
   ▼
Step 3: analytics_behavior (依赖 sessions)
   │
   ├── 为每个会话生成行为数据
   ├── 确保 behavior.session_id 存在于 sessions
   │
   ▼
Step 4: analytics_daily (聚合计算)
   │
   ├── 从 users/sessions 聚合每日统计
   ├── 计算 unique_users, total_sessions, bounce_rate
   │
   ▼
Step 5: 验证 & 规范化
```

---

## 3. S-曲线增长模型

### 3.1 模型公式

```
f(x) = L / (1 + e^(-k × (x - x₀)))

其中:
- L  = 目标用户数（渐近线）
- k  = 增长率（斜率）
- x₀ = 拐点天数（增长最快的时间点）
- x  = 距离起始日的天数
```

### 3.2 预设场景

```javascript
// config/growth-scenarios.js

const GROWTH_SCENARIOS = {
  // 🚀 快速增长型 - 病毒式传播的产品
  rapid: {
    name: 'Rapid Growth',
    description: '强势增长，适合有病毒传播机制的产品',
    targetUsers: 5000,
    growthRate: 0.12,
    inflectionDays: 30,
    dailyChurn: 0.02
  },
  
  // 📈 稳定增长型 - 典型 SaaS
  steady: {
    name: 'Steady Growth',
    description: '稳步增长，适合B2B SaaS产品',
    targetUsers: 2000,
    growthRate: 0.08,
    inflectionDays: 45,
    dailyChurn: 0.015
  },
  
  // 🐢 慢热型 - 需要学习曲线的产品
  slow: {
    name: 'Slow Burn',
    description: '缓慢但稳定，适合专业工具',
    targetUsers: 1000,
    growthRate: 0.05,
    inflectionDays: 60,
    dailyChurn: 0.01
  },
  
  // 🎯 自定义
  custom: {
    name: 'Custom',
    description: '根据你的业务预期自定义',
    targetUsers: null,      // 必须配置
    growthRate: null,
    inflectionDays: null,
    dailyChurn: null
  }
};
```

### 3.3 实现代码

```javascript
// lib/sCurveGenerator.js

/**
 * S-曲线用户增长计算器
 */
class SCurveGenerator {
  constructor(config) {
    this.L = config.targetUsers;      // 渐近线
    this.k = config.growthRate;       // 增长率
    this.x0 = config.inflectionDays;  // 拐点
    this.churn = config.dailyChurn || 0;
  }
  
  /**
   * 计算第 day 天的累计用户数
   * @param {number} day - 距离起始日的天数
   * @returns {number} 累计用户数
   */
  cumulativeUsers(day) {
    return Math.round(
      this.L / (1 + Math.exp(-this.k * (day - this.x0)))
    );
  }
  
  /**
   * 计算第 day 天的新增用户数
   * @param {number} day - 距离起始日的天数
   * @returns {number} 当日新增用户
   */
  newUsers(day) {
    const today = this.cumulativeUsers(day);
    const yesterday = day > 0 ? this.cumulativeUsers(day - 1) : 0;
    return Math.max(0, today - yesterday);
  }
  
  /**
   * 计算第 day 天的活跃用户 (考虑流失)
   * @param {number} day - 距离起始日的天数
   * @param {number} retentionDays - 活跃定义天数
   * @returns {number} 活跃用户数
   */
  activeUsers(day, retentionDays = 30) {
    let active = 0;
    for (let d = Math.max(0, day - retentionDays); d <= day; d++) {
      const newOnDay = this.newUsers(d);
      const daysAgo = day - d;
      const retentionRate = Math.pow(1 - this.churn, daysAgo);
      active += newOnDay * retentionRate;
    }
    return Math.round(active);
  }
  
  /**
   * 生成完整的时间序列数据
   * @param {string} startDate - 起始日期 (YYYY-MM-DD)
   * @param {string} endDate - 结束日期 (YYYY-MM-DD)
   * @returns {Array} 每日数据数组
   */
  generateTimeSeries(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const series = [];
    
    let day = 0;
    for (let d = start; d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      series.push({
        date: dateStr,
        day: day,
        newUsers: this.newUsers(day),
        cumulativeUsers: this.cumulativeUsers(day),
        activeUsers: this.activeUsers(day, 30)
      });
      day++;
    }
    
    return series;
  }
}

export { SCurveGenerator, GROWTH_SCENARIOS };
```

---

## 4. 数据一致性保证

### 4.1 约束规则

```javascript
// lib/dataValidator.js

const CONSISTENCY_RULES = {
  // 规则1: DAU ≤ WAU ≤ MAU ≤ Total Users
  activityHierarchy: (data) => {
    const { dau, wau, mau, totalUsers } = data;
    return dau <= wau && wau <= mau && mau <= totalUsers;
  },
  
  // 规则2: 新用户数不能超过总用户数
  newUsersLimit: (data) => {
    const { newLast30d, totalUsers } = data;
    return newLast30d <= totalUsers;
  },
  
  // 规则3: Bounce Rate 在合理范围 (0-100%)
  bounceRateRange: (data) => {
    const { bounceRate } = data;
    return bounceRate >= 0 && bounceRate <= 100;
  },
  
  // 规则4: Stickiness 在合理范围 (0-100%)
  stickinessRange: (data) => {
    const { dau, mau } = data;
    if (mau === 0) return true;
    const stickiness = (dau / mau) * 100;
    return stickiness >= 0 && stickiness <= 100;
  },
  
  // 规则5: 会话数 ≥ 活跃用户数 (因为一个用户可能多会话)
  sessionUserRatio: (data) => {
    const { sessions, activeUsers } = data;
    return sessions >= activeUsers;
  }
};

/**
 * 验证数据一致性
 * @param {Object} data - 要验证的数据
 * @returns {Object} { valid: boolean, errors: string[] }
 */
function validateConsistency(data) {
  const errors = [];
  
  for (const [ruleName, validator] of Object.entries(CONSISTENCY_RULES)) {
    try {
      if (!validator(data)) {
        errors.push(`Failed: ${ruleName}`);
      }
    } catch (e) {
      errors.push(`Error in ${ruleName}: ${e.message}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}
```

### 4.2 自动修正

```javascript
// lib/dataCorrector.js

/**
 * 自动修正不一致的数据
 * @param {Object} data - 原始数据
 * @returns {Object} 修正后的数据
 */
function autoCorrectData(data) {
  const corrected = { ...data };
  
  // 修正1: 确保 DAU ≤ WAU ≤ MAU
  if (corrected.wau < corrected.dau) {
    corrected.wau = Math.round(corrected.dau * 1.5);
  }
  if (corrected.mau < corrected.wau) {
    corrected.mau = Math.round(corrected.wau * 2);
  }
  
  // 修正2: Stickiness 估算
  // 如果 Stickiness 不合理，基于行业基准重新计算
  const stickiness = (corrected.dau / corrected.mau) * 100;
  if (stickiness > 50) {
    // 过高，可能是数据问题
    // 假设正常 Stickiness 为 10%，反推 MAU
    corrected.mau = Math.round(corrected.dau / 0.10);
  }
  
  // 修正3: 确保精度
  corrected.bounceRate = parseFloat(corrected.bounceRate).toFixed(2);
  corrected.stickiness = parseFloat(stickiness).toFixed(2);
  
  return corrected;
}
```

---

## 5. 跨环境数据同步

### 5.1 同步架构

```
┌──────────────┐     sync-to-cloud.js     ┌──────────────┐
│   本地开发    │ ─────────────────────▶  │   云端生产    │
│  SQLite DB   │                          │  SQLite/PG   │
└──────────────┘                          └──────────────┘
       │                                         │
       │                                         │
       ▼                                         ▼
   localhost:8080                    example.onrender.com
```

### 5.2 同步脚本

```javascript
// scripts/sync-to-cloud.js

/**
 * 数据同步脚本 - 分批发送模式
 * 
 * 使用: node scripts/sync-to-cloud.js <cloud-url>
 * 例如: node scripts/sync-to-cloud.js https://myapp.onrender.com
 */

const BATCH_SIZE = 300;  // 每批记录数，避免请求过大

async function syncData(cloudUrl) {
  // 1. 连接本地数据库
  const db = new Database('./data/app.db');
  
  // 2. 导出数据
  const data = {
    users: db.prepare('SELECT * FROM analytics_users').all(),
    sessions: db.prepare('SELECT * FROM analytics_sessions').all(),
    behavior: db.prepare('SELECT * FROM analytics_behavior').all(),
    daily: db.prepare('SELECT * FROM analytics_daily').all()
  };
  
  console.log(`📊 本地数据: ${data.users.length} users, ${data.sessions.length} sessions`);
  
  // 3. 分批发送
  for (const [tableName, records] of Object.entries(data)) {
    const batches = Math.ceil(records.length / BATCH_SIZE);
    console.log(`📤 同步 ${tableName} (${batches} 批)...`);
    
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await sendBatch(cloudUrl, { [tableName]: batch });
      console.log(`   [${Math.min(i + BATCH_SIZE, records.length)}/${records.length}]`);
    }
  }
  
  console.log('✅ 同步完成!');
}
```

### 5.3 云端接收端点

```javascript
// routes/admin.js

/**
 * POST /api/admin/sync-data
 * 接收同步数据
 */
router.post('/sync-data', (req, res) => {
  const { users, sessions, behavior, daily } = req.body.analytics || req.body;
  
  let count = 0;
  
  // 使用 INSERT OR REPLACE 处理重复
  if (users?.length) {
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO analytics_users 
      (user_id, created_at, timezone, device_type, browser, traffic_source)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const u of users) {
      stmt.run(u.user_id, u.created_at, u.timezone, u.device_type, u.browser, u.traffic_source);
      count++;
    }
  }
  
  // ... 类似处理其他表
  
  res.json({ ok: true, count });
});
```

---

## 6. 数据验证检查清单

### 6.1 迁移前检查

```bash
# 检查脚本: scripts/validate-data.sh

#!/bin/bash
echo "=== Analytics 数据验证 ==="

# 1. 表结构检查
sqlite3 data/app.db ".schema analytics_users"
sqlite3 data/app.db ".schema analytics_sessions"

# 2. 数据量检查
echo "📊 数据量统计:"
sqlite3 data/app.db "SELECT 'users', COUNT(*) FROM analytics_users
                     UNION SELECT 'sessions', COUNT(*) FROM analytics_sessions
                     UNION SELECT 'behavior', COUNT(*) FROM analytics_behavior
                     UNION SELECT 'daily', COUNT(*) FROM analytics_daily"

# 3. 时间范围检查
echo "📅 时间范围:"
sqlite3 data/app.db "SELECT MIN(created_at), MAX(created_at) FROM analytics_users"

# 4. 一致性检查
echo "⚠️ 孤立会话 (无对应用户):"
sqlite3 data/app.db "SELECT COUNT(*) FROM analytics_sessions 
                     WHERE user_id NOT IN (SELECT user_id FROM analytics_users)"

# 5. 空白日期检查
echo "📆 检查日期连续性..."
```

### 6.2 迁移后验证

```javascript
// scripts/post-migration-check.js

async function postMigrationCheck(apiUrl) {
  const response = await fetch(`${apiUrl}/api/analytics/dashboard/summary`);
  const data = await response.json();
  
  const checks = [
    {
      name: 'Total Users > 0',
      pass: data.users.total > 0
    },
    {
      name: 'DAU ≤ MAU',
      pass: data.activity.dau <= data.activity.mau
    },
    {
      name: 'Stickiness 合理 (0-50%)',
      pass: parseFloat(data.activity.dau_mau_ratio) >= 0 && 
            parseFloat(data.activity.dau_mau_ratio) <= 50
    },
    {
      name: 'Bounce Rate 合理 (0-100%)',
      pass: parseFloat(data.behavior.bounceRate) >= 0 && 
            parseFloat(data.behavior.bounceRate) <= 100
    },
    {
      name: 'Timezone 数据存在',
      pass: data.timezones && data.timezones.length > 0
    }
  ];
  
  console.log('=== 迁移后验证 ===');
  for (const check of checks) {
    console.log(`${check.pass ? '✅' : '❌'} ${check.name}`);
  }
  
  const allPass = checks.every(c => c.pass);
  console.log(`\n结果: ${allPass ? '✅ 全部通过' : '❌ 存在问题'}`);
}
```

---

## 📎 附录

### A. 常见数据问题排查

| 症状 | 可能原因 | 解决方案 |
|------|---------|---------|
| DAU=0 | 无当日会话数据 | 检查数据同步、时区 |
| Stickiness=100% | MAU计算错误 | 检查日期范围 |
| Stickiness<1% | 数据断层 | 补全历史数据 |
| Bounce Rate=0% | page_views字段缺失 | 检查数据采集 |

### B. 数据精度规范

| 指标 | 数据类型 | 精度要求 |
|------|---------|---------|
| 用户数 | INTEGER | 精确 |
| 百分比 | STRING | 2位小数 ("8.40") |
| 时间戳 | ISO8601 | 毫秒级 |
| ID | STRING | 带前缀 (au_, as_) |

---

> 📌 **维护说明**: 任何数据结构变更需更新本文档并通知相关团队。
