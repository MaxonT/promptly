# Universal SaaS Template Extraction Prompt

## 目标
从 Promptly 应用中提取所有通用、可复用的组件和系统，创建一个可供其他 SaaS 应用使用的完整模板文件夹结构。

## 任务说明

### 第一步：识别和分类通用组件
扫描整个 Promptly 代码库，识别并分类以下通用组件（**不包含** Promptly 业务特定功能如 prompt optimization、spec builder、outcome runner 等）：

#### 前端通用组件 (Frontend Universal Components)
1. **UI 设计系统**
   - 主题系统 (theme.css, 暗色/亮色模式切换)
   - 通用样式 (style.css 中的按钮、表单、卡片、模态框等)
   - 动画和过渡效果
   - 响应式布局系统

2. **国际化系统 (i18n)**
   - `frontend/i18n/` 完整文件夹
   - `frontend/locales/*.json` 所有语言文件
   - 语言检测和切换逻辑
   - 翻译键命名约定

3. **通用交互组件**
   - Cookie 同意横幅
   - 加载动画和进度指示器
   - Toast 通知系统
   - 错误提示组件
   - 分页组件

4. **账户管理页面**
   - `account.html/js/css` - 用户账户设置
   - `settings.html/js/css` - 系统设置
   - `subscription.html/js/css` - 订阅管理
   - 用户资料编辑界面

5. **法律和合规页面**
   - `privacy.html` - 隐私政策模板
   - `terms.html` - 服务条款模板
   - `cookies.html` - Cookie 政策

6. **配置和构建系统**
   - `build.js` - 构建脚本
   - `vercel.json` - Vercel 部署配置
   - `config.template.js` - 配置模板
   - 环境变量注入机制

#### 后端通用组件 (Backend Universal Components)
1. **认证和授权系统**
   - `backend/src/routes/auth.js` - JWT 认证
   - `backend/src/routes/oauth.js` - OAuth 集成 (Google, GitHub 等)
   - JWT token 生成和验证
   - 密码哈希 (bcryptjs)
   - Rate limiting 防暴力破解

2. **订阅和支付系统**
   - `backend/src/routes/billing.js` - Stripe 集成
   - `backend/src/lib/stripeService.js` - Stripe 服务
   - `backend/src/lib/subscriptionConfig.js` - 订阅配置
   - `backend/src/lib/tokenLedger.js` - Token 账本系统
   - `backend/src/lib/tokenUsage.js` - 使用量追踪
   - `backend/src/lib/trialAntiAbuse.js` - 试用期反滥用

3. **安全中间件**
   - `backend/src/middleware/security.js` - 请求大小限制、SQL 注入检测
   - `backend/src/middleware/csp.js` - 内容安全策略
   - `backend/src/lib/secureError.js` - 安全错误处理
   - Helmet 和 CORS 配置

4. **数据库抽象层**
   - `backend/src/lib/db.js` - SQLite/PostgreSQL 适配器
   - `backend/src/lib/db-pg.js` - PostgreSQL 实现
   - 用户表结构 (users, sessions)
   - 订阅表结构 (subscriptions, checkout_sessions, stripe_events)

5. **分析和监控**
   - `backend/src/routes/analytics.js` - 分析 API
   - `backend/src/routes/analyticsDashboard.js` - 分析仪表板
   - `backend/src/lib/dailyRefreshJob.js` - 定时任务
   - `backend/src/lib/dailyCompensationJob.js` - 补偿机制

6. **文档和分享系统**
   - `backend/src/routes/doc.js` - 文档管理
   - `backend/src/routes/share.js` - 分享链接
   - 版本控制机制

#### 配置文件和脚本
1. **部署和测试脚本**
   - `test-deployment.sh` - 部署测试
   - `verify-integration.sh` - 集成验证
   - `check-keepalive.sh` - 健康检查
   - `backend/scripts/healthcheck.js` - 健康检查脚本
   - `backend/scripts/run_migrations.js` - 迁移脚本

2. **数据库迁移**
   - `backend/migrations/001_subscriptions.js` - 订阅表
   - `backend/migrations/002_analytics.js` - 分析表
   - `backend/migrations/002_checkout_sessions.js` - 结账会话
   - `backend/migrations/003_stripe_events.js` - Stripe 事件

3. **环境配置**
   - `backend/.env.example` - 环境变量模板
   - 所有配置参数的文档说明

---

### 第二步：创建模板文件夹结构

创建 `universal-saas-template/` 文件夹，包含以下结构：

