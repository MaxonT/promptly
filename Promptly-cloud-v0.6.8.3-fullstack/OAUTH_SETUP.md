# OAuth 登录配置指南

## 概述

为了启用 Google 和 GitHub OAuth 登录功能，您需要完成以下配置步骤。

## 必需的环境变量

在您的 `.env` 文件中（或在部署平台的环境变量设置中）添加以下变量：

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_client_id_here
GITHUB_CLIENT_SECRET=your_github_client_secret_here

# OAuth Redirect URI (可选，如果不设置会自动生成)
# 格式：https://your-domain.com/api/auth/oauth/callback
OAUTH_REDIRECT_URI=https://your-domain.com/api/auth/oauth/callback
```

## 配置步骤

### 1. Google OAuth 配置

#### 1.1 创建 Google OAuth 应用

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 "Google+ API"
4. 进入 "Credentials" → "Create Credentials" → "OAuth client ID"
5. 选择应用类型为 "Web application"
6. 配置授权重定向 URI：
   - 开发环境：`http://localhost:8080/api/auth/oauth/callback`
   - 生产环境：`https://your-domain.com/api/auth/oauth/callback`
7. 保存后，您将获得：
   - **Client ID** → 填入 `GOOGLE_CLIENT_ID`
   - **Client Secret** → 填入 `GOOGLE_CLIENT_SECRET`

#### 1.2 配置授权屏幕

1. 在 Google Cloud Console 中，进入 "OAuth consent screen"
2. 选择用户类型（通常选择 "External"）
3. 填写应用信息（应用名称、用户支持邮箱等）
4. 添加范围（Scopes）：
   - `email`
   - `profile`
   - `openid`
5. 添加测试用户（如果应用处于测试阶段）

### 2. GitHub OAuth 配置

#### 2.1 创建 GitHub OAuth App

1. 访问 GitHub Settings → Developer settings → OAuth Apps
2. 点击 "New OAuth App"
3. 填写应用信息：
   - **Application name**: 您的应用名称（例如：Promptly）
   - **Homepage URL**: `https://your-domain.com` 或 `http://localhost:8080`
   - **Authorization callback URL**: 
     - 开发环境：`http://localhost:8080/api/auth/oauth/callback`
     - 生产环境：`https://your-domain.com/api/auth/oauth/callback`
4. 点击 "Register application"
5. 在应用页面中：
   - **Client ID** → 填入 `GITHUB_CLIENT_ID`
   - 点击 "Generate a new client secret" → 填入 `GITHUB_CLIENT_SECRET`

## 部署配置

### 本地开发

1. 在项目根目录创建或编辑 `.env` 文件
2. 添加上述环境变量
3. 重启后端服务

### 生产环境（如 Render.com）

1. 在 Render Dashboard 中选择您的服务
2. 进入 "Environment" 标签
3. 添加所有必需的环境变量
4. 重新部署服务

## 验证配置

配置完成后，验证步骤：

1. **检查后端日志**：启动后端服务，查看是否有 OAuth 相关的错误
2. **测试 OAuth 按钮**：
   - 访问主页面，点击右上角的 "Sign in with Google" 或 "Sign in with GitHub"
   - 应该能正常跳转到 OAuth 提供商的登录页面
3. **检查回调**：完成 OAuth 登录后，应该能正确返回到您的应用并完成登录

## 注意事项

1. **安全性**：
   - 不要将 Client Secret 提交到版本控制系统
   - 确保在生产环境使用 HTTPS
   - Client Secret 应该保密

2. **Redirect URI**：
   - Google 和 GitHub 都需要精确匹配配置的 Redirect URI
   - 确保开发和生产环境使用不同的 OAuth 应用（或配置多个 Redirect URI）

3. **测试模式**：
   - Google OAuth 应用在测试模式下只能被添加到测试用户列表的用户使用
   - 需要发布应用或添加测试用户才能正常测试

4. **数据库**：
   - 确保数据库已运行迁移，包含 `user_oauth` 表（如果需要链接多个 OAuth 提供商）

## 故障排查

### 问题：OAuth 按钮点击后没有反应

- 检查浏览器控制台是否有错误
- 确认 `frontend/lib/oauth.js` 已正确加载
- 检查后端 `/api/auth/oauth/:provider/authorize` 端点是否正常

### 问题：OAuth 登录后无法返回

- 检查 Redirect URI 是否与 OAuth 应用配置中的完全一致
- 检查后端 `/api/auth/oauth/callback` 路由是否正常
- 查看后端日志中的错误信息

### 问题：提示 "OAuth not configured"

- 确认所有必需的环境变量都已设置
- 检查环境变量名称是否正确（区分大小写）
- 重启后端服务以加载新的环境变量

## 可选配置

如果您的应用需要额外的 OAuth 权限（如访问用户的其他信息），可以在 OAuth 应用中添加相应的 Scopes。记得同时更新后端代码以处理这些额外的权限。

