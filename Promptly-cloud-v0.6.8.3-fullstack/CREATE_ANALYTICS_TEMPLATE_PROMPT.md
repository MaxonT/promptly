# 📊 创建通用 Analytics Dashboard 模板系统 - Prompt

## 🎯 任务目标

将当前 Promptly 产品的完整 analytics dashboard 系统提取为一个**即插即用的通用模板文件夹**，供未来任何产品快速集成使用。

---

## 📦 需要提取的完整系统组件

### 1️⃣ **前端模板** (`template-analytics-dashboard/frontend/`)

#### 核心文件
- `analytics-dashboard.html` - 主仪表盘页面模板
- `analytics-dashboard.css` - 完整样式系统（含玻璃态效果、粒子背景、动画）
- `analytics-dashboard.js` - 前端逻辑、API 调用、图表渲染

#### 设计系统特性
- ✨ Glassmorphism（玻璃态）卡片设计
- 🎨 动态粒子背景（可配置密度和速度）
- 📈 响应式网格布局（自适应手机/平板/桌面）
- 🌈 双渐变背景动画（紫蓝色调可配置）
- 🎯 实时数据更新指示器
- 🔄 平滑过渡动画

#### 数据可视化组件
- 折线图：用户增长趋势、DAU/MAU/WAU
- 环形图：时区分布、流量来源
- 表格：Top 活跃用户、最近会话
- 指标卡：总用户数、活跃度、跳出率

---

### 2️⃣ **后端 API 系统** (`template-analytics-dashboard/backend/`)

#### API 路由模块
**文件**: `routes/analyticsDashboard.js`

**端点规范**:
```javascript
GET  /api/analytics/dashboard/summary
     → 返回仪表盘摘要（用户数、DAU/MAU/WAU、时区分布、流量来源）
     
GET  /api/analytics/dashboard/timeseries?days=14
     → 返回时间序列数据（支持 7/14/30/all 天查询）
     
POST /api/analytics/dashboard/admin/generate-data
     → 管理员端点：触发数据生成（供行为模拟器使用）
     Body: { users: 5, sessions: 10 }
     
POST /api/analytics/dashboard/track
     → 前端埋点接口（记录用户行为事件）
```

#### 数据库 Schema
**文件**: `migrations/002_analytics.js`

**表结构**:
```sql
1. analytics_users       -- 用户追踪表
   - id, source, timezone, country, device_type, browser
   - is_active, created_at, last_active_at, metadata

2. analytics_sessions    -- 会话记录表
   - id, user_id, session_start, session_end
   - duration_seconds, page_views, device_type, referrer

3. analytics_behavior    -- 行为指标表
   - user_id, session_id, recorded_at
   - mouse_movements, scrolls, clicks, typing_events
   - engagement_score, bounce_probability

4. analytics_daily       -- 每日聚合数据表
   - date, unique_users, new_users
   - dau, wau, mau, bounce_rate
   - avg_session_seconds, total_sessions
```

#### S-曲线历史数据生成算法
**核心特性**:
- 可配置起始日期（如 2024-11-29）
- 可配置结束日期（如 2025-01-30）
- 可配置目标用户数（如 2123）
- 可配置增长率参数（k、x0）
- 自动生成符合自然增长规律的历史数据

---

### 3️⃣ **行为模拟器系统** (`template-analytics-dashboard/simulator/`)

#### 核心脚本
**生产版本**: `behavior-simulator.py`
- 真实时间间隔运行（30分钟 - 4小时随机）
- 时间段概率模型（上午30%、下午40%、晚上20%、夜间10%）
- 批量用户生成（每批5-20个用户）
- 网络容错、崩溃自动重启

**测试版本**: `behavior-simulator-test.py`
- 快速测试模式（10-20秒间隔）
- 运行2轮后自动停止
- 适合开发调试

**Bash 包装器**: `behavior-simulator.sh`
- 提供 `--test` 测试模式
- 24/7 后台运行支持
- 日志输出到 `~/.promptly-behavior-simulator.log`

#### macOS 系统集成
**launchd 服务**: `com.promptly.behavior.simulator.plist`
- 开机自动启动
- 休眠后自动恢复
- 网络断开后等待恢复

**安装脚本**:
- `install-behavior-simulator.sh` - 一键安装服务
- `uninstall-behavior-simulator.sh` - 一键卸载

---

### 4️⃣ **配置系统** (`template-analytics-dashboard/config/`)

