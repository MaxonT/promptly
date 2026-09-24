/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * Analytics Dashboard - Frontend Configuration
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * 前端配置文件 - 所有可自定义的设置
 *
 * 使用方法:
 *   在 analytics-dashboard.html 中，在加载 analytics-dashboard.js 之前引入此文件
 *   <script src="config/frontend-config.js"></script>
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const ANALYTICS_CONFIG = {
    // ═══════════════════════════════════════════════════════════════════════════
    // API 配置
    // ═══════════════════════════════════════════════════════════════════════════
    api: {
        // API 基础 URL（生产环境应改为实际域名）
        baseUrl: window.location.origin,
        
        // API 前缀路径
        prefix: '/api/analytics/dashboard',
        
        // 请求超时（毫秒）
        timeout: 30000,
        
        // 重试次数
        retryAttempts: 3,
        
        // 重试间隔（毫秒）
        retryDelay: 1000
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 刷新配置
    // ═══════════════════════════════════════════════════════════════════════════
    refresh: {
        // 自动刷新开关
        enabled: true,
        
        // 刷新间隔（毫秒）
        interval: 60000,  // 1 分钟
        
        // 页面不可见时暂停刷新
        pauseWhenHidden: true
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 日期范围配置
    // ═══════════════════════════════════════════════════════════════════════════
    dateRange: {
        // 默认选中的范围
        default: '30d',
        
        // 可用的预设范围
        presets: [
            { label: '7 Days', value: '7d', days: 7 },
            { label: '30 Days', value: '30d', days: 30 },
            { label: '90 Days', value: '90d', days: 90 },
            { label: 'Custom', value: 'custom', days: null }
        ],
        
        // 最大自定义范围（天）
        maxCustomDays: 365
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 主题配置
    // ═══════════════════════════════════════════════════════════════════════════
    theme: {
        // 默认主题
        default: 'dark',
        
        // 颜色配置
        colors: {
            // 主色调（渐变起点）
            primary: '#667eea',
            
            // 次要色调（渐变终点）
            secondary: '#764ba2',
            
            // 强调色
            accent: '#f093fb',
            
            // 成功色
            success: '#10b981',
            
            // 警告色
            warning: '#f59e0b',
            
            // 错误色
            error: '#ef4444',
            
            // 信息色
            info: '#3b82f6'
        },
        
        // 图表颜色方案
        chartColors: [
            '#667eea',
            '#764ba2',
            '#f093fb',
            '#10b981',
            '#f59e0b',
            '#3b82f6',
            '#ec4899',
            '#8b5cf6'
        ]
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 图表配置
    // ═══════════════════════════════════════════════════════════════════════════
    charts: {
        // Chart.js 全局配置
        global: {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 750,
                easing: 'easeInOutQuart'
            }
        },
        
        // 用户增长图表配置
        userGrowth: {
            type: 'line',
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 6
        },
        
        // 流量来源图表配置
        trafficSources: {
            type: 'doughnut',
            cutout: '60%',
            borderWidth: 0
        },
        
        // 行为分布图表配置
        behaviorDistribution: {
            type: 'bar',
            borderRadius: 8,
            borderSkipped: false
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 指标配置
    // ═══════════════════════════════════════════════════════════════════════════
    metrics: {
        // 摘要卡片定义
        summaryCards: [
            {
                id: 'totalUsers',
                label: 'Total Users',
                icon: '👥',
                format: 'number',
                trend: true
            },
            {
                id: 'activeUsers',
                label: 'Active Users',
                icon: '🟢',
                format: 'number',
                trend: true
            },
            {
                id: 'avgSession',
                label: 'Avg. Session',
                icon: '⏱️',
                format: 'duration',
                trend: true
            },
            {
                id: 'pageViews',
                label: 'Page Views',
                icon: '📊',
                format: 'number',
                trend: true
            }
        ],
        
        // 数字格式化
        formatting: {
            // 大数字缩写阈值
            abbreviateThreshold: 10000,
            
            // 小数位数
            decimalPlaces: 1,
            
            // 百分比小数位
            percentDecimals: 1
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 粒子效果配置
    // ═══════════════════════════════════════════════════════════════════════════
    particles: {
        // 启用粒子效果
        enabled: true,
        
        // 粒子数量
        count: 50,
        
        // 粒子颜色
        color: '#667eea',
        
        // 粒子大小范围
        size: {
            min: 1,
            max: 3
        },
        
        // 移动速度
        speed: 1,
        
        // 连线
        links: {
            enabled: true,
            distance: 150,
            opacity: 0.4
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 导出配置
    // ═══════════════════════════════════════════════════════════════════════════
    export: {
        // 可用的导出格式
        formats: ['csv', 'json'],
        
        // 默认格式
        defaultFormat: 'csv',
        
        // 文件名前缀
        filenamePrefix: 'analytics-export',
        
        // 包含时间戳
        includeTimestamp: true
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 追踪配置
    // ═══════════════════════════════════════════════════════════════════════════
    tracking: {
        // 启用用户行为追踪
        enabled: true,
        
        // 追踪的事件类型
        events: ['page_view', 'click', 'scroll', 'form_submit'],
        
        // 批量发送配置
        batch: {
            enabled: true,
            size: 10,
            interval: 5000
        },
        
        // 会话超时（毫秒）
        sessionTimeout: 30 * 60 * 1000  // 30 分钟
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // S-Curve 计算器配置
    // ═══════════════════════════════════════════════════════════════════════════
    sCurve: {
        // 默认参数
        defaults: {
            targetUsers: 1000,
            growthRate: 0.08,
            inflectionDay: 45,
            days: 90
        },
        
        // 预设场景
        scenarios: {
            rapid: { k: 0.15, label: 'Rapid Growth' },
            steady: { k: 0.08, label: 'Steady Growth' },
            slow: { k: 0.05, label: 'Slow Growth' },
            viral: { k: 0.20, label: 'Viral Growth' }
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 国际化配置
    // ═══════════════════════════════════════════════════════════════════════════
    i18n: {
        // 默认语言
        defaultLocale: 'en',
        
        // 支持的语言
        supportedLocales: ['en', 'zh-CN', 'ja'],
        
        // 日期格式
        dateFormat: {
            'en': 'MMM DD, YYYY',
            'zh-CN': 'YYYY年MM月DD日',
            'ja': 'YYYY年MM月DD日'
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════
    // 调试配置
    // ═══════════════════════════════════════════════════════════════════════════
    debug: {
        // 启用调试日志
        enabled: false,
        
        // 日志级别
        level: 'info',  // 'debug' | 'info' | 'warn' | 'error'
        
        // 显示 API 调用
        logApiCalls: false,
        
        // 显示性能指标
        showPerformance: false
    }
};

// 冻结配置防止意外修改
Object.freeze(ANALYTICS_CONFIG);

// 导出配置（如果是模块环境）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ANALYTICS_CONFIG;
}
