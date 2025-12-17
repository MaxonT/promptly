# 🧪 i18n 修复测试指南

## 快速测试步骤

### 1. 启动本地服务器

```bash
cd frontend
python3 -m http.server 8080
```

或使用任何其他静态文件服务器。

### 2. 打开浏览器

访问：`http://localhost:8080/index.html`

### 3. 打开浏览器控制台

快捷键：
- Chrome/Edge: `F12` 或 `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
- Firefox: `F12` 或 `Cmd+Option+K` (Mac) / `Ctrl+Shift+K` (Windows)
- Safari: `Cmd+Option+C` (需要先在偏好设置中启用开发者菜单)

### 4. 检查控制台日志

**期望看到的日志：**

```
[i18n] Detected language: zh-CN
[i18n] ✅ Initialization successful!
[i18n] Current language: zh-CN
[i18n] Loaded locales: ["zh-CN", "en"]
[i18n] Available resources: ["zh-CN", "en"]
[i18n] Test translation (whyPromptly.title): ✨ 为什么 Promptly 胜过普通 AI 模型
[i18n] Translation successful: true
[i18n] Language selector current value: zh-CN
[i18n] Language selector has 9 options
[i18n] i18next instance exists: true
[i18n] Translation complete: 196 successful, 0 failed
```

**❌ 如果看到错误：**

```
[i18n] Failed to load translations for zh-CN HTTP 404
```
→ 检查 `frontend/locales/zh-CN.json` 文件是否存在

```
[i18n] Test translation (whyPromptly.title): whyPromptly.title
[i18n] Translation successful: false
```
→ 翻译资源未正确加载到 i18next

```
[i18n] Translation complete: 0 successful, 196 failed
```
→ 所有翻译都失败了，需要检查 i18next 配置

### 5. 检查页面内容

| 元素位置 | 应该显示的内容 | 不应该显示 |
|---------|--------------|-----------|
| Why Promptly 标题 | ✨ 为什么 Promptly 胜过普通 AI 模型 | ❌ whyPromptly.title |
| Pipeline 说明 | Promptly's pipeline will show... | ❌ pipeline.hint |
| 顶部导航 | 开始使用、规格、结果、结果... | ❌ nav.start, nav.specs... |
| 语言下拉框 | 中文简体、English、Español... | ❌ language.zh-CN... |

### 6. 测试语言切换

1. 点击右上角的语言下拉框
2. 选择 "English"
3. **检查控制台**：
   ```
   [i18n] Changing language to: en
   [i18n] Translation complete: 196 successful, 0 failed
   ```
4. **检查页面内容**：
   - Why Promptly 标题应变为：`✨ Why Promptly beats a plain AI model`
   - 页面方向应保持 `ltr` (左到右)

5. 选择 "العربية" (阿拉伯语)
6. **检查控制台**：
   ```
   [i18n] Changing language to: ar
   [i18n] Translation complete: 196 successful, 0 failed
   ```
7. **检查页面内容**：
   - 页面方向应变为 `rtl` (右到左)
   - 文本应显示阿拉伯语
   - 数字应正确显示

### 7. 测试其他页面

重复测试以下页面：
- `wizard.html` - 向导页面
- `specs.html` - 规格页面
- `result.html` - 结果页面
- `outcome.html` - 结果运行器页面
- `enhancer.html` - 增强器页面
- `settings.html` - 设置页面

## 详细诊断命令

如果需要深入诊断，在浏览器控制台中运行：

### 检查 i18n 实例

```javascript
// 检查 i18nManager 是否存在
console.log('i18nManager exists:', !!window.i18nManager);
console.log('i18next instance:', window.i18nManager?.instance);

// 检查当前语言
console.log('Current language:', window.i18nManager?.instance?.language);

// 检查加载的资源
console.log('Loaded resources:', 
  Object.keys(window.i18nManager?.instance?.store?.data || {}));

// 查看实际的翻译数据
console.log('zh-CN translations:', 
  window.i18nManager?.instance?.store?.data?.['zh-CN']?.translation);