```
universal-saas-template/
├── README.md                          # 模板使用指南
├── INTEGRATION_GUIDE.md               # 集成到新项目的步骤
├── CONFIGURATION_REFERENCE.md         # 所有配置项详细说明
├── GLOSSARY.md                        # 术语表
│
├── frontend/                          # 前端通用组件
│   ├── components/                    # UI 组件库
│   │   ├── theme/                     # 主题系统
│   │   │   ├── theme.css
│   │   │   └── theme-config.js
│   │   ├── styles/                    # 通用样式
│   │   │   ├── buttons.css
│   │   │   ├── forms.css
│   │   │   ├── cards.css
│   │   │   ├── modals.css
│   │   │   └── animations.css
│   │   ├── ui-elements/               # 可复用 UI 元素
│   │   │   ├── consent-banner.js
│   │   │   ├── toast.js
│   │   │   ├── loading-spinner.js
│   │   │   └── pagination.js
│   │   └── layout/                    # 布局组件
│   │       ├── header.js
│   │       └── navigation.js
│   │
│   ├── i18n/                          # 国际化系统
│   │   ├── README.md                  # i18n 使用说明
│   │   ├── index.js
│   │   ├── config.js
│   │   ├── detector.js
│   │   ├── loader.js
│   │   ├── cache.js
│   │   └── locales/                   # 语言文件
│   │       ├── en.json
│   │       ├── zh-CN.json
│   │       ├── es.json
│   │       └── [other languages].json
│   │
│   ├── pages/                         # 通用页面模板
│   │   ├── account.html/js/css        # 账户管理
│   │   ├── settings.html/js/css       # 设置页面
│   │   ├── subscription.html/js/css   # 订阅管理
│   │   ├── privacy.html               # 隐私政策
│   │   ├── terms.html                 # 服务条款
│   │   ├── cookies.html               # Cookie 政策
│   │   └── 404.html                   # 404 页面
│   │
│   ├── lib/                           # 前端工具库
│   │   ├── api-client.js              # API 客户端封装
│   │   ├── auth-helpers.js            # 认证辅助函数
│   │   └── storage-helpers.js         # 本地存储辅助
│   │
│   └── build/                         # 构建配置
│       ├── build.js
│       ├── config.template.js
│       └── vercel.json
│
├── backend/                           # 后端通用模块
│   ├── src/
│   │   ├── routes/                    # 通用路由
│   │   │   ├── auth.js                # 认证路由
│   │   │   ├── oauth.js               # OAuth 路由
│   │   │   ├── billing.js             # 支付路由
│   │   │   ├── analytics.js           # 分析路由
│   │   │   ├── doc.js                 # 文档路由
│   │   │   └── share.js               # 分享路由
│   │   │
│   │   ├── lib/                       # 通用库
│   │   │   ├── db.js                  # 数据库适配器
│   │   │   ├── db-pg.js               # PostgreSQL 实现
│   │   │   ├── stripeService.js       # Stripe 服务
│   │   │   ├── subscriptionConfig.js  # 订阅配置
│   │   │   ├── tokenLedger.js         # Token 账本
│   │   │   ├── tokenUsage.js          # 使用量追踪
│   │   │   ├── trialAntiAbuse.js      # 试用期反滥用
│   │   │   ├── dailyRefreshJob.js     # 定时任务
│   │   │   ├── dailyCompensationJob.js# 补偿任务
│   │   │   └── secureError.js         # 安全错误处理
│   │   │
│   │   └── middleware/                # 中间件
│   │       ├── security.js            # 安全中间件
│   │       └── csp.js                 # CSP 中间件
│   │
│   ├── migrations/                    # 数据库迁移
│   │   ├── 001_users.js               # 用户表
│   │   ├── 002_sessions.js            # 会话表
│   │   ├── 003_subscriptions.js       # 订阅表
│   │   ├── 004_analytics.js           # 分析表
│   │   └── 005_docs_shares.js         # 文档和分享表
│   │
│   ├── scripts/                       # 工具脚本
│   │   ├── healthcheck.js
│   │   ├── run_migrations.js
│   │   └── behavior-simulator.py
│   │
│   ├── .env.example                   # 环境变量模板
│   ├── package.json                   # 依赖清单
│   └── Dockerfile                     # Docker 配置
│
├── deployment/                        # 部署配置
│   ├── render.yaml                    # Render 配置
│   ├── vercel.json                    # Vercel 配置
│   ├── docker-compose.yml             # Docker Compose
│   └── nginx.conf                     # Nginx 配置示例
│
├── scripts/                           # 通用脚本
│   ├── test-deployment.sh
│   ├── verify-integration.sh
│   ├── check-keepalive.sh
│   └── setup-project.sh               # 新项目设置脚本
│
└── docs/                              # 文档
    ├── ARCHITECTURE.md                # 架构说明
    ├── AUTHENTICATION.md              # 认证系统文档
    ├── BILLING.md                     # 支付系统文档
    ├── I18N.md                        # 国际化文档
    ├── DEPLOYMENT.md                  # 部署指南
    ├── SECURITY.md                    # 安全最佳实践
    └── API_REFERENCE.md               # API 参考
```

