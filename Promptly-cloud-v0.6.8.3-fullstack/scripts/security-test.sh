#!/bin/bash

# Promptly 安全测试脚本
# 用于验证应用的基本安全配置

echo "🔒 Promptly 安全测试开始..."

# 检查后端是否运行
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
echo "正在检查后端连接: $BACKEND_URL"

# 1. 测试健康检查端点
echo "1. 测试健康检查..."
health_response=$(curl -s -w "%{http_code}" "$BACKEND_URL/api/health" -o /tmp/health_response.json)
if [[ "$health_response" == "200" ]]; then
    echo "✅ 健康检查通过"
else
    echo "❌ 健康检查失败 (HTTP $health_response)"
fi

# 2. 测试CORS配置
echo "2. 测试CORS配置..."
cors_response=$(curl -s -w "%{http_code}" \
    -H "Origin: https://malicious-site.com" \
    -H "Access-Control-Request-Method: GET" \
    -H "Access-Control-Request-Headers: authorization" \
    -X OPTIONS \
    "$BACKEND_URL/api/settings" -o /tmp/cors_response.json)

if [[ "$cors_response" == "200" ]]; then
    access_control=$(curl -s -I \
        -H "Origin: https://malicious-site.com" \
        "$BACKEND_URL/api/settings" | grep -i "access-control-allow-origin")
    
    if [[ "$access_control" == *"*"* ]]; then
        echo "⚠️ 警告: CORS配置允许所有来源"
    else
        echo "✅ CORS配置安全"
    fi
else
    echo "✅ CORS预检请求被拒绝"
fi

# 3. 测试速率限制
echo "3. 测试速率限制..."
rate_limit_count=0
for i in {1..15}; do
    response_code=$(curl -s -w "%{http_code}" "$BACKEND_URL/api/settings" -o /dev/null)
    if [[ "$response_code" == "200" ]]; then
        ((rate_limit_count++))
    elif [[ "$response_code" == "429" ]]; then
        echo "✅ 速率限制在第 $i 次请求后生效"
        break
    fi
done

if [[ $rate_limit_count -eq 15 ]]; then
    echo "⚠️ 警告: 速率限制可能未正确配置"
fi

# 4. 测试SQL注入防护
echo "4. 测试SQL注入防护..."
sql_injection_payload="'; DROP TABLE users; --"
sql_response=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$sql_injection_payload\",\"password\":\"test\"}" \
    "$BACKEND_URL/api/auth/login" -o /tmp/sql_response.json)

if [[ "$sql_response" == "400" ]]; then
    echo "✅ SQL注入防护有效"
else
    echo "⚠️ 警告: SQL注入防护可能有问题 (HTTP $sql_response)"
fi

# 5. 测试大请求防护
echo "5. 测试大请求防护..."
large_payload=$(printf 'A%.0s' {1..1048576})  # 1MB的A
large_response=$(curl -s -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "{\"data\":\"$large_payload\"}" \
    "$BACKEND_URL/api/specs" \
    -m 10 \
    -o /tmp/large_response.json)

if [[ "$large_response" == "413" ]]; then
    echo "✅ 大请求防护有效"
elif [[ "$large_response" == "401" ]]; then
    echo "✅ 请求需要认证（正常）"
else
    echo "⚠️ 警告: 大请求防护可能有问题 (HTTP $large_response)"
fi

# 6. 测试安全头部
echo "6. 测试安全头部..."
headers_response=$(curl -s -I "$BACKEND_URL/api/health")

# 检查关键安全头部
if echo "$headers_response" | grep -qi "x-content-type-options"; then
    echo "✅ X-Content-Type-Options 头部存在"
else
    echo "⚠️ 缺少 X-Content-Type-Options 头部"
fi

if echo "$headers_response" | grep -qi "x-frame-options"; then
    echo "✅ X-Frame-Options 头部存在"
else
    echo "⚠️ 缺少 X-Frame-Options 头部"
fi

if echo "$headers_response" | grep -qi "content-security-policy"; then
    echo "✅ Content-Security-Policy 头部存在"
else
    echo "⚠️ 缺少 Content-Security-Policy 头部"
fi

# 7. 检查环境变量配置
echo "7. 检查安全配置..."
if [[ -n "$JWT_SECRET" ]] && [[ "$JWT_SECRET" != "dev" ]] && [[ ${#JWT_SECRET} -gt 32 ]]; then
    echo "✅ JWT_SECRET 配置安全"
else
    echo "⚠️ 警告: JWT_SECRET 需要设置为强密钥（长度>32字符）"
fi

if [[ -n "$CORS_ORIGIN" ]] && [[ "$CORS_ORIGIN" != "*" ]]; then
    echo "✅ CORS_ORIGIN 配置安全"
else
    echo "⚠️ 警告: CORS_ORIGIN 应设置为具体域名，不要使用通配符"
fi

# 清理临时文件
rm -f /tmp/health_response.json /tmp/cors_response.json /tmp/sql_response.json /tmp/large_response.json

echo ""
echo "🔒 安全测试完成"
echo "📋 请查看上述结果并修复任何⚠️警告项目"
echo ""
echo "💡 建议:"
echo "- 设置强的JWT_SECRET环境变量"
echo "- 配置具体的CORS_ORIGIN域名"
echo "- 在生产环境禁用详细错误信息"
echo "- 定期更新依赖包"
echo "- 启用HTTPS并配置SSL证书"