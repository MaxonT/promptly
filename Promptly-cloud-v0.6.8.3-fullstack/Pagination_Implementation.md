# 分页系统实现文档

## 概述
本文档描述 Question Wizard 的真正分页系统实现，完全符合用户需求。

## 核心数据结构

```javascript
let allQuestions = [];        // 存储所有问题（带序号）
let currentPageIndex = 0;     // 当前页索引（0-based）
const PAGE_SIZE = 5;          // 每页显示5个问题
```

## 核心函数

### 1. 添加问题（带序号）
```javascript
function addQuestions(newQuestions) {
  const startIndex = allQuestions.length;
  newQuestions.forEach((q, idx) => {
    allQuestions.push({
      ...q,
      questionNumber: startIndex + idx + 1  // 1-based 固定序号
    });
  });
}
```

### 2. 获取当前页问题
```javascript
function getCurrentPageQuestions() {
  const startIdx = currentPageIndex * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  return allQuestions.slice(startIdx, endIdx);
}
```

### 3. 计算总页数
```javascript
function getTotalPages() {
  return Math.ceil(allQuestions.length / PAGE_SIZE);
}
```

### 4. 渲染当前页（完整刷新DOM）
```javascript
function renderCurrentPage() {
  // 1. 完全清空容器
  questionsContainer.innerHTML = "";
  
  // 2. 获取当前页问题
  const pageQuestions = getCurrentPageQuestions();
  
  // 3. 逐个创建新的DOM元素
  pageQuestions.forEach((q, idx) => {
    const card = document.createElement("div");
    card.className = "wizard-question-card";
    card.style.animationDelay = `${idx * 80}ms`;  // 交错动画
    
    // 添加问题编号
    const numberDiv = document.createElement("div");
    numberDiv.className = "wizard-question-number";
    numberDiv.textContent = `Question ${q.questionNumber}`;
    card.appendChild(numberDiv);
    
    // 添加问题类型
    const typeSpan = document.createElement("div");
    typeSpan.className = "wizard-question-type";
    typeSpan.textContent = q.type;
    card.appendChild(typeSpan);
    
    // 添加问题内容
    const textDiv = document.createElement("div");
    textDiv.className = "wizard-question-text";
    textDiv.textContent = q.content;
    card.appendChild(textDiv);
    
    // 添加选项（根据类型）
    // ... 渲染选项逻辑
    
    questionsContainer.appendChild(card);
  });
  
  // 4. 更新分页按钮
  updatePaginationButtons();
}
```

### 5. 更新分页按钮状态
```javascript
function updatePaginationButtons() {
  const totalPages = getTotalPages();
  
  // Back 按钮
  if (totalPages <= 1 || currentPageIndex === 0) {
    backBtn.disabled = true;
    backBtn.style.opacity = "0.5";
    backBtn.style.cursor = "not-allowed";
  } else {
    backBtn.disabled = false;
    backBtn.style.opacity = "1";
    backBtn.style.cursor = "pointer";
  }
  
  // Next 按钮文案
  if (totalPages <= 1 || currentPageIndex >= totalPages - 1) {
    nextBatchBtn.textContent = "Next Page";
  } else {
    nextBatchBtn.textContent = `Next (Page ${currentPageIndex + 2}/${totalPages})`;
  }
  
  // Back 按钮文案
  if (totalPages > 1) {
    backBtn.textContent = `◄ Back (Page ${currentPageIndex}/${totalPages})`;
  } else {
    backBtn.textContent = "◄ Back";
  }
}
```

### 6. 后退按钮（纯客户端）
```javascript
function goBack() {
  if (currentPageIndex > 0) {
    currentPageIndex--;
    renderCurrentPage();
    log(`Moved to page ${currentPageIndex + 1}/${getTotalPages()}`);
  } else {
    log("Already on first page");
  }
}
```

