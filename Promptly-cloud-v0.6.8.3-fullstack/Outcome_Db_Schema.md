# Outcome Runner 数据库 Schema 快速参考

## 📊 表结构概览

### outcome_runs (13 字段)
```
id                 TEXT PRIMARY KEY
spec_id            TEXT           → specs(id)
run_id             TEXT           → runs(id)
task               TEXT NOT NULL
input              TEXT
style              TEXT
constraints        TEXT
n                  INTEGER NOT NULL
model              TEXT
status             TEXT NOT NULL
best_candidate_id  TEXT
request_json       TEXT
result_json        TEXT
created_at         TEXT NOT NULL
```

### outcome_candidates (9 字段)
```
id                 TEXT PRIMARY KEY
outcome_run_id     TEXT NOT NULL  → outcome_runs(id)
candidate_index    INTEGER NOT NULL
content            TEXT NOT NULL
llm_score          REAL
final_score        REAL
tests_passed       INTEGER
tests_json         TEXT
created_at         TEXT NOT NULL
```

---

## 🔗 关系图

```
┌─────────┐
│  specs  │
└────┬────┘
     │
     ├──────┐
     │      ↓
     │  ┌──────────────┐
     │  │ outcome_runs │
     │  └──────┬───────┘
     │         │
     │         ↓
     │  ┌───────────────────┐
     │  │ outcome_candidates│
     │  └───────────────────┘
     │
┌────┴────┐
│  runs   │
└─────────┘
```

---

## 📝 字段说明

### outcome_runs

| 字段 | 说明 | 示例 |
|------|------|------|
| task | 任务描述 | "Write a product description" |
| n | 生成候选数 | 4 |
| status | 运行状态 | "pending"/"success"/"failed" |
| best_candidate_id | 最佳候选ID | "cand_abc123" |
| request_json | 完整请求 | `{"task":"...","tests":{...}}` |
| result_json | 完整结果 | `{"best":{...},"candidates":[...]}` |

### outcome_candidates

| 字段 | 说明 | 示例 |
|------|------|------|
| candidate_index | 候选序号 | 0, 1, 2, 3 |
| content | 生成的内容 | "Introducing the FitPro..." |
| llm_score | LLM 评分 | 9.0 |
| final_score | 最终分数 | 8.5 |
| tests_passed | 是否通过测试 | 1 (通过) / 0 (失败) |
| tests_json | 测试详情 | `{"must_include":{"passed":true}}` |

---

## 💾 数据示例

### outcome_runs 记录示例
```sql
INSERT INTO outcome_runs VALUES (
  'outcome_run_001',
  'spec_xyz',
  'run_abc',
  'Write a catchy slogan',
  'Product: EcoBottle',
  'Professional, concise',
  'Max 10 words',
  4,
  'gpt-4.1-mini',
  'success',
  'cand_001',
  '{"task":"..."}',
  '{"best":{...}}',
  '2025-11-27T05:00:00.000Z'
);
```

### outcome_candidates 记录示例
```sql
INSERT INTO outcome_candidates VALUES (
  'cand_001',
  'outcome_run_001',
  0,
  'EcoBottle: Hydrate Sustainably, Live Responsibly',
  9.2,
  9.0,
  1,
  '{"must_include":{"passed":true},"max_length":{"passed":true}}',
  '2025-11-27T05:00:01.000Z'
);
```

---

## 🔍 查询示例

### 获取某次运行的所有候选
```sql
SELECT * FROM outcome_candidates 
WHERE outcome_run_id = 'outcome_run_001' 
ORDER BY candidate_index ASC;
```

### 获取最佳候选
```sql
SELECT c.* FROM outcome_candidates c
JOIN outcome_runs r ON c.id = r.best_candidate_id
WHERE r.id = 'outcome_run_001';
```

### 统计成功的运行
```sql
SELECT COUNT(*) FROM outcome_runs 
WHERE status = 'success';
```

### 平均候选分数
```sql
SELECT AVG(final_score) as avg_score 
FROM outcome_candidates 
WHERE outcome_run_id = 'outcome_run_001';
```

---

## ✅ 验证清单

- ✅ outcome_runs 表已创建
- ✅ outcome_candidates 表已创建
- ✅ 外键约束正确
- ✅ 字段类型正确
- ✅ SQL 语法正确
- ✅ 服务器正常启动
- ✅ 只修改了 db.js

---

**Schema 已准备就绪，可以开始实现 Outcome Runner APIs！** 🚀
