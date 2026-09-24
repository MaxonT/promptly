#!/bin/bash

# Promptly 部署测试脚本
# 使用方法：./test-deployment.sh [BACKEND_URL]

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 默认后端 URL
BACKEND_URL="${1:-https://promptly-v0-6-cloudtest-cursor-dev.onrender.com}"

echo -e "${BLUE}=========================================${NC}"
echo -e "${BLUE}Promptly 部署测试${NC}"
echo -e "${BLUE}=========================================${NC}"
echo -e "后端 URL: ${YELLOW}$BACKEND_URL${NC}"
echo ""

# 测试函数
test_endpoint() {
    local name="$1"
    local url="$2"
    local method="${3:-GET}"
    local data="$4"
    
    echo -e "${BLUE}测试: $name${NC}"
    echo -e "URL: $url"
    
    if [ "$method" = "POST" ] && [ -n "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X POST "$url" \
            -H "Content-Type: application/json" \
            -d "$data" 2>&1)
    else
        response=$(curl -s -w "\n%{http_code}" "$url" 2>&1)
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" = "200" ] || [ "$http_code" = "201" ]; then
        echo -e "${GREEN}✅ 成功 (HTTP $http_code)${NC}"
        echo "$body" | head -n 10
    else
        echo -e "${RED}❌ 失败 (HTTP $http_code)${NC}"
        echo "$body" | head -n 10
    fi
    echo ""
}

# 1. 测试后端根路径
test_endpoint "后端根路径" "$BACKEND_URL/"

# 2. 测试健康检查
test_endpoint "健康检查" "$BACKEND_URL/api/health"

# 3. 测试设置端点
test_endpoint "设置端点" "$BACKEND_URL/api/settings"

# 4. 测试 Pipeline 健康检查
test_endpoint "Pipeline 健康检查" "$BACKEND_URL/api/pipeline/health"

# 5. 测试 Pipeline API
test_endpoint "Pipeline API" "$BACKEND_URL/api/pipeline/run" "POST" \
    '{"idea": "写一个 Python 函数计算斐波那契数列", "skipQuestions": true}'

echo -e "${BLUE}=========================================${NC}"
echo -e "${GREEN}测试完成！${NC}"
echo -e "${BLUE}=========================================${NC}"
echo ""
echo -e "如果所有测试都显示 ${GREEN}✅ 成功${NC}，说明后端部署正常。"
echo ""
echo -e "下一步："
echo -e "1. 在 Vercel 设置环境变量 ${YELLOW}VITE_API_BASE=$BACKEND_URL${NC}"
echo -e "2. 重新部署前端"
echo -e "3. 在浏览器中测试前端功能"
echo ""