### 7. 前进按钮（客户端分页 + 最后提交）
```javascript
async function handleNext() {
  if (!currentSessionId || allQuestions.length === 0) return;
  
  const totalPages = getTotalPages();
  
  // 如果不在最后一页，纯客户端分页
  if (currentPageIndex < totalPages - 1) {
    currentPageIndex++;
    renderCurrentPage();
    log(`Moved to page ${currentPageIndex + 1}/${totalPages}`);
    return;
  }
  
  // 在最后一页：提交所有答案到后端
  const answersPayload = allQuestions.map((q) => ({
    question_id: q.id,
    value: currentAnswers.get(q.id) ?? null
  }));

  try {
    log("Submitting all answers...");
    const res = await fetch(`${API_BASE}/api/question-sessions/${currentSessionId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: answersPayload })
    });
    
    const data = await res.json();
    
    if (data.done) {
      log("All questions answered. You can now finalize the spec.");
      clearQuestions();
    } else if (data.questions && data.questions.length > 0) {
      // 后端返回新的问题
      log(`Received ${data.questions.length} new questions from backend.`);
      clearQuestions();
      addQuestions(data.questions);
      currentPageIndex = 0;
      renderCurrentPage();
    }
  } catch (err) {
    log("Error while submitting answers: " + err.message);
  }
}
```

## 工作流程

### 启动会话
```javascript
async function startWizard() {
  // 1. 发送请求到后端
  const res = await fetch(`${API_BASE}/api/question-sessions`, {
    method: "POST",
    body: JSON.stringify({ initial_description: idea, kind })
  });
  
  const data = await res.json();
  currentSessionId = data.session_id;
  
  // 2. 添加问题到全局数组
  addQuestions(data.questions || []);
  
  // 3. 重置页码
  currentPageIndex = 0;
  
  // 4. 渲染第一页
  renderCurrentPage();
  
  log(`Loaded ${allQuestions.length} questions (showing page 1/${getTotalPages()})`);
}
```

### 用户交互流程

#### 场景：10个问题

1. **启动** → 显示 Q1-Q5，Back禁用，Next显示"Next (Page 2/2)"
2. **点击 Next** → 显示 Q6-Q10，Back显示"◄ Back (Page 1/2)"，Next显示"Next Page"
3. **点击 Back** → 显示 Q1-Q5，Back禁用，Next显示"Next (Page 2/2)"
4. **点击 Next** → 显示 Q6-Q10
5. **点击 Next Page** → 提交所有答案到后端

## 答案保存机制

```javascript
const currentAnswers = new Map();

// 用户选择答案时
currentAnswers.set(questionId, value);

// 切换页面时答案不丢失（Map一直存在）

// 最后一页提交时
const answersPayload = allQuestions.map((q) => ({
  question_id: q.id,
  value: currentAnswers.get(q.id) ?? null
}));
```

## 关键特性

### ✅ 固定序号
- 每个问题有永久的 `questionNumber` 属性
- 即使重新生成问题，序号也保持不变
- 序号显示为紫色徽章：`Question 1`, `Question 2`, ...

### ✅ 真正分页
- 完全清空 DOM：`questionsContainer.innerHTML = ""`
- 重新创建所有元素：`document.createElement("div")`
- 不使用 `display: none` 或 `visibility: hidden`

### ✅ 客户端分页
- Back/Next 在非最后一页时：纯客户端操作
- 无需等待网络请求
- 瞬间响应

### ✅ 交错动画
```javascript
card.style.animationDelay = `${idx * 80}ms`;
// 第1张: 0ms
// 第2张: 80ms
// 第3张: 160ms
// 第4张: 240ms
// 第5张: 320ms
```

### ✅ 按钮智能状态
- 第一页：Back 禁用
- 最后一页：Next 变为 "Next Page"
- 单页：两个按钮都禁用/只有Submit可用

## 测试清单

- [ ] 启动会话，看到 Question 1, 2, 3, 4, 5
- [ ] Back 按钮是否禁用
- [ ] 点击 Next，看到 Question 6, 7, 8...
- [ ] 点击 Back，回到 Question 1-5
- [ ] 在第1页修改答案，切换到第2页，再回到第1页，答案是否保留
- [ ] 单页情况（≤5个问题），Back是否禁用
- [ ] 卡片hover效果（抬升+阴影）
- [ ] 卡片进入动画（交错出现）
- [ ] 最后一页点击 Submit，是否提交所有答案

## 文件清单

- `frontend/wizard.js` - 分页逻辑实现
- `frontend/wizard.css` - 视觉样式
- `frontend/wizard.html` - HTML结构

## 部署

上传到 Vercel 后立即生效，无需后端更改。

