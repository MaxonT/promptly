#!/bin/bash

# Promptly Cloud 部署检查脚本
# 此脚本帮助你快速验证部署配置是否正确

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Promptly Cloud 部署配置检查工具"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# 检查 config.js 文件
echo -e "${BLUE}[1/4]${NC} 检查前端配置文件..."
if [ ! -f "frontend/config.js" ]; then
    echo -e "${RED}✗${NC} 文件 frontend/config.js 不存在！"
    exit 1
fi

# 提取 API Base URL
API_BASE=$(grep "window.PROMPTLY_API_BASE" frontend/config.js | grep -v "^//" | grep -o '"[^"]*"' | tr -d '"' || echo "")

if [ -z "$API_BASE" ] || [ "$API_BASE" = "null" ]; then
    echo -e "${YELLOW}⚠${NC} 警告: 未配置 API Base URL"
    echo "   请编辑 frontend/config.js 并设置后端 URL"
    echo ""
    read -p "请输入你的后端 URL (例如: https://promptly-xxx.onrender.com): " INPUT_URL
    if [ ! -z "$INPUT_URL" ]; then
        API_BASE="$INPUT_URL"
        echo "   将使用: $API_BASE"
    else
        echo -e "${RED}✗${NC} 未提供 URL，退出检查"
        exit 1
    fi
elif [[ "$API_BASE" == *"YOUR-BACKEND-URL-HERE"* ]]; then
    echo -e "${RED}✗${NC} API Base URL 包含占位符，需要替换为实际 URL"
    echo "   当前值: $API_BASE"
    echo ""
    read -p "请输入你的后端 URL (例如: https://promptly-xxx.onrender.com): " INPUT_URL
    if [ ! -z "$INPUT_URL" ]; then
        API_BASE="$INPUT_URL"
        echo "   将使用: $API_BASE"
    else
        echo -e "${RED}✗${NC} 未提供 URL，退出检查"
        exit 1
    fi
else
    echo -e "${GREEN}✓${NC} 配置文件存在且已设置 API Base"
    echo "   API Base: $API_BASE"
fi

# 检查后端健康状态
echo ""
echo -e "${BLUE}[2/4]${NC} 测试后端连接..."
if command -v curl &> /dev/null; then
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${API_BASE}/api/health" || echo "000")
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✓${NC} 后端健康检查通过 (HTTP 200)"
        HEALTH_DATA=$(curl -s "${API_BASE}/api/health")
        echo "   响应: $HEALTH_DATA"
    else
        echo -e "${RED}✗${NC} 后端健康检查失败 (HTTP $HTTP_CODE)"
        echo "   URL: ${API_BASE}/api/health"
        echo ""
        echo "   可能原因："
        echo "   1. 后端未部署或未运行"
        echo "   2. URL 配置错误"
        echo "   3. 网络连接问题"
        exit 1
    fi
else
    echo -e "${YELLOW}⚠${NC} 未安装 curl，跳过后端测试"
fi

# 检查 CORS 配置建议
echo ""
echo -e "${BLUE}[3/4]${NC} 检查前端文件..."
HTML_FILES=$(find frontend -name "*.html" -type f | wc -l)
echo -e "${GREEN}✓${NC} 找到 $HTML_FILES 个 HTML 文件"

CONFIG_REFS=$(grep -r "config.js" frontend/*.html 2>/dev/null | wc -l)
if [ "$CONFIG_REFS" -gt 0 ]; then
    echo -e "${GREEN}✓${NC} HTML 文件已引用 config.js ($CONFIG_REFS 个)"
else
    echo -e "${RED}✗${NC} HTML 文件未引用 config.js"
    echo "   请在所有 HTML 的 <head> 中添加: <script src=\"config.js\"></script>"
fi

# 检查测试页面
echo ""
echo -e "${BLUE}[4/4]${NC} 检查测试工具..."
if [ -f "frontend/test-connection.html" ]; then
    echo -e "${GREEN}✓${NC} 连接测试页面存在"
    echo "   部署后访问: https://your-domain/test-connection.html"
else
    echo -e "${YELLOW}⚠${NC} 未找到测试页面"
fi

# 总结和建议
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}检查完成！${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "下一步操作："
echo "  1. 如果后端 URL 需要更新，编辑: frontend/config.js"
echo "  2. 重新部署前端到 Vercel/Netlify"
echo "  3. 访问测试页面验证连接: /test-connection.html"
echo "  4. 在 Render 中设置 CORS_ORIGIN 为你的前端 URL"
echo ""
echo "详细文档："
echo "  - 完整部署指南: DEPLOYMENT_GUIDE.md"
echo "  - 快速修复 404: UPDATE_CONFIG.md"
echo ""
echo "需要帮助？联系: PromptlyGuli@gmail.com"
echo ""

