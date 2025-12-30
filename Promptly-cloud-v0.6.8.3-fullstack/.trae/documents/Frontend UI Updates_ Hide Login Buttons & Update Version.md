**1. 修复登录按钮显示问题**

* 修改 `frontend/lib/authStatus.js`：

  * 获取 `authButtons` 容器元素。

  * 在用户**已登录**时，隐藏 `authButtons`（包含所有登录按钮）。

  * 在用户**未登录**时，显示 `authButtons`。

**2. 更新版本号**

* 将以下文件底部的版本号从 `v0.5.x` / `v0.6.5` 统一更新为 **`© Promptly v0.6.8.3`**：

  * `frontend/index.html` (Hero 底部)

  * `frontend/wizard.html`

  * `frontend/privacy.html`

  * `frontend/terms.html`

  * `frontend/cookies.html`