---

### 第三步：创建核心文档

#### 1. `README.md` - 模板概览
包含：
- 模板简介和特性清单
- 快速开始指南
- 技术栈说明
- 目录结构概览
- 贡献指南

#### 2. `INTEGRATION_GUIDE.md` - 集成指南
详细步骤：
1. 如何将模板集成到新项目
2. 必须修改的配置文件清单
3. 环境变量配置
4. 品牌定制指南 (logo, colors, app name)
5. 数据库迁移步骤
6. 前端构建和部署

#### 3. `CONFIGURATION_REFERENCE.md` - 配置参考
完整列举：
- 所有环境变量及其说明
- 订阅计划配置参数
- i18n 配置选项
- 主题配置选项
- API 端点配置
- 第三方服务集成配置 (Stripe, OAuth providers)

#### 4. `GLOSSARY.md` - 术语表
定义所有关键概念：
- Subscription tiers (free, trial, monthly, yearly)
- Token system (ledger, buckets, daily refresh)
- Authentication methods (JWT, OAuth)
- CSP, CORS, Rate Limiting 等安全概念
- SSE (Server-Sent Events)
- Migration 和 schema version

---

### 第四步：代码抽象和可配置化

对提取的每个组件：

1. **移除业务特定代码**
   - 删除所有 Promptly 特定的业务逻辑
   - 保留通用的框架和模式

2. **添加配置占位符**
   - 使用环境变量或配置文件
   - 示例：`APP_NAME`, `APP_LOGO_URL`, `BRAND_COLOR_PRIMARY`

3. **文档化自定义点**
   - 标记所有需要自定义的位置
   - 提供示例代码

4. **添加类型注解和 JSDoc**
   - 提高代码可读性
   - 明确接口契约

---

### 第五步：创建示例和测试

1. **示例应用**
   - 创建一个最小化的示例应用展示如何使用模板
   - 包含所有核心功能的演示

2. **测试套件**
   - 认证流程测试
   - 支付流程测试
   - i18n 测试
   - 安全测试

3. **模拟数据**
   - 提供测试用的种子数据
   - Mock API 响应

---

### 第六步：创建品牌定制指南

创建 `BRANDING_GUIDE.md`，包含：

1. **视觉定制**
   - 如何修改 logo
   - 如何更改颜色方案
   - 如何自定义字体

2. **文案定制**
   - 如何修改所有用户可见文本
   - i18n 键的命名约定
   - 如何添加新的语言

3. **功能开关**
   - 如何启用/禁用特定功能
   - Feature flags 配置

---

## 输出要求

1. **代码质量**
   - 所有代码必须经过测试
   - 遵循最佳实践和安全标准
   - 代码注释清晰完整

2. **文档完整性**
   - 每个组件都有详细文档
   - 包含实际使用示例
   - FAQ 部分解答常见问题

3. **可移植性**
   - 代码与 Promptly 业务逻辑完全解耦
   - 可以直接复制到新项目使用
   - 最小化外部依赖

4. **版本控制**
   - 使用语义化版本号
   - 保持向后兼容性
   - 提供升级指南

---

## 验证清单

完成后验证以下内容：

- [ ] 所有提取的代码可以在空白项目中运行
- [ ] 所有配置项都有清晰文档
- [ ] 提供完整的集成示例
- [ ] 安全配置符合最佳实践
- [ ] i18n 系统支持 9 种语言
- [ ] 订阅和支付系统可独立工作
- [ ] 认证系统支持 JWT 和 OAuth
- [ ] 数据库迁移脚本可复用
- [ ] 所有脚本在 macOS 和 Linux 上都能运行
- [ ] Docker 配置可以一键部署
- [ ] Vercel 和 Render 配置即用
- [ ] 提供性能优化建议
- [ ] 提供安全检查清单

---

## 注意事项

1. **不要包含的内容**
   - Promptly 特定的业务逻辑 (Spec, Question, Agents, Metrics, Outcome)
   - 特定的 LLM 集成 (OpenAI, Groq clients)
   - Prompt 优化相关代码
   - 特定的评估引擎

2. **保留的通用模式**
   - Run 生命周期模式 (createRun, completeRun)
   - ID 前缀约定 (可配置)
   - 错误分类系统
   - 日志格式

3. **文档语言**
   - 主要文档使用英文
   - 提供中文版本的快速开始指南
   - 代码注释使用英文

---

## 最终交付物

```
universal-saas-template-v1.0.0.zip
├── universal-saas-template/    # 完整模板文件夹
├── example-app/                # 示例应用
└── RELEASE_NOTES.md            # 发布说明
```

请开始执行此任务，首先创建 `universal-saas-template/` 文件夹结构，然后逐步提取和文档化每个组件。
