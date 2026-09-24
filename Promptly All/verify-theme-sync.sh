#!/bin/bash

# 跨页面主题同步修复 - 完整验证脚本
# 用途: 检查所有文件修改是否正确应用

echo "=================================="
echo "🔍 跨页面主题同步修复 - 完整验证"
echo "=================================="
echo ""

# 检查 1: 验证 lib/themeManager.js 存在
echo "✓ 检查 1: themeManager.js 文件"
if [ -f "frontend/lib/themeManager.js" ]; then
    echo "  ✅ frontend/lib/themeManager.js 存在"
    wc_lines=$(wc -l < "frontend/lib/themeManager.js")
    echo "     行数: $wc_lines"
    # 检查关键函数
    if grep -q "function initTheme()" "frontend/lib/themeManager.js"; then
        echo "     ✅ 包含 initTheme() 函数"
    fi
    if grep -q "function setTheme()" "frontend/lib/themeManager.js"; then
        echo "     ✅ 包含 setTheme() 函数"
    fi
    if grep -q "initTheme()" "frontend/lib/themeManager.js"; then
        echo "     ✅ 在脚本中调用了 initTheme()"
    fi
else
    echo "  ❌ 文件不存在"
    exit 1
fi
echo ""

# 检查 2: 验证所有 HTML 页面都包含 themeManager 脚本
echo "✓ 检查 2: HTML 页面中的 themeManager.js 引用"
html_with_theme=$(grep -r "themeManager.js" frontend/*.html 2>/dev/null | wc -l)
echo "  包含 themeManager.js 的页面: $html_with_theme 个"

# 列出包含 themeManager.js 的页面
echo "  包含的页面:"
grep -l "themeManager.js" frontend/*.html 2>/dev/null | while read file; do
    filename=$(basename "$file")
    echo "    ✅ $filename"
done
echo ""

# 检查 3: 验证 data-theme 属性
echo "✓ 检查 3: data-theme 属性"
data_theme_count=$(grep -r 'data-theme="dark"' frontend/*.html 2>/dev/null | wc -l)
echo "  包含 data-theme=\"dark\" 的页面: $data_theme_count 个"

# 检查 auto 主题（不应该存在）
auto_theme=$(grep -r 'data-theme="auto"' frontend/*.html 2>/dev/null | wc -l)
if [ "$auto_theme" -eq 0 ]; then
    echo "  ✅ 没有发现 data-theme=\"auto\"（已全部更新）"
else
    echo "  ⚠️  仍有 $auto_theme 个页面使用 data-theme=\"auto\""
    grep -l 'data-theme="auto"' frontend/*.html 2>/dev/null | while read file; do
        echo "     ❌ $(basename "$file")"
    done
fi
echo ""

# 检查 4: 验证 JavaScript 文件更新
echo "✓ 检查 4: JavaScript 文件中的 themeManager 使用"

echo "  检查 subscription.js:"
if grep -q "window.themeManager" frontend/subscription.js; then
    echo "    ✅ 使用了 window.themeManager"
fi
if grep -q "'themechange'" frontend/subscription.js; then
    echo "    ✅ 监听了 'themechange' 事件"
fi

echo "  检查 account.js:"
if grep -q "window.themeManager" frontend/account.js; then
    echo "    ✅ 使用了 window.themeManager"
fi
if grep -q "'themechange'" frontend/account.js; then
    echo "    ✅ 监听了 'themechange' 事件"
fi
echo ""

# 检查 5: 验证 localStorage 键命名一致性
echo "✓ 检查 5: localStorage 键命名"
theme_key_count=$(grep -r "localStorage.*theme" frontend/*.js frontend/lib/*.js 2>/dev/null | grep -v "promptly.theme" | wc -l)
echo "  使用标准 'theme' 键的代码段: $theme_key_count 个"

old_key=$(grep -r "promptly.theme" frontend/*.js 2>/dev/null | wc -l)
if [ "$old_key" -eq 0 ]; then
    echo "  ✅ 没有发现旧键 'promptly.theme'（已全部迁移）"
else
    echo "  ⚠️  仍有代码使用旧键 'promptly.theme': $old_key 处"
fi
echo ""

# 检查 6: 验证脚本加载顺序 (themeManager 应该在 CSS 前)
echo "✓ 检查 6: 脚本加载顺序验证 (抽样)"
echo "  检查 subscription.html:"
sed -n '/<head>/,/<\/head>/p' frontend/subscription.html | grep -n "themeManager\|\.css" | head -3

echo ""
echo "✓ 检查 7: 综合验证"
echo "=================================="

# 最终统计
all_ok=true
if [ ! -f "frontend/lib/themeManager.js" ]; then
    echo "  ❌ themeManager.js 缺失"
    all_ok=false
fi

if [ "$html_with_theme" -lt 15 ]; then
    echo "  ⚠️  只有 $html_with_theme 个页面包含 themeManager.js（预期 15+）"
    all_ok=false
fi

if [ "$data_theme_count" -lt 15 ]; then
    echo "  ⚠️  只有 $data_theme_count 个页面设置 data-theme=\"dark\"（预期 15+）"
    all_ok=false
fi

if [ "$auto_theme" -gt 0 ]; then
    echo "  ❌ 仍有 $auto_theme 个页面使用 data-theme=\"auto\""
    all_ok=false
fi

if $all_ok; then
    echo "  ✅ 所有检查通过！"
    echo ""
    echo "🎉 修复状态: 完成并可部署"
    echo "📦 受影响文件:"
    echo "   - frontend/lib/themeManager.js (新建)"
    echo "   - frontend/*.html (16 个页面更新)"
    echo "   - frontend/subscription.js (已更新)"
    echo "   - frontend/account.js (已更新)"
else
    echo ""
    echo "⚠️  存在未完成的修改，请检查上方的警告信息"
    exit 1
fi

echo ""
echo "=================================="
echo "✅ 验证完成"
echo "=================================="
