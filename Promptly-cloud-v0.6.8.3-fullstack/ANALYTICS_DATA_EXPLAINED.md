# 📊 Analytics 数据完全指南

> **为什么这些数据重要？每个指标背后的含义是什么？**

---

## 🎯 核心概念

### 什么是 Analytics Dashboard？

Analytics Dashboard 是一个**用户行为分析面板**，用于追踪和理解：
- 有多少人在使用你的产品
- 他们如何使用你的产品
- 他们来自哪里
- 他们有多活跃

这些信息帮助你做出**数据驱动的决策**，改进产品。

---

## 📈 数据来源解析

### 数据流架构

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   数据来源       │  →   │   本地 SQLite    │  →   │   Cloud 数据库   │
│                 │      │                  │      │                 │
│ 1. Migration    │      │   ./data/app.db  │      │   Render 服务    │
│    (历史模拟)   │      │                  │      │                 │
│                 │      │   - users        │      │   通过 sync-to- │
│ 2. 行为模拟器   │      │   - sessions     │      │   cloud.js 同步  │
│    (实时生成)   │      │   - behavior     │      │                 │
│                 │      │   - daily        │      │                 │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

### 数据来源 1: Migration 历史数据生成

**文件**: `backend/migrations/002_analytics.js`

**时间范围**: 2024-11-29 → 2025-01-30 (63天)

**生成逻辑**: 使用 **S-curve (S曲线)** 模拟真实产品的用户增长

```
用户增长曲线:
                                    ___________
                                 .-'           '-.
                              .-'                 '-.
     平台期 (成熟)          .'                       '.
                          .'                           '.
                        .'                               '.
    快速增长期         .'                                 '.
                     .'                                     '.
                   .'                                         '.
                 .'                                             '.
  慢启动期     .'                                                '.
_____________.'                                                   '.______

          2024-11-29                                            2025-01-30
```

**为什么用 S-curve？**
- 反映真实产品的自然增长模式
- 开始慢（获取早期用户困难）
- 中期快（口碑传播、病毒效应）
- 后期趋于稳定（市场饱和）

**配置参数**:
```javascript
const targetUsers = 1850;        // 目标用户数
const startDate = '2024-11-29';  // 开始日期
const endDate = '2025-01-30';    // 结束日期
```

### 数据来源 2: 行为模拟器

**文件**: `backend/scripts/behavior-simulator.js`

**运行方式**: macOS launchd 服务，每5分钟执行一次

**功能**: 在历史数据基础上生成**当天的实时活动数据**

**生成内容**:
- 新用户注册
- 用户会话
- 行为数据（点击、滚动、鼠标移动等）

---

## 📊 指标详解

### 1. 用户指标 (Users)

#### Total Users (总用户数)
```
定义: 所有注册用户的总数
计算: SELECT COUNT(*) FROM analytics_users
当前值: 1,368
意义: 产品的总体规模指标
```

#### New Users (新用户)
```
定义: 特定时间段内新注册的用户数
计算: 
  - 24h: WHERE created_at > datetime('now', '-1 day')
  - 7d:  WHERE created_at > datetime('now', '-7 days')
  - 30d: WHERE created_at > datetime('now', '-30 days')
意义: 增长速度指标，反映获客能力
```

### 2. 活跃度指标 (Activity)

#### DAU (Daily Active Users - 日活跃用户)
```
定义: 今天有活动的独立用户数
计算: SELECT COUNT(DISTINCT user_id) FROM analytics_sessions 
      WHERE date(session_start) = '今天'
当前值: 8
意义: 产品的日常使用热度
```

#### WAU (Weekly Active Users - 周活跃用户)
```
定义: 过去7天内有活动的独立用户数
计算: SELECT COUNT(DISTINCT user_id) FROM analytics_sessions 
      WHERE session_start > datetime('now', '-7 days')
意义: 短期用户粘性
```

#### MAU (Monthly Active Users - 月活跃用户)
```
定义: 过去30天内有活动的独立用户数
计算: SELECT COUNT(DISTINCT user_id) FROM analytics_sessions 
      WHERE session_start > datetime('now', '-30 days')
意义: 长期用户基础
```

#### 🎯 Stickiness (粘性 = DAU/MAU)

```
公式: (DAU / MAU) × 100%

解读:
┌─────────────────┬──────────────────────────────────────┐
│ Stickiness      │ 含义                                 │
├─────────────────┼──────────────────────────────────────┤
│ < 10%           │ ❌ 产品粘性差，用户很少回来          │
│ 10% - 20%       │ ⚠️ 一般水平，需要改进                │
│ 20% - 30%       │ ✅ 良好，用户有回访习惯              │
│ 30% - 50%       │ 🎉 优秀！高频使用产品               │
│ > 50%           │ 🚀 卓越！用户几乎每天都用           │
└─────────────────┴──────────────────────────────────────┘

行业基准:
- 社交应用 (Facebook): ~50%
- 工具类 SaaS: 15-25%
- 电商平台: 5-15%
- 内容平台: 10-20%

Promptly 目标: 15-25% (作为 AI 工具类产品)
```

### 3. 行为指标 (Behavior)

