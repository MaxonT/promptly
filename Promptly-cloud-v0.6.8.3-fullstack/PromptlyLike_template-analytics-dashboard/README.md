# 📊 Analytics Dashboard Template v2.0

[![Template Version](https://img.shields.io/badge/version-2.0.0-blue.svg)](CHANGELOG.md)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

**一个生产就绪的、可复用的 Analytics Dashboard 模板**，包含完整的前后端代码、数据库迁移、行为模拟器、数据同步工具和详细文档。

![Dashboard Preview](docs/images/dashboard-preview.png)

---

## ✨ 核心特性

| 功能 | 说明 |
|------|------|
| 🎨 **现代 UI** | Glassmorphism 设计 + 粒子动画效果 |
| 📊 **核心指标** | DAU/WAU/MAU, Stickiness, Bounce Rate (实时计算) |
| 📈 **S-曲线模型** | 逼真的用户增长数据生成 |
| 🔧 **高度可配置** | 支持多行业适配 (SaaS/内容/社区/电商) |
| 📦 **数据同步** | 跨环境数据迁移工具 |
| 🤖 **行为模拟器** | 自动生成逼真的用户行为数据 |
| 📖 **完整文档** | 指标词典、行业适配、故障排除 |

---

## 📁 目录结构

```
template-analytics-dashboard/
├── README.md                    # 本文件
├── CHANGELOG.md                 # 版本历史
├── LICENSE                      # MIT 许可证
├── .template-manifest.json      # 模板元信息
│
├── frontend/                    # 前端资源
│   ├── analytics-dashboard.html # 主页面
│   ├── analytics-dashboard.css  # 样式 (Glassmorphism)
│   ├── analytics-dashboard.js   # 客户端逻辑
│   └── config.js                # 前端配置
│
├── backend/                     # 后端代码
│   ├── routes/
│   │   └── analyticsDashboard.js  # API 路由 (核心)
│   ├── lib/
│   │   └── analyticsHelper.js     # 辅助函数
│   └── migrations/
│       └── 002_analytics.js       # 数据库迁移
│
├── simulator/                   # 行为模拟器
│   ├── behavior-simulator.py      # 主模拟器
│   ├── simulator-config.example.json
│   ├── run-simulator.sh           # 运行脚本
│   └── install-service.sh         # macOS 服务安装
│
├── scripts/                     # 工具脚本
│   ├── sync-to-cloud.js           # 数据同步 ⭐ 新增
│   ├── setup.sh                   # 初始化脚本
│   ├── migrate.sh                 # 迁移脚本
│   └── generate-data.sh           # 数据生成
│
├── config/                      # 配置文件
│   ├── template-config.js         # 主配置 ⭐ 新增
│   ├── frontend-config.js
│   ├── backend-config.example.json
│   └── industry/                  # 行业预设 ⭐ 新增
│       ├── saas-b2b.js
│       ├── content-media.js
│       └── ...
│
├── docs/                        # 文档
│   ├── GLOSSARY.md                # 指标词典 ⭐ 新增
│   ├── DATA_NORMALIZATION.md      # 数据规范化 ⭐ 新增
│   ├── INDUSTRY_ADAPTATION.md     # 行业适配 ⭐ 新增
│   ├── INTEGRATION_GUIDE.md       # 集成指南
│   ├── API_REFERENCE.md           # API 参考
│   ├── CUSTOMIZATION_GUIDE.md     # 定制指南
│   ├── DEPLOYMENT_GUIDE.md        # 部署指南
│   └── TROUBLESHOOTING.md         # 故障排除
│
└── tests/                       # 测试脚本
    ├── test-api.sh
    ├── test-frontend.js
    └── test-integration.sh
```

---

## 🚀 快速开始

### 前置要求

- Node.js 18+
- Python 3.8+ (模拟器)
- SQLite3

### 1️⃣ 复制模板

```bash
# 复制整个模板
cp -r template-analytics-dashboard /your-project/

# 或只复制需要的部分
cp -r template-analytics-dashboard/frontend/* /your-project/frontend/
cp -r template-analytics-dashboard/backend/* /your-project/backend/
```

### 2️⃣ 安装依赖

```bash
cd your-project/backend
npm install better-sqlite3 express
```

### 3️⃣ 配置

```bash
# 复制配置模板
cp config/template-config.example.js config/template-config.js

# 编辑配置 (设置目标值、行业类型等)
nano config/template-config.js
```

**最小配置项:**

```javascript
// config/template-config.js
export const CONFIG = {
  // 产品信息
  productName: "Your Product",
  industryType: "saas-b2b",  // saas-b2b | content-media | social-community | ecommerce | utility-tool
  
  // 目标设置
  goals: {
    totalUsers: 5000,
    dailyActiveUsers: 500
  },
  
  // API 配置
  apiBase: process.env.API_BASE || "http://localhost:8080"
};
```

### 4️⃣ 运行迁移

```bash
# 创建数据库表
node backend/migrations/002_analytics.js

# 生成历史数据 (可选)
./scripts/generate-data.sh --days 90 --scenario steady
```

### 5️⃣ 启动服务

```bash
# 启动后端
npm run dev

# 启动模拟器 (另一个终端)
cd simulator && ./run-simulator.sh
```

### 6️⃣ 访问仪表盘

打开浏览器: `http://localhost:8080/analytics-dashboard.html`

---

## 📖 核心文档

| 文档 | 说明 | 适合谁 |
|------|------|--------|
| [📖 指标词典](docs/GLOSSARY.md) | 所有指标的定义、公式、基准 | 产品、分析师 |
| [📊 数据规范化](docs/DATA_NORMALIZATION.md) | 历史数据、S-曲线、数据同步 | 开发者 |
| [🎯 行业适配](docs/INDUSTRY_ADAPTATION.md) | 不同行业的配置方案 | 产品、开发者 |
| [🔧 集成指南](docs/INTEGRATION_GUIDE.md) | 如何集成到现有项目 | 开发者 |
| [📡 API 参考](docs/API_REFERENCE.md) | API 端点详细说明 | 开发者 |
| [🎨 定制指南](docs/CUSTOMIZATION_GUIDE.md) | UI 主题、指标定制 | 开发者 |
| [🚀 部署指南](docs/DEPLOYMENT_GUIDE.md) | 生产环境部署 | DevOps |
| [🔍 故障排除](docs/TROUBLESHOOTING.md) | 常见问题解决 | 所有人 |

---

## 📊 核心指标说明

### 活跃度指标

| 指标 | 公式 | 健康范围 |
|------|------|----------|
| **DAU** | `COUNT(DISTINCT user_id) WHERE date = today` | 取决于产品 |
| **WAU** | `COUNT(DISTINCT user_id) WHERE date >= today - 7d` | DAU × 3~5 |
| **MAU** | `COUNT(DISTINCT user_id) WHERE date >= today - 30d` | WAU × 3~5 |
| **Stickiness** | `(DAU / MAU) × 100%` | SaaS: 10-20%, 社交: 30-50% |

### 行为质量指标

| 指标 | 公式 | 健康范围 |
|------|------|----------|
| **Bounce Rate** | `sessions(page_views ≤ 1) / total_sessions` | < 40% |

> 📖 完整定义见 [指标词典](docs/GLOSSARY.md)

---

## 🎯 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/analytics/dashboard/summary` | GET | 仪表盘摘要 |
| `/api/analytics/dashboard/timeseries` | GET | 时间序列数据 |
| `/api/analytics/dashboard/growth` | GET | 增长数据 |
| `/api/analytics/dashboard/track/user` | POST | 追踪用户 |
| `/api/analytics/dashboard/track/session-start` | POST | 会话开始 |
| `/api/analytics/dashboard/track/session-end` | POST | 会话结束 |
| `/api/analytics/dashboard/track/behavior` | POST | 行为数据 |
| `/api/admin/sync-data` | POST | 数据同步 (管理) |

> 📡 完整 API 文档见 [API 参考](docs/API_REFERENCE.md)

---

## 📈 S-曲线增长模型

```
f(x) = L / (1 + e^(-k × (x - x₀)))
```

### 预设场景

| 场景 | 目标用户 | 增长率 | 拐点 | 适用 |
|------|---------|-------|------|------|
| `rapid` | 5,000 | 0.12 | 30天 | 病毒式产品 |
| `steady` | 2,000 | 0.08 | 45天 | 典型 SaaS |
| `slow` | 1,000 | 0.05 | 60天 | 专业工具 |
| `viral` | 10,000 | 0.18 | 20天 | 社交产品 |

---

## 🔄 数据同步

### 本地 → 云端

```bash
# 同步本地数据到云端
node scripts/sync-to-cloud.js https://your-app.onrender.com
```

### 同步流程

```
┌──────────────┐                          ┌──────────────┐
│   本地开发    │   sync-to-cloud.js      │   云端生产    │
│  SQLite DB   │ ──────────────────────▶  │  SQLite/PG   │
└──────────────┘                          └──────────────┘
```

> 📊 详细说明见 [数据规范化指南](docs/DATA_NORMALIZATION.md)

---

## 🎨 主题定制

### CSS 变量

```css
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --accent-color: #00d4ff;
  --glass-bg: rgba(255, 255, 255, 0.1);
}
```

### 预设主题

- **深色** (默认) - 科技感
- **浅色** - 清爽商务
- **霓虹** - 游戏风格

> 🎨 详细定制见 [定制指南](docs/CUSTOMIZATION_GUIDE.md)

---

## 🧪 测试

```bash
# 运行所有测试
./scripts/test-all.sh

# 仅测试 API
./tests/test-api.sh

# 仅测试前端
node tests/test-frontend.js
```

---

## 📋 适配清单

将此模板集成到你的项目时，确保完成以下步骤:

- [ ] 复制所需文件到项目
- [ ] 配置 `config/template-config.js`
- [ ] 设置合理的目标值 (goals)
- [ ] 选择适合的行业预设
- [ ] 运行数据库迁移
- [ ] 配置前端 API 地址
- [ ] 测试 API 端点
- [ ] 验证数据显示正确
- [ ] (可选) 配置行为模拟器
- [ ] (可选) 设置数据同步

---

## 🆘 常见问题

### Q: Stickiness 显示 100%？
A: 通常是 MAU 计算问题。检查数据时间范围是否正确。

### Q: 数据显示为 0？
A: 1) 检查数据库表是否存在 2) 检查是否有数据 3) 检查 API 连接

### Q: 如何添加自定义指标？
A: 见 [定制指南 - 添加指标卡片](docs/CUSTOMIZATION_GUIDE.md#添加自定义指标卡片)

> 🔍 更多问题见 [故障排除](docs/TROUBLESHOOTING.md)

---

## 📜 版本历史

### v2.0.0 (2026-01)

- ✨ 新增: 指标词典 (GLOSSARY.md)
- ✨ 新增: 数据规范化指南
- ✨ 新增: 行业适配指南
- ✨ 新增: 数据同步脚本
- 🔧 改进: Stickiness 计算优化 (历史数据估算)
- 🔧 改进: Bounce Rate 实时计算
- 🔧 改进: 所有百分比保留2位小数
- 📖 改进: 文档全面升级

### v1.0.0 (2024-01)

- 🎉 初始版本发布

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE)

---

<p align="center">
  <sub>Made with ❤️ for the analytics community</sub>
</p>
