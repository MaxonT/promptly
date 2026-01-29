# Render 服务保活脚本使用指南

## 概述
此脚本每 10 分钟 ping 一次你的后端服务，防止 Render 上的免费层应用因不活跃而进入休眠状态。

## 安装和使用步骤

### 1. 赋予脚本执行权限
```bash
chmod +x keep-alive.sh
```

### 2. 测试脚本运行
```bash
./keep-alive.sh
```

你应该看到日志文件被创建在：`~/.promptly-keepalive.log`

查看日志：
```bash
cat ~/.promptly-keepalive.log
```

### 3. 设置 cron 定时任务

打开 crontab 编辑器：
```bash
crontab -e
```

在文件末尾添加以下一行（每 10 分钟执行一次）：
```bash
*/10 * * * * /Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/keep-alive.sh
```

> ⚠️ **重要**：请将上面路径中的 `yangming` 替换为你实际的用户名，或使用 `$HOME` 替代：
```bash
*/10 * * * * $HOME/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/keep-alive.sh
```

### 4. 验证 cron 已安装
```bash
crontab -l
```

应该能看到你刚添加的任务。

## 日志查看
查看最新的日志消息：
```bash
tail -f ~/.promptly-keepalive.log
```

清空日志：
```bash
> ~/.promptly-keepalive.log
```

## 如何更改 ping 频率

在 crontab 中修改时间间隔：
- `*/5 * * * *` - 每 5 分钟
- `*/10 * * * *` - 每 10 分钟 ✓ (默认)
- `*/15 * * * *` - 每 15 分钟
- `*/30 * * * *` - 每 30 分钟
- `0 * * * *` - 每小时

## 停止保活脚本

删除 cron 任务：
```bash
crontab -e
# 删除对应的那一行，保存并退出
```

## 故障排查

### 脚本不执行
1. 检查权限：`ls -la keep-alive.sh` 应该显示 `rwxr-xr-x`
2. 检查路径：在 crontab 中使用完整的绝对路径
3. 查看系统日志：`log stream --predicate 'eventMessage contains[cd] "keep-alive"'`

### 服务响应失败
- 检查 URL 是否正确：`curl https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/health`
- 确保网络连接正常
- 检查 Render 服务是否在线

## 使用 Node.js 替代方案（可选）

如果你更喜欢 Node.js，也可以使用：

```bash
node -e "
const http = require('http');
const https = require('https');
const url = 'https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/health';
https.get(url, (res) => {
  console.log(\`[\$(new Date().toISOString())] Status: \${res.statusCode}\`);
}).on('error', (e) => {
  console.error(\`Error: \${e.message}\`);
});
"
```

加入 crontab：
```bash
*/10 * * * * node -e "const https=require('https');https.get('https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/api/health',(r)=>console.log(\`[\$(new Date().toISOString())] \${r.statusCode}\`)).on('error',e=>console.error(e))"
```
