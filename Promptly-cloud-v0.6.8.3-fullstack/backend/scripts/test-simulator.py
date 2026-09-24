#!/usr/bin/env python3
"""测试行为模拟器API调用"""

import requests
import os

API_BASE = os.environ.get("API_BASE", "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com")
ENDPOINT = f"{API_BASE}/api/analytics/dashboard/admin/generate-data"

print(f"测试目标: {ENDPOINT}")
print("=" * 60)

# 测试请求
data = {
    "users": 2,
    "sessions": 3
}

headers = {
    "X-Admin-Key": os.environ.get("ADMIN_API_KEY", "")
}

print(f"发送数据: {data}")
print(f"请求头: X-Admin-Key={'[已设置]' if headers['X-Admin-Key'] else '[未设置]'}")
print()

try:
    response = requests.post(ENDPOINT, json=data, headers=headers, timeout=15)
    print(f"状态码: {response.status_code}")
    print(f"响应头: Content-Type = {response.headers.get('Content-Type')}")
    print()
    print("响应内容:")
    print(response.text)
    print()
    
    if response.status_code == 200:
        result = response.json()
        if result.get("ok"):
            print("✅ API调用成功！")
        else:
            print(f"❌ API返回错误: {result.get('error')}")
    else:
        print(f"❌ HTTP错误: {response.status_code}")
        
except requests.exceptions.ConnectionError as e:
    print(f"❌ 连接错误: {e}")
except requests.exceptions.Timeout:
    print("❌ 请求超时")
except Exception as e:
    print(f"❌ 未知错误: {e}")
