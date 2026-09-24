# 快速测试指南

## 🧪 测试任务 1：行为模拟器降速

### 方法 1：查看配置
```bash
cd backend
grep -A 3 "等待时间" scripts/behavior-simulator.py
```

**预期输出**:
```python
# 等待时间 (秒) - 降速到75%: 原等待时间 × 1.33
"MIN_WAIT": 960,    # 16分钟 (原12分钟 × 1.33)
"MAX_WAIT": 7680,   # 128分钟 ≈ 2.1小时 (原96分钟 × 1.33)
```

### 方法 2：运行模拟器观察
```bash
cd backend
./scripts/manage.sh stop   # 停止现有模拟器
./scripts/manage.sh start  # 启动新配置模拟器
tail -f ../logs/behavior-simulator.log
```

**观察要点**:
- 查找日志中的 "⏳ 等待 XXX 秒后执行下一轮"
- 等待时间应该在 960-7680 秒之间（16-128分钟）

---

## 🎨 测试任务 2：明亮主题

### 方法 1：本地预览
1. 打开浏览器访问：
   ```
   file:///Users/yangming/Desktop/Github/Promptly-v0.6-CloudTest/Promptly-cloud-v0.6.8.3-fullstack/frontend/analytics-dashboard.html
   ```

2. 查看页面右上角，应该看到 "Theme" 按钮

3. 点击 "Theme" 按钮：
   - 页面应从深色切换到明亮模式
   - 背景变为浅灰白色
   - 文字变为深色
   - 图标从月亮变为太阳

4. 刷新页面：
   - 主题设置应该保持（记忆功能）

### 方法 2：云端测试
部署后访问：
```
https://promptly-v0-6-cloudtest-1.onrender.com/analytics-dashboard.html
```

执行相同的测试步骤。

---

## ✅ 验证清单

### 行为模拟器验证
- [ ] MIN_WAIT = 960 秒
- [ ] MAX_WAIT = 7680 秒
- [ ] 注释说明"降速到75%"
- [ ] 运行日志显示正确的等待时间

### 明亮主题验证
- [ ] HTML 中有 themeToggle 按钮
- [ ] CSS 中有 [data-theme="light"] 样式规则
- [ ] JS 中有主题切换逻辑
- [ ] 点击按钮能切换主题
- [ ] 主题设置能持久化（刷新后保持）
- [ ] 所有组件在明亮模式下正常显示
- [ ] 图标正确切换（月亮 ↔ 太阳）

---

## 🐛 故障排除

### 问题：明亮主题不生效
**解决方法**:
1. 清除浏览器缓存（硬刷新：Cmd+Shift+R）
2. 检查浏览器开发者工具 Console 是否有错误
3. 验证 `data-theme` 属性是否正确设置在 `<html>` 标签上

### 问题：主题切换按钮不显示
**解决方法**:
1. 确认 HTML 文件已更新
2. 检查 CSS 中是否有 `.theme-toggle` 样式
3. 查看浏览器开发者工具 Elements 面板，确认按钮存在

### 问题：模拟器速度未改变
**解决方法**:
1. 确认 Python 文件已更新
2. 必须重启模拟器才能生效（`./scripts/manage.sh restart`）
3. 检查日志中的等待时间是否为 960-7680 秒

---

## 📊 预期结果

### 任务 1 成功标志
- 模拟器每次生成数据后的等待时间**延长约 33%**
- 日志中显示的等待时间在 16-128 分钟之间
- 数据生成速度明显变慢

### 任务 2 成功标志
- 点击 Theme 按钮后：
  - 深色模式：深蓝黑背景，浅色文字，月亮图标
  - 明亮模式：浅灰白背景，深色文字，太阳图标
- localStorage 中存储 `theme` 键值
- 刷新页面后设置保持

---

## 🚀 部署后验证命令

```bash
# 1. 验证前端文件
curl -I https://promptly-v0-6-cloudtest-1.onrender.com/analytics-dashboard.css | grep "200 OK"
curl -I https://promptly-v0-6-cloudtest-1.onrender.com/analytics-dashboard.js | grep "200 OK"

# 2. 验证主题切换（打开浏览器手动测试）
open https://promptly-v0-6-cloudtest-1.onrender.com/analytics-dashboard.html

# 3. 验证模拟器配置（SSH 到服务器后）
cd backend
grep "MIN_WAIT\|MAX_WAIT" scripts/behavior-simulator.py
```

---

## 📝 注意事项

1. **行为模拟器**需要重启才能应用新配置
2. **前端主题**需要硬刷新清除缓存
3. **localStorage** 是浏览器本地存储，不同浏览器独立
4. **深色模式**是默认主题，明亮模式需要手动切换

---

**测试完成时间**: ___________  
**测试人员**: ___________  
**测试结果**: ⬜ 通过 / ⬜ 失败  