#### 前端配置模板
```javascript
const ANALYTICS_CONFIG = {
  API_BASE: 'http://localhost:8080',  // 后端 API 地址
  AUTO_REFRESH_INTERVAL: 30000,       // 自动刷新间隔（毫秒）
  DEFAULT_TIME_RANGE: '14d',          // 默认时间范围
  CHART_COLORS: {
    primary: '#3b82f6',               // 主色调（蓝色）
    secondary: '#8b5cf6',             // 辅助色（紫色）
    success: '#10b981',               // 成功色（绿色）
    danger: '#ef4444',                // 危险色（红色）
  },
  PARTICLE_CONFIG: {
    count: 30,                        // 粒子数量
    minSize: 2,                       // 最小尺寸
    maxSize: 6,                       // 最大尺寸
  },
};
```

#### 后端配置模板
```javascript
const ANALYTICS_CONFIG = {
  // S-曲线参数
  projectStartDate: '2024-11-29',
  dataEndDate: '2025-01-30',
  targetUsers: 2123,
  targetDAU: 350,
  sGrowthK: 0.12,
  sGrowthX0: 32,
  
  // 真实产品数据参数
  bounceRate: 0.15,              // 跳出率 15%
  returnFrequencyDays: 3.5,      // 平均回访间隔天数
  avgSessionSeconds: 450,        // 平均会话时长（秒）
  
  // 地理分布
  timezones: [
    { name: 'America/New_York', weight: 40 },
    { name: 'America/Los_Angeles', weight: 30 },
    { name: 'Europe/London', weight: 15 },
    { name: 'Asia/Tokyo', weight: 10 },
    { name: 'Australia/Sydney', weight: 5 },
  ],
  
  // 流量来源
  sources: [
    { name: 'organic', weight: 45 },
    { name: 'direct', weight: 25 },
    { name: 'social', weight: 15 },
    { name: 'referral', weight: 10 },
    { name: 'email', weight: 5 },
  ],
};
```

#### 行为模拟器配置
```python
CONFIG = {
    "API_BASE": "http://localhost:8080",
    
    # 时间段概率分布
    "PROBABILITY": {
        "morning": 30,    # 6:00-12:00
        "afternoon": 40,  # 12:00-18:00
        "evening": 20,    # 18:00-24:00
        "night": 10,      # 0:00-6:00
    },
    
    # 批次大小
    "MIN_BATCH_SIZE": 5,
    "MAX_BATCH_SIZE": 20,
    
    # 等待时间（分钟）
    "MIN_WAIT_MINUTES": 30,
    "MAX_WAIT_HOURS": 4,
    
    # 日志路径
    "LOG_FILE": "~/.promptly-behavior-simulator.log",
}
```

---

### 5️⃣ **文档系统** (`template-analytics-dashboard/docs/`)

#### 必备文档
1. **README.md** - 总览和快速开始
2. **INTEGRATION_GUIDE.md** - 集成步骤详解
3. **API_REFERENCE.md** - API 端点完整文档
4. **CUSTOMIZATION_GUIDE.md** - 自定义配置指南
5. **DEPLOYMENT_GUIDE.md** - 生产环境部署
6. **TROUBLESHOOTING.md** - 常见问题解决

#### README.md 应包含的章节
```markdown
# Analytics Dashboard Template

## ✨ 功能特性
- [x] 实时用户增长追踪
- [x] DAU/MAU/WAU 指标计算
- [x] 时区和地理分布分析
- [x] 行为数据自动模拟
- [x] 玻璃态高级 UI 设计
- [x] 响应式移动端支持

## 🚀 5 分钟快速启动
1. 复制模板文件夹到项目
2. 运行数据库迁移
3. 配置 API 端点
4. 启动前后端服务
5. 访问 dashboard

## 📋 系统要求
- Node.js >= 16
- SQLite 3
- Python 3.8+ (仅模拟器)
- 现代浏览器（支持 ES6+）

## 🎨 自定义配置
- 主题颜色
- 粒子效果密度
- 数据刷新频率
- S-曲线增长参数

## 🔧 集成到现有项目
[详见 INTEGRATION_GUIDE.md]
```

---

### 6️⃣ **测试和验证** (`template-analytics-dashboard/tests/`)

#### 测试脚本
```javascript
// test-analytics-integration.js
export async function testAnalyticsIntegration() {
  console.log('🧪 Testing Analytics Dashboard Integration...\n');
  
  const tests = [
    testDatabaseTables,
    testAPIEndpoints,
    testDataGeneration,
    testFrontendRendering,
    testBehaviorSimulator,
  ];
  
  for (const test of tests) {
    await test();
  }
  
  console.log('\n✅ All tests passed!');
}
```

