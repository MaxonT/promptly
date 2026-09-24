# Changelog

All notable changes to the Analytics Dashboard Template will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-01-31

### Added

#### Documentation (新增文档)
- **📖 GLOSSARY.md** - 完整的指标词典
  - 所有指标的定义、计算公式、数据来源
  - 行业基准参考 (SaaS/内容/社交/电商)
  - 指标→事件→数据源映射表
  - 常见问题解答

- **📊 DATA_NORMALIZATION.md** - 数据规范化指南
  - 历史数据生成策略
  - S-曲线增长模型详解 (含代码示例)
  - 数据一致性约束规则
  - 跨环境数据同步流程
  - 数据验证检查清单

- **🎯 INDUSTRY_ADAPTATION.md** - 行业适配指南
  - SaaS B2B 配置方案
  - 内容/媒体平台配置
  - 社区/社交产品配置
  - 电商平台配置
  - 工具类产品配置
  - 快速适配清单

#### Scripts (新增脚本)
- **📦 sync-to-cloud.js** - 数据同步工具
  - 分批发送，避免超时
  - 自动重试机制
  - 详细进度显示
  - 支持环境变量配置

#### Configuration (新增配置)
- **⚙️ template-config.example.js** - 统一配置模板
  - 产品基础信息
  - 目标设置
  - 活跃用户定义
  - S-曲线参数
  - 显示配置
  - API 配置
  - 主题配置

### Changed

#### Backend 改进
- **Stickiness 计算优化**
  - 支持历史数据估算
  - 避免数据断层导致的 100% 异常值
  - 使用代表性 DAU 计算

- **Bounce Rate 实时计算**
  - 从 sessions 表实时计算 (page_views <= 1)
  - 智能回退到 daily 表

- **精度统一规范**
  - 所有百分比保留2位小数
  - 使用字符串格式避免精度丢失
  - `dau_mau_ratio` 返回 "8.40" 而非 8.4

#### Documentation 改进
- **README 全面重写**
  - 更清晰的目录结构说明
  - 完整的文档索引表
  - 详细的快速开始指南
  - 适配清单

### Fixed
- 修复 Stickiness 在数据断层时显示 100% 的问题
- 修复 Bounce Rate 在 sessions 数据不足时的计算错误
- 修复大数据量同步时的请求超时问题

---

## [1.0.0] - 2024-01-XX

### Added

#### Frontend
- **Glassmorphism UI Design**
  - Semi-transparent card backgrounds with backdrop blur
  - Gradient color scheme (primary: #667eea → #764ba2)
  - Particle.js animated background
  - Responsive grid layout (auto-fit columns)

- **Dashboard Components**
  - Summary cards (Total Users, Active Users, Avg Session, Page Views)
  - User Growth Chart (Chart.js line chart with gradient fill)
  - Traffic Sources Chart (doughnut chart)
  - Recent Activity Timeline
  - Growth Rate Calculator with S-curve visualization

- **Interactive Features**
  - Date range selector (7d, 30d, 90d, Custom)
  - Real-time data refresh
  - Export functionality (CSV, JSON)
  - Dark/light mode toggle
  - Responsive design for mobile devices

#### Backend
- **API Endpoints**
  - `GET /api/analytics/dashboard/summary` - Aggregate metrics
  - `GET /api/analytics/dashboard/timeseries` - Time-based data
  - `GET /api/analytics/dashboard/growth` - S-curve growth analysis
  - `POST /api/analytics/dashboard/track/*` - User behavior tracking
  - `POST /api/analytics/dashboard/admin/generate-data` - Data generation
  - `GET /api/analytics/dashboard/health` - Health check

- **Database Schema**
  - `analytics_users` - User profiles and metadata
  - `analytics_sessions` - Session tracking with duration
  - `analytics_behavior` - Granular event tracking
  - `analytics_daily` - Pre-aggregated daily statistics

- **S-Curve Algorithm**
  - Configurable growth parameters (L, k, x0)
  - Multiple growth scenarios (rapid, steady, slow, viral)
  - Historical data generation with realistic patterns

#### Simulator
- **Python Behavior Simulator**
  - Time-period probability model (morning/afternoon/evening/night)
  - Simulated user actions (page_view, click, scroll, form_submit)
  - Session management with realistic durations
  - Rate limiting and error handling

- **Service Integration**
  - macOS launchd plist configuration
  - Linux systemd service support (documented)
  - Install/uninstall scripts
  - Background execution with logging

#### Documentation
- Complete README with quick start guide
- Integration guide for existing projects
- API reference with examples
- Customization guide (themes, metrics, charts)
- Deployment guide (PM2, Docker, Nginx)
- Troubleshooting guide

#### Testing
- API endpoint test script (bash)
- Frontend structure validation (Node.js)
- Integration test suite
- Python syntax validation

#### Scripts
- `setup.sh` - One-click initialization
- `migrate.sh` - Database migration runner
- `reset-data.sh` - Data cleanup utility
- `generate-data.sh` - S-curve data generator

### Technical Specifications

- **Frontend**: HTML5, CSS3, JavaScript ES6+, Chart.js 4.4.1
- **Backend**: Node.js 16+, Express Router, SQLite 3
- **Simulator**: Python 3.8+, requests library
- **Database**: SQLite with better-sqlite3

---

## [Unreleased]

### Planned Features
- Real-time WebSocket updates
- User cohort analysis
- A/B testing integration
- Custom event tracking API
- Dashboard embedding support
- Multi-tenant support
- Advanced filtering and segmentation

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 1.0.0 | 2024-01-XX | Initial release |

---

## Migration Notes

### Upgrading to 1.0.0

This is the initial release. No migration required.

For future upgrades, migration scripts will be provided in the `scripts/` directory.

---

## Contributing

When contributing to this template, please:

1. Update this CHANGELOG.md with your changes
2. Follow the existing code style and conventions
3. Add appropriate tests for new features
4. Update documentation as needed

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
