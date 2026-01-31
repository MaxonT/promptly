# 🎯 行业适配指南 (Industry Adaptation Guide)

> **模板版本**: 2.0.0  
> **目标读者**: 产品经理、业务分析师、开发者

本模板设计为 **行业无关** 的通用分析系统。本文档指导如何根据不同行业/产品类型进行定制。

---

## 目录

1. [适配概述](#1-适配概述)
2. [SaaS B2B 产品](#2-saas-b2b-产品)
3. [内容/媒体平台](#3-内容媒体平台)
4. [社区/社交产品](#4-社区社交产品)
5. [电商平台](#5-电商平台)
6. [工具类产品](#6-工具类产品)
7. [快速适配清单](#7-快速适配清单)

---

## 1. 适配概述

### 1.1 什么需要适配？

```
┌─────────────────────────────────────────────────────────────────┐
│                       适配层次模型                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Layer 4: 业务指标    │ 转化率、客单价、内容互动率...            │
│           ───────────┼──────────────────────────────            │
│  Layer 3: 展示配置    │ 哪些卡片显示、目标值设置...              │
│           ───────────┼──────────────────────────────            │
│  Layer 2: 事件定义    │ 什么算"活跃"、什么算"转化"...            │
│           ───────────┼──────────────────────────────            │
│  Layer 1: 基础架构    │ 数据采集、存储、API (通常不需改)         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 适配三步法

```
Step 1: 定义你的"活跃"
   │
   ├── 什么行为算用户活跃？
   ├── 页面浏览？功能使用？交易完成？
   │
   ▼
Step 2: 设置你的目标
   │
   ├── 合理的 DAU/MAU/总用户目标是多少？
   ├── 基于行业基准还是业务计划？
   │
   ▼
Step 3: 选择你的指标
   │
   ├── 核心指标是什么？
   ├── 需要添加哪些行业特定指标？
   │
   ▼
Done: 配置并部署
```

---

## 2. SaaS B2B 产品

### 2.1 产品特点

- 用户生命周期长
- 使用频率因功能而异
- 关注留存和付费转化
- 多角色/团队使用

### 2.2 推荐配置

```javascript
// config/industry/saas-b2b.js

export const SAAS_B2B_CONFIG = {
  // 目标设置
  goals: {
    totalUsers: 2000,        // B2B 用户基数较小
    dailyActiveUsers: 200,   // DAU 目标
    monthlyActiveUsers: 1500 // MAU 目标
  },
  
  // 粘性基准
  stickinessTargets: {
    poor: 5,        // <5% 需要关注
    average: 10,    // 5-15% 正常
    good: 20,       // 15-25% 良好
    excellent: 30   // >25% 优秀
  },
  
  // 活跃定义
  activeDefinition: {
    type: 'feature_usage',  // 基于功能使用
    events: [
      'dashboard_view',
      'report_generate',
      'data_export',
      'settings_update'
    ],
    minimumEvents: 1
  },
  
  // 显示的指标卡片
  visibleMetrics: [
    'dau', 'wau', 'mau',
    'stickiness',           // B2B 核心指标
    'bounce_rate',
    'new_users',
    // 'return_frequency'   // B2B 可选
  ],
  
  // S-曲线参数
  growthScenario: {
    targetUsers: 2000,
    growthRate: 0.06,       // B2B 增长较慢
    inflectionDays: 60
  }
};
```

### 2.3 建议添加的指标

| 指标 | 说明 | 数据来源 |
|------|------|---------|
| **Trial → Paid** | 试用转付费率 | 订阅系统 |
| **MRR/ARR** | 月/年经常性收入 | 计费系统 |
| **Seat Usage** | 席位使用率 | 用户表 |
| **Feature Adoption** | 功能采用率 | 事件追踪 |

---

## 3. 内容/媒体平台

### 3.1 产品特点

- 用户粘性依赖内容质量
- 高 PV，用户时间较长
- 广告收入模式
- 关注停留时长和内容消费

### 3.2 推荐配置

```javascript
// config/industry/content-media.js

export const CONTENT_MEDIA_CONFIG = {
  // 目标设置
  goals: {
    totalUsers: 50000,       // 内容平台需要规模
    dailyActiveUsers: 5000,
    monthlyActiveUsers: 30000
  },
  
  // 粘性基准 (内容平台通常更高)
  stickinessTargets: {
    poor: 10,
    average: 20,
    good: 30,
    excellent: 40
  },
  
  // 活跃定义
  activeDefinition: {
    type: 'content_consumption',
    events: [
      'article_view',
      'video_play',
      'audio_listen',
      'content_scroll_50%'   // 滚动到50%才算
    ],
    minimumEvents: 1,
    minimumDuration: 30      // 至少30秒
  },
  
  // 显示的指标卡片
  visibleMetrics: [
    'dau', 'wau', 'mau',
    'stickiness',
    'session_duration',      // 内容平台核心
    'pages_per_session',     // 内容消费深度
    'bounce_rate',
    'new_users'
  ],
  
  // S-曲线参数
  growthScenario: {
    targetUsers: 50000,
    growthRate: 0.10,        // 内容平台可较快增长
    inflectionDays: 45
  }
};
```

### 3.3 建议添加的指标

| 指标 | 说明 | 数据来源 |
|------|------|---------|
| **Avg. Read Time** | 平均阅读时长 | 行为追踪 |
| **Scroll Depth** | 滚动深度 | 行为追踪 |
| **Content Completion** | 内容完成率 | 事件追踪 |
| **Share Rate** | 分享率 | 社交事件 |

---

## 4. 社区/社交产品

### 4.1 产品特点

- 用户生成内容 (UGC)
- 网络效应驱动增长
- 高互动性要求
- 关注 DAU 和互动频率

### 4.2 推荐配置

```javascript
// config/industry/social-community.js

export const SOCIAL_COMMUNITY_CONFIG = {
  // 目标设置
  goals: {
    totalUsers: 100000,
    dailyActiveUsers: 30000,  // 社交需要高 DAU
    monthlyActiveUsers: 70000
  },
  
  // 粘性基准 (社交产品最高)
  stickinessTargets: {
    poor: 20,
    average: 35,
    good: 50,
    excellent: 60
  },
  
  // 活跃定义
  activeDefinition: {
    type: 'social_interaction',
    events: [
      'post_create',
      'comment_add',
      'like_action',
      'message_send',
      'profile_view'
    ],
    minimumEvents: 2          // 至少2次互动
  },
  
  // 显示的指标卡片
  visibleMetrics: [
    'dau', 'wau', 'mau',
    'stickiness',            // 社交核心指标
    'engagement_rate',       // 互动率
    'new_users',
    'active_creators'        // 活跃创作者
  ],
  
  // S-曲线参数 (社交可能爆发式增长)
  growthScenario: {
    targetUsers: 100000,
    growthRate: 0.15,
    inflectionDays: 30
  }
};
```

### 4.3 建议添加的指标

| 指标 | 说明 | 数据来源 |
|------|------|---------|
| **DAU/MAU** | 粘性 (社交核心) | 计算 |
| **Creator Ratio** | 创作者比例 | 内容表 |
| **Avg. Posts/User** | 人均发帖 | 内容表 |
| **Interaction Rate** | 互动率 | 事件追踪 |
| **Viral Coefficient** | 病毒系数 | 邀请追踪 |

---

## 5. 电商平台

### 5.1 产品特点

- 转化漏斗导向
- 复购率是核心
- 季节性波动大
- GMV 是北极星指标

### 5.2 推荐配置

```javascript
// config/industry/ecommerce.js

export const ECOMMERCE_CONFIG = {
  // 目标设置
  goals: {
    totalUsers: 100000,
    dailyActiveUsers: 8000,
    monthlyActiveUsers: 50000
  },
  
  // 粘性基准 (电商通常较低)
  stickinessTargets: {
    poor: 5,
    average: 10,
    good: 15,
    excellent: 25
  },
  
  // 活跃定义
  activeDefinition: {
    type: 'purchase_intent',
    events: [
      'product_view',
      'add_to_cart',
      'wishlist_add',
      'search_query',
      'checkout_start'
    ],
    minimumEvents: 1
  },
  
  // 显示的指标卡片
  visibleMetrics: [
    'dau', 'wau', 'mau',
    'conversion_rate',       // 电商核心
    'cart_abandonment',      // 购物车放弃率
    'bounce_rate',
    'new_users',
    'returning_customers'    // 复购客户
  ],
  
  // S-曲线参数
  growthScenario: {
    targetUsers: 100000,
    growthRate: 0.08,
    inflectionDays: 50
  }
};
```

### 5.3 建议添加的指标

| 指标 | 说明 | 数据来源 |
|------|------|---------|
| **Conversion Rate** | 转化率 | 订单/访问 |
| **Cart Abandonment** | 购物车放弃率 | 漏斗分析 |
| **AOV** | 平均订单价值 | 订单系统 |
| **Repeat Purchase** | 复购率 | 订单系统 |
| **GMV** | 交易总额 | 订单系统 |

---

## 6. 工具类产品

### 6.1 产品特点

- 任务导向，用完即走
- 频率取决于任务频率
- 效率是核心价值
- 可能是低频高价值

### 6.2 推荐配置

```javascript
// config/industry/utility-tool.js

export const UTILITY_TOOL_CONFIG = {
  // 目标设置 (取决于工具类型)
  goals: {
    totalUsers: 5000,
    dailyActiveUsers: 500,
    monthlyActiveUsers: 3000
  },
  
  // 粘性基准 (工具类通常较低但可接受)
  stickinessTargets: {
    poor: 3,
    average: 8,
    good: 15,
    excellent: 25
  },
  
  // 活跃定义
  activeDefinition: {
    type: 'task_completion',
    events: [
      'tool_use',
      'task_complete',
      'export_action',
      'save_action'
    ],
    minimumEvents: 1
  },
  
  // 显示的指标卡片
  visibleMetrics: [
    'dau', 'wau', 'mau',
    'task_completion_rate',  // 任务完成率
    'time_to_complete',      // 完成时间
    'new_users',
    'power_users'            // 高频用户
  ]
};
```

---

## 7. 快速适配清单

### 7.1 必须配置项

```yaml
# config/template-config.yaml

# 1️⃣ 基础信息
product:
  name: "Your Product Name"
  type: "saas-b2b"  # saas-b2b | content-media | social-community | ecommerce | utility-tool
  
# 2️⃣ 目标设置
goals:
  total_users: 5000
  daily_active_users: 500
  
# 3️⃣ 活跃定义
active_definition:
  type: "feature_usage"
  minimum_events: 1
  events:
    - "page_view"
    - "feature_use"
    
# 4️⃣ 可见指标
visible_metrics:
  - "dau"
  - "wau"
  - "mau"
  - "stickiness"
  - "bounce_rate"
  - "new_users"
```

### 7.2 适配步骤

```
□ Step 1: 确定产品类型
    ├── 选择最接近的行业模板
    └── 复制对应配置文件

□ Step 2: 设置目标值
    ├── 根据业务计划设定 goals
    └── 参考行业基准调整

□ Step 3: 定义活跃行为
    ├── 明确什么算"活跃"
    └── 配置事件列表

□ Step 4: 选择显示指标
    ├── 隐藏不相关的卡片
    └── 添加行业特定指标

□ Step 5: 调整增长模型
    ├── 设置 S-曲线参数
    └── 配置模拟器

□ Step 6: 测试验证
    ├── 生成测试数据
    └── 验证指标计算正确
```

### 7.3 配置文件位置

```
template-analytics-dashboard/
├── config/
│   ├── template-config.js          # 主配置 (必改)
│   ├── goals.js                    # 目标配置
│   ├── metrics.js                  # 指标配置
│   └── industry/                   # 行业预设
│       ├── saas-b2b.js
│       ├── content-media.js
│       ├── social-community.js
│       ├── ecommerce.js
│       └── utility-tool.js
```

---

## 📎 附录

### A. 行业基准速查表

| 行业 | 典型 DAU/MAU | 典型 Bounce | 典型 Session |
|------|-------------|-------------|--------------|
| SaaS B2B | 10-20% | 30-50% | 5-15 min |
| 内容媒体 | 20-35% | 40-60% | 2-8 min |
| 社交社区 | 40-60% | 20-40% | 10-30 min |
| 电商 | 8-15% | 45-65% | 3-8 min |
| 工具 | 5-15% | 30-50% | 2-10 min |

### B. 配置验证清单

- [ ] 目标值是否合理（不过高或过低）
- [ ] 活跃定义是否符合业务逻辑
- [ ] 显示指标是否有业务价值
- [ ] S-曲线参数是否符合预期增长
- [ ] 基准值是否参考行业标准

---

> 📌 **维护说明**: 如需添加新行业支持，请在 `config/industry/` 下创建配置文件并更新本文档。