#### 测试检查项
- ✅ 数据库表是否正确创建
- ✅ API 端点是否返回正确格式
- ✅ S-曲线算法是否生成合理数据
- ✅ 前端能否正确渲染图表
- ✅ 行为模拟器能否成功调用 API

---

### 7️⃣ **工具脚本** (`template-analytics-dashboard/scripts/`)

#### 实用脚本集合
```bash
setup.sh                # 一键安装所有依赖
migrate.sh              # 运行数据库迁移
start-simulator.sh      # 启动行为模拟器
test-integration.sh     # 运行集成测试
reset-data.sh           # 清空并重新生成数据
backup-data.sh          # 备份 analytics 数据
health-check.sh         # 检查系统健康状态
```

---

## 🏗️ 模板文件夹结构

```
template-analytics-dashboard/
├── 📁 frontend/
│   ├── analytics-dashboard.html
│   ├── analytics-dashboard.css
│   ├── analytics-dashboard.js
│   └── assets/
│       ├── icons/
│       └── fonts/
│
├── 📁 backend/
│   ├── routes/
│   │   └── analyticsDashboard.js
│   ├── migrations/
│   │   └── 002_analytics.js
│   └── lib/
│       └── analyticsHelper.js
│
├── 📁 simulator/
│   ├── behavior-simulator.py
│   ├── behavior-simulator-test.py
│   ├── behavior-simulator.sh
│   ├── install-behavior-simulator.sh
│   ├── uninstall-behavior-simulator.sh
│   └── com.promptly.behavior.simulator.plist
│
├── 📁 config/
│   ├── frontend.config.example.js
│   ├── backend.config.example.js
│   └── simulator.config.example.py
│
├── 📁 docs/
│   ├── README.md
│   ├── INTEGRATION_GUIDE.md
│   ├── API_REFERENCE.md
│   ├── CUSTOMIZATION_GUIDE.md
│   ├── DEPLOYMENT_GUIDE.md
│   └── TROUBLESHOOTING.md
│
├── 📁 tests/
│   ├── test-analytics-integration.js
│   ├── test-api-endpoints.js
│   └── test-data-generation.js
│
├── 📁 scripts/
│   ├── setup.sh
│   ├── migrate.sh
│   ├── start-simulator.sh
│   ├── test-integration.sh
│   ├── reset-data.sh
│   └── health-check.sh
│
├── 📄 README.md
├── 📄 LICENSE
├── 📄 CHANGELOG.md
└── 📄 package.json (可选)
```

---

## 🎯 模板化关键要求

### ✅ 必须实现的通用化措施

1. **配置参数化**
   - 所有硬编码的值提取到配置文件
   - 支持环境变量覆盖
   - 提供清晰的默认值

2. **代码解耦**
   - 前端完全独立于特定业务逻辑
   - API 路由与主应用解耦
   - 数据库表名可配置（前缀）

3. **注释文档化**
   - 每个函数都有 JSDoc 注释
   - 关键算法有详细说明
   - 配置项有使用示例

4. **错误处理**
   - API 端点有完整错误处理
   - 前端有友好的错误提示
   - 模拟器有重试机制

5. **性能优化**
   - 数据库查询使用索引
   - 前端图表懒加载
   - API 支持分页和缓存

6. **安全性**
   - 管理员端点需要认证
   - SQL 注入防护
   - XSS 防护

---

## 📝 集成指南模板

### 集成步骤（应在文档中详细说明）

#### Step 1: 复制文件
```bash
cp -r template-analytics-dashboard/frontend/* your-project/frontend/
cp -r template-analytics-dashboard/backend/* your-project/backend/
```

#### Step 2: 配置数据库
```javascript
// 在 your-project/backend/src/lib/db.js 中
import { up as analyticsUp } from './migrations/002_analytics.js';
analyticsUp();
```

#### Step 3: 注册路由
```javascript
// 在 your-project/backend/src/server.js 中
import { analyticsDashboardRouter } from './routes/analyticsDashboard.js';
app.use('/api/analytics/dashboard', analyticsDashboardRouter);
```

#### Step 4: 配置前端
```javascript
// 修改 frontend/analytics-dashboard.js 中的 API_BASE
const API_BASE = 'https://your-api.com';
```

#### Step 5: 启动模拟器
```bash
cd simulator
./install-behavior-simulator.sh
```

---

## 🎨 样式自定义指南