```

### 手动测试翻译

```javascript
// 测试特定键的翻译
const testKeys = [
  'whyPromptly.title',
  'pipeline.topPick',
  'hero.title',
  'nav.start'
];

testKeys.forEach(key => {
  const result = window.i18nManager.instance.t(key);
  const success = result !== key;
  console.log(`${success ? '✅' : '❌'} ${key}:`, result);
});
```

### 手动触发翻译

```javascript
// 强制重新翻译页面
window.i18nManager.translatePage();
```

### 检查 DOM 元素

```javascript
// 查看所有 data-i18n 元素
const i18nElements = document.querySelectorAll('[data-i18n]');
console.log(`Found ${i18nElements.length} elements with data-i18n`);

// 检查前 10 个元素
Array.from(i18nElements).slice(0, 10).forEach(el => {
  console.log({
    key: el.dataset.i18n,
    text: el.textContent?.substring(0, 50),
    tag: el.tagName
  });
});
```

## 常见问题排查

### 问题 1：翻译文件 404

**症状：**
```
GET http://localhost:8080/locales/zh-CN.json 404 (Not Found)
```

**解决方法：**
```bash
# 检查文件是否存在
ls -la frontend/locales/

# 确保所有 JSON 文件都在
# 应该看到：ar.json, en.json, es.json, fr.json, hi.json, ja.json, ko.json, pt.json, zh-CN.json
```

### 问题 2：JSON 格式错误

**症状：**
```
SyntaxError: Unexpected token in JSON at position ...
```

**解决方法：**
```bash
# 验证 JSON 文件
python3 -m json.tool frontend/locales/zh-CN.json > /dev/null
echo $?  # 应该返回 0

# 如果有错误，会显示具体位置
```

### 问题 3：仍然显示键名

**症状：**
- 控制台显示 `Translation successful: false`
- 页面仍显示 `whyPromptly.title` 而不是中文

**可能原因：**
1. 翻译资源结构不正确
2. keySeparator 配置问题
3. 缓存问题

**解决方法：**
```javascript
// 在控制台中检查翻译数据结构
const data = window.i18nManager.instance.store.data['zh-CN'].translation;
console.log('whyPromptly structure:', data.whyPromptly);
// 应该看到: { title: "...", subtitle: "...", ... }

// 如果看到 undefined，说明数据结构有问题
```

### 问题 4：语言切换不生效

**症状：**
- 选择新语言后页面没有变化

**解决方法：**
```javascript
// 检查语言是否真的改变了
window.i18nManager.instance.on('languageChanged', (lng) => {
  console.log('Language changed to:', lng);
});

// 手动切换语言
window.i18nManager.changeLanguage('en');
```

## 性能测试

### 翻译速度

```javascript
// 测量翻译时间
console.time('translatePage');
window.i18nManager.translatePage();
console.timeEnd('translatePage');
// 应该 < 100ms
```

### 内存使用

```javascript
// 检查加载的翻译数据大小
const data = window.i18nManager.instance.store.data;
const size = JSON.stringify(data).length;
console.log(`Translation data size: ${(size / 1024).toFixed(2)} KB`);
// 应该 < 500 KB for all languages
```

## 成功标准

✅ **全部通过以下测试才算成功：**

1. [ ] 控制台无错误
2. [ ] "Translation successful: true"
3. [ ] "Translation complete: 196 successful, 0 failed"
4. [ ] 所有页面元素显示正确的翻译文本
5. [ ] 语言切换工作正常
6. [ ] RTL 语言（阿拉伯语）布局正确
7. [ ] 所有 9 种语言都能正常显示

## 如果测试失败

请提供以下信息：
1. 浏览器版本和类型
2. 完整的控制台日志
3. 失败的具体步骤
4. 页面截图
5. Network 面板中 locale 文件的加载状态

---

**测试完成后，请在此标记结果：**

- [ ] ✅ 测试通过 - 所有翻译正常显示
- [ ] ⚠️ 部分问题 - 某些语言或元素有问题
- [ ] ❌ 测试失败 - 翻译仍然不工作

测试人：________________  
测试日期：________________  
浏览器：________________


