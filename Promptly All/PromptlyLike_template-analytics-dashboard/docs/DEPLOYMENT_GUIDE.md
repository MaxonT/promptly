# Analytics Dashboard 部署指南

本指南涵盖将 Analytics Dashboard 部署到生产环境的完整流程。

## 目录

1. [部署前检查](#部署前检查)
2. [环境配置](#环境配置)
3. [数据库准备](#数据库准备)
4. [后端部署](#后端部署)
5. [前端部署](#前端部署)
6. [模拟器部署](#模拟器部署)
7. [监控与维护](#监控与维护)
8. [常见部署场景](#常见部署场景)

---

## 部署前检查

### 系统要求

| 组件 | 最低要求 | 推荐 |
|------|----------|------|
| CPU | 1 核 | 2+ 核 |
| 内存 | 512MB | 2GB+ |
| 磁盘 | 1GB | 10GB+ (取决于数据量) |
| Node.js | 16.x | 18.x LTS |
| Python | 3.8 | 3.10+ |
| SQLite | 3.x | 3.40+ |

### 检查清单

- [ ] Node.js 已安装且版本 >= 16
- [ ] Python 3.8+ 已安装 (模拟器需要)
- [ ] 数据库目录可写
- [ ] 端口 8080 可用
- [ ] 环境变量已配置
- [ ] SSL 证书已准备 (生产环境)
- [ ] 反向代理已配置 (推荐)

### 运行检查脚本

```bash
# 一键检查所有依赖
./scripts/check-requirements.sh
```

---

## 环境配置

### 生产环境变量

创建 `.env.production`:

```bash
# 运行模式
NODE_ENV=production

# 服务器配置
PORT=8080
HOST=0.0.0.0

# 数据库 (使用绝对路径)
SQLITE_PATH=/var/data/analytics/analytics.db

# 安全配置 (必须修改!)
JWT_SECRET=your-very-long-and-random-jwt-secret-key-here
ADMIN_API_KEY=your-secure-admin-api-key-here

# CORS (指定具体域名)
CORS_ORIGIN=https://your-domain.com

# 日志
LOG_LEVEL=info

# 限流
ENABLE_RATE_LIMITING=true
```

### 环境变量验证

```javascript
// 在启动时验证必需的环境变量
const requiredEnvVars = [
  'SQLITE_PATH',
  'JWT_SECRET',
  'ADMIN_API_KEY'
];

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}
```

---

## 数据库准备

### 创建数据目录

```bash
# 创建数据目录
sudo mkdir -p /var/data/analytics
sudo chown -R $USER:$USER /var/data/analytics

# 设置权限
chmod 700 /var/data/analytics
```

### 运行迁移

```bash
# 设置环境变量
export SQLITE_PATH=/var/data/analytics/analytics.db

# 运行迁移
node backend/migrations/002_analytics.js
```

### 验证数据库

```bash
# 检查表是否创建成功
sqlite3 /var/data/analytics/analytics.db ".tables"

# 预期输出:
# analytics_behavior  analytics_daily  analytics_sessions  analytics_users
```

### 数据库备份

```bash
# 创建备份脚本
cat > /var/data/analytics/backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/analytics"
mkdir -p $BACKUP_DIR
sqlite3 /var/data/analytics/analytics.db ".backup $BACKUP_DIR/analytics_$DATE.db"
# 保留最近7天
find $BACKUP_DIR -name "analytics_*.db" -mtime +7 -delete
EOF

chmod +x /var/data/analytics/backup.sh

# 添加 cron 任务 (每天凌晨2点备份)
echo "0 2 * * * /var/data/analytics/backup.sh" | crontab -
```

---

## 后端部署

### 方式 1: 直接运行

```bash
# 安装依赖
npm install --production

# 使用 PM2 运行
npm install -g pm2
pm2 start server.js --name analytics-api

# 设置开机启动
pm2 startup
pm2 save
```

### 方式 2: Docker 部署

**Dockerfile**:

```dockerfile
FROM node:18-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --production

# 复制代码
COPY backend/ ./backend/
COPY frontend/ ./public/

# 创建数据目录
RUN mkdir -p /data

# 环境变量
ENV NODE_ENV=production
ENV PORT=8080
ENV SQLITE_PATH=/data/analytics.db

EXPOSE 8080

CMD ["node", "backend/src/server.js"]
```

**docker-compose.yml**:

```yaml
version: '3.8'

services:
  analytics-api:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - analytics-data:/data
    environment:
      - NODE_ENV=production
      - SQLITE_PATH=/data/analytics.db
      - JWT_SECRET=${JWT_SECRET}
      - ADMIN_API_KEY=${ADMIN_API_KEY}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/api/analytics/dashboard/health"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  analytics-data:
```

**构建和运行**:

```bash
docker-compose build
docker-compose up -d
```

### 方式 3: Systemd 服务

创建 `/etc/systemd/system/analytics-api.service`:

```ini
[Unit]
Description=Analytics Dashboard API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/analytics
ExecStart=/usr/bin/node backend/src/server.js
Restart=on-failure
RestartSec=10

Environment=NODE_ENV=production
Environment=PORT=8080
Environment=SQLITE_PATH=/var/data/analytics/analytics.db
EnvironmentFile=/var/www/analytics/.env

[Install]
WantedBy=multi-user.target
```

启用服务:

```bash
sudo systemctl daemon-reload
sudo systemctl enable analytics-api
sudo systemctl start analytics-api
sudo systemctl status analytics-api
```

---

## 前端部署

### 方式 1: 与后端一起 (推荐)

后端服务静态文件:

```javascript
// server.js
import express from 'express';
import path from 'path';

const app = express();

// API 路由
app.use('/api/analytics/dashboard', analyticsDashboardRouter);

// 静态文件
app.use(express.static(path.join(__dirname, '../public')));

// SPA 回退
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});
```

### 方式 2: 独立部署 (CDN/Nginx)

**Nginx 配置**:

```nginx
server {
    listen 80;
    server_name analytics.your-domain.com;
    
    # 重定向到 HTTPS
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name analytics.your-domain.com;
    
    # SSL 配置
    ssl_certificate /etc/letsencrypt/live/analytics.your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/analytics.your-domain.com/privkey.pem;
    
    # 静态文件
    root /var/www/analytics/public;
    index analytics-dashboard.html;
    
    # 缓存静态资源
    location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
    
    # API 代理
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # 健康检查
    location /health {
        proxy_pass http://localhost:8080/api/analytics/dashboard/health;
    }
}
```

**申请 SSL 证书**:

```bash
# 使用 Certbot
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d analytics.your-domain.com
```

### 配置前端 API 地址

```javascript
// frontend/config.js
window.ANALYTICS_API_BASE = 'https://analytics.your-domain.com';

// 或使用相对路径 (推荐)
window.ANALYTICS_API_BASE = '';
```

---

## 模拟器部署

### 生产环境配置

```bash
# 设置环境变量
export ANALYTICS_API_BASE=https://analytics.your-domain.com
export ADMIN_API_KEY=your-secure-admin-api-key
```

### macOS launchd 服务

```bash
cd simulator
./install-service.sh https://analytics.your-domain.com
```

### Linux systemd 服务

创建 `/etc/systemd/system/analytics-simulator.service`:

```ini
[Unit]
Description=Analytics Behavior Simulator
After=network.target analytics-api.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/analytics/simulator
ExecStart=/usr/bin/python3 behavior-simulator.py --rounds -1 --interval 60
Restart=on-failure
RestartSec=30

Environment=ANALYTICS_API_BASE=http://localhost:8080
Environment=ADMIN_API_KEY=your-admin-api-key

[Install]
WantedBy=multi-user.target
```

启用:

```bash
sudo systemctl daemon-reload
sudo systemctl enable analytics-simulator
sudo systemctl start analytics-simulator
```

### Docker 部署模拟器

```dockerfile
# simulator/Dockerfile
FROM python:3.10-slim

WORKDIR /app
COPY behavior-simulator.py .
COPY simulator-config.example.json ./config.json

CMD ["python3", "behavior-simulator.py", "--config", "config.json"]
```

添加到 docker-compose:

```yaml
  simulator:
    build: ./simulator
    depends_on:
      - analytics-api
    environment:
      - ANALYTICS_API_BASE=http://analytics-api:8080
      - ADMIN_API_KEY=${ADMIN_API_KEY}
    restart: unless-stopped
```

---

## 监控与维护

### 健康检查端点

```bash
# API 健康检查
curl https://analytics.your-domain.com/api/analytics/dashboard/health
```

### 监控脚本

```bash
#!/bin/bash
# monitor.sh

API_URL="https://analytics.your-domain.com/api/analytics/dashboard/health"

response=$(curl -s -o /dev/null -w "%{http_code}" $API_URL)

if [ "$response" != "200" ]; then
    echo "Analytics API is down! HTTP $response"
    # 发送告警 (Slack/邮件等)
    curl -X POST "https://hooks.slack.com/services/xxx" \
        -d '{"text":"⚠️ Analytics API is down!"}'
fi
```

添加 cron:

```bash
# 每5分钟检查一次
*/5 * * * * /var/www/analytics/scripts/monitor.sh
```

### 日志管理

```bash
# 查看后端日志
pm2 logs analytics-api

# 或 systemd
journalctl -u analytics-api -f

# 模拟器日志
tail -f /tmp/analytics-simulator.log
```

### 数据库维护

```bash
# 定期优化
sqlite3 /var/data/analytics/analytics.db "VACUUM;"

# 检查完整性
sqlite3 /var/data/analytics/analytics.db "PRAGMA integrity_check;"
```

---

## 常见部署场景

### 场景 1: 单服务器部署

```
┌─────────────────────────────────────────┐
│              单台服务器                  │
│                                         │
│  ┌──────────┐     ┌──────────────────┐ │
│  │  Nginx   │────▶│  Node.js API     │ │
│  │ (反向代理)│     │  + 静态文件       │ │
│  └──────────┘     └────────┬─────────┘ │
│                            │            │
│                   ┌────────▼─────────┐ │
│                   │  SQLite 数据库    │ │
│                   └──────────────────┘ │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  Python 模拟器 (后台服务)          │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 场景 2: 容器化部署

```
┌─────────────────────────────────────────┐
│            Docker Compose               │
│                                         │
│  ┌──────────┐                           │
│  │  Traefik │  (反向代理 + SSL)          │
│  └────┬─────┘                           │
│       │                                 │
│  ┌────▼─────┐  ┌──────────────────────┐│
│  │ API 容器  │  │    模拟器容器         ││
│  │ Node.js  │  │    Python            ││
│  └────┬─────┘  └──────────────────────┘│
│       │                                 │
│  ┌────▼────────────────────────────┐   │
│  │      数据卷 (持久化存储)           │   │
│  │      SQLite + 备份               │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 场景 3: 云平台部署 (AWS/Azure/GCP)

```
                    ┌──────────────┐
                    │  CloudFlare  │
                    │  (CDN/WAF)   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │  负载均衡器   │
                    └──────┬───────┘
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
   ┌────▼────┐       ┌────▼────┐       ┌────▼────┐
   │ API 实例 │       │ API 实例 │       │ API 实例 │
   └────┬────┘       └────┬────┘       └────┬────┘
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
                    ┌──────▼───────┐
                    │  共享存储     │
                    │  (EFS/Blob)  │
                    └──────────────┘
```

---

## 安全加固

### 必做项

1. **修改默认密钥**
```bash
# 生成强密钥
openssl rand -base64 32  # JWT_SECRET
openssl rand -base64 24  # ADMIN_API_KEY
```

2. **启用 HTTPS**
```bash
# 使用 Let's Encrypt
certbot --nginx -d your-domain.com
```

3. **配置 CORS**
```javascript
// 仅允许特定域名
CORS_ORIGIN=https://your-app.com
```

4. **启用限流**
```javascript
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 100
}));
```

### 推荐项

- 使用 WAF (Web Application Firewall)
- 启用审计日志
- 定期安全扫描
- 数据加密传输

---

## 下一步

- [故障排除](TROUBLESHOOTING.md) - 解决常见问题
- [API 参考](API_REFERENCE.md) - API 详细文档