### 颜色主题配置
```css
/* 在 analytics-dashboard.css 顶部定义 */
:root {
  --analytics-primary: #3b82f6;      /* 主色调 */
  --analytics-secondary: #8b5cf6;    /* 辅助色 */
  --analytics-bg-start: #1e293b;     /* 背景起始色 */
  --analytics-bg-end: #0f172a;       /* 背景结束色 */
  --analytics-card-blur: blur(12px); /* 玻璃态模糊度 */
  --analytics-card-opacity: 0.1;     /* 卡片透明度 */
}
```

### 粒子效果调节
```javascript
// 在 analytics-dashboard.js 中
const PARTICLE_CONFIG = {
  count: 30,        // 增加数量 = 更密集
  minSize: 2,       // 最小直径（px）
  maxSize: 6,       // 最大直径（px）
  speed: 20,        // 动画速度（秒）
  opacity: 0.3,     // 透明度
};
```

---

## 🚀 生产环境部署检查清单

### 前端
- [ ] 修改 `API_BASE` 为生产环境地址
- [ ] 启用 HTTPS
- [ ] 压缩 CSS/JS 文件
- [ ] 配置 CDN（可选）

### 后端
- [ ] 设置正确的 `CORS_ORIGIN`
- [ ] 配置管理员认证密钥
- [ ] 启用数据库备份
- [ ] 配置日志记录

### 模拟器
- [ ] 修改 `API_BASE` 为生产环境地址
- [ ] 配置 launchd 服务（macOS）或 systemd（Linux）
- [ ] 设置日志轮转
- [ ] 配置告警通知（可选）

---

## 🎁 额外功能建议（可选增强）

1. **导出功能**
   - CSV 导出用户数据
   - PDF 报告生成
   - Excel 图表导出

2. **高级筛选**
   - 按时区筛选
   - 按流量来源筛选
   - 自定义日期范围

3. **实时通知**
   - WebSocket 实时更新
   - 邮件报告订阅
   - Slack 集成

4. **对比分析**
   - 同比数据对比
   - 环比数据对比
   - 多指标关联分析

---

## 📊 数据生成算法说明

### S-曲线公式
```
f(x) = L / (1 + e^(-k(x - x0)))

其中:
- L = 目标用户数（渐近线）
- k = 增长率（0.06-0.15 为合理范围）
- x0 = 拐点位置（第几天达到 50% 用户）
- x = 天数（从项目开始计算）
```

### 真实产品场景预设

#### 📈 快速增长型产品
```javascript
{
  targetUsers: 5000,
  sGrowthK: 0.15,
  sGrowthX0: 25,
  bounceRate: 0.12,
  avgSessionSeconds: 600,
}
```

#### 📉 挣扎期产品
```javascript
{
  targetUsers: 1200,
  sGrowthK: 0.06,
  sGrowthX0: 45,
  bounceRate: 0.25,
  avgSessionSeconds: 300,
}
```

#### 🚀 病毒式增长
```javascript
{
  targetUsers: 20000,
  sGrowthK: 0.20,
  sGrowthX0: 15,
  bounceRate: 0.08,
  avgSessionSeconds: 900,
}
```

---

## ✅ 验收标准

模板提取完成后，必须满足以下条件：

1. ✅ **独立可运行**：无需依赖原项目代码即可启动
2. ✅ **文档完善**：5分钟内能按文档完成集成
3. ✅ **配置清晰**：所有可配置项都有注释和示例
4. ✅ **测试通过**：包含完整的测试脚本且全部通过
5. ✅ **风格一致**：代码格式、命名规范保持一致
6. ✅ **性能优化**：数据库查询有索引、前端有懒加载
7. ✅ **跨平台**：macOS、Linux、Windows 都能运行（模拟器除外）
8. ✅ **错误优雅**：所有错误情况都有友好提示

---

## 🎬 最终输出

创建一个完整的 `template-analytics-dashboard/` 文件夹，包含：

1. 所有必需的代码文件（去除业务耦合）
2. 完整的配置模板文件
3. 详细的集成和使用文档
4. 自动化测试和部署脚本
5. 可选的增强功能示例

该模板应能让任何开发者在 **30 分钟内**完成集成并看到效果！

---

## 💡 使用此 Prompt 的方法

将上述完整内容提供给 AI 助手，并指明：

> "请按照这个 Prompt 的要求，从当前的 Promptly 项目中提取所有 analytics dashboard 相关的代码、配置、文档和脚本，创建一个通用的 `template-analytics-dashboard/` 文件夹模板。确保模板是独立的、文档完善的、易于集成的。"

---

**版本**: v1.0  
**创建日期**: 2026-01-30  
**适用范围**: 任何需要 analytics dashboard 的 Web 应用产品  
**维护者**: AI Coding Agent + Human Developer