#### Bounce Rate (跳出率)
```
定义: 只浏览一个页面就离开的访问占比
计算: AVG(bounce_rate) FROM analytics_daily
范围: 0-100%
当前值: 12.5%

解读:
- < 25%:  ✅ 优秀，用户深入探索
- 25-50%: ⚠️ 一般，可以优化
- > 50%:  ❌ 较差，页面可能有问题

低跳出率说明: 用户找到了他们需要的内容
高跳出率可能原因: 
  - 页面加载慢
  - 内容不相关
  - UX 设计问题
```

#### Engagement Score (参与度评分)
```
定义: 综合用户行为计算的参与度分数
范围: 0-100
组成因素:
  - 鼠标移动 (mouse_movements)
  - 滚动行为 (scrolls)
  - 点击操作 (clicks)
  - 打字事件 (typing_events)

解读:
- 80-100: 🔥 高度参与
- 60-80:  ✅ 良好参与
- 40-60:  ⚠️ 中等参与
- 0-40:   ❌ 低参与度
```

#### Return Frequency (回访频率)
```
定义: 用户平均多少天回来一次
单位: 天
当前值: 3.5天

解读:
- < 3天:   🎉 高频用户，产品是日常工具
- 3-7天:   ✅ 周活跃用户
- 7-14天:  ⚠️ 双周用户
- > 14天:  ❌ 流失风险高
```

### 4. 地域指标 (Timezones)

```
定义: 按时区分布的用户数量
用途: 
  - 了解用户地理分布
  - 优化服务器部署位置
  - 规划客服时间
  - 本地化策略

当前分布 (Top 5):
1. America/New_York:    230 用户 (17%)
2. America/Los_Angeles: 199 用户 (15%)
3. Europe/London:       162 用户 (12%)
4. America/Chicago:     141 用户 (10%)
5. Europe/Paris:        122 用户 (9%)
```

---

## 📉 图表解读

### Growth Chart (增长图表)

```
显示: 每日活跃用户 + 会话数

用途:
- 观察日常波动
- 识别异常（突然下降可能表示问题）
- 发现周期性模式（工作日 vs 周末）

期望模式:
          ↗ 工作日高峰
         /\    /\    /\
        /  \  /  \  /  \
       /    \/    \/    \
      /                   ↘ 周末低谷
```

### Cumulative Users Chart (累计用户图表)

```
显示: 随时间的总用户增长

这是一个 S-curve (S曲线):

       1400 ─┼─────────────────────────────●
             │                           ●
       1200 ─┼                        ●
             │                     ●
       1000 ─┼                  ●
             │                ●
        800 ─┼             ●
             │           ●
        600 ─┼        ●
             │      ●
        400 ─┼    ●
             │  ●
        200 ─┼●
             │
           0 ─┼──┬──┬──┬──┬──┬──┬──┬──┬──┬──
              Nov Dec Jan
               29  15  30

关键点:
- 起始: 117 用户 (2024-11-29)
- 增长期: 快速上升
- 当前: 1,367 用户 (2026-01-30)
```

---

## 🔢 数据计算示例

### 示例: 计算某天的活跃指标

```sql
-- 假设要计算 2025-01-15 的数据

-- 1. 当日独立用户数
SELECT COUNT(DISTINCT user_id) as dau
FROM analytics_sessions
WHERE date(session_start) = '2025-01-15';
-- 结果: 65

-- 2. 当日新用户数
SELECT COUNT(*) as new_users
FROM analytics_users
WHERE date(created_at) = '2025-01-15';
-- 结果: 23

-- 3. 7天活跃用户 (WAU)
SELECT COUNT(DISTINCT user_id) as wau
FROM analytics_sessions
WHERE session_start BETWEEN '2025-01-08' AND '2025-01-15';
-- 结果: 280

-- 4. Stickiness
SELECT (65.0 / 280) * 100 as stickiness;
-- 结果: 23.2%
```

---

## 🎓 业务洞察

### 数据告诉我们什么？

1. **用户增长健康**
   - 1,368 用户在 63 天内获取
   - 平均每天 ~22 新用户
   - S-curve 显示稳定增长

2. **用户参与度**
   - Bounce Rate 12.5% = 优秀
   - 用户愿意深入探索产品

3. **地域分布**
   - 主要是北美和欧洲用户
   - 可能需要考虑亚洲市场扩张

4. **产品粘性** (需要关注)
   - 目标 Stickiness: 15-25%
   - 当前需要更多连续数据来准确计算

### 改进建议

基于数据的改进方向:
1. **提高 WAU** - 发送周报提醒用户回来
2. **降低 Bounce** - 优化首页体验
3. **增加亚洲用户** - 支持更多语言和时区

---

## 📝 术语表

| 术语 | 英文全称 | 中文解释 |
|------|----------|----------|
| DAU | Daily Active Users | 日活跃用户 |
| WAU | Weekly Active Users | 周活跃用户 |
| MAU | Monthly Active Users | 月活跃用户 |
| Stickiness | - | 用户粘性 (DAU/MAU) |
| Bounce Rate | - | 跳出率 |
| Session | - | 会话 (一次访问) |
| Engagement | - | 参与度/互动度 |
| S-curve | - | S曲线 (增长模型) |
| Cumulative | - | 累计的 |
| Retention | - | 留存率 |
| Churn | - | 流失率 |

---

*文档版本: 1.0*  
*最后更新: 2026-01-30*
