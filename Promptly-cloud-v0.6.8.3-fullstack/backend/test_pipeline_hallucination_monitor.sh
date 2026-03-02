#!/bin/bash
# ============================================================
# Pipeline Hallucination Monitor — 逐步跟踪 LLM 输出
# 记录 Pipeline 每个阶段的输入/输出，帮助定位幻觉来源
# ============================================================

set -euo pipefail

BASE_URL="http://localhost:8080"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="./pipeline_monitor_logs"
LOG_FILE="$LOG_DIR/pipeline_run_${TIMESTAMP}.log"

mkdir -p "$LOG_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

log() {
  local msg="[$(date '+%H:%M:%S')] $1"
  echo -e "$msg"
  echo "$msg" | sed 's/\x1b\[[0-9;]*m//g' >> "$LOG_FILE"
}

log_json() {
  local label="$1"
  local json="$2"
  echo -e "${CYAN}━━━ ${label} ━━━${NC}"
  echo "$json" | python3 -m json.tool 2>/dev/null || echo "$json"
  echo ""
  echo "━━━ ${label} ━━━" >> "$LOG_FILE"
  echo "$json" | python3 -m json.tool 2>/dev/null >> "$LOG_FILE" 2>&1 || echo "$json" >> "$LOG_FILE"
  echo "" >> "$LOG_FILE"
}

separator() {
  echo -e "${PURPLE}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${PURPLE}║  $1${NC}"
  echo -e "${PURPLE}╚══════════════════════════════════════════════════════════════╝${NC}"
}

echo "" > "$LOG_FILE"

separator "🔍 PIPELINE HALLUCINATION MONITOR"
log "${BOLD}日志文件: ${LOG_FILE}${NC}"
log "${BOLD}时间: $(date)${NC}"
echo ""

# ============================================================
# Step 1: Health Check
# ============================================================
separator "Step 1: 健康检查"
HEALTH=$(curl -s "$BASE_URL/api/health" 2>/dev/null || echo '{"ok":false}')
HEALTH_OK=$(echo "$HEALTH" | python3 -c "import sys,json; print(json.load(sys.stdin).get('ok', False))" 2>/dev/null || echo "False")

if [ "$HEALTH_OK" != "True" ]; then
  log "${RED}❌ 服务器未运行! 请先启动: cd backend && npm run dev${NC}"
  log "Health response: $HEALTH"
  exit 1
fi
log "${GREEN}✅ 服务器健康${NC}"
log_json "Health Response" "$HEALTH"

# ============================================================
# Step 2: 注册/登录测试用户
# ============================================================
separator "Step 2: 认证 — 注册/登录测试用户"
TEST_EMAIL="hallucination-test-${TIMESTAMP}@test.com"
TEST_PASSWORD="TestPassword123!"

log "注册新用户: $TEST_EMAIL"
REGISTER_RESP=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")

TOKEN=$(echo "$REGISTER_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")

if [ -z "$TOKEN" ]; then
  log "${YELLOW}注册失败，尝试登录...${NC}"
  LOGIN_RESP=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$TEST_EMAIL\",\"password\":\"$TEST_PASSWORD\"}")
  TOKEN=$(echo "$LOGIN_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))" 2>/dev/null || echo "")
fi

if [ -z "$TOKEN" ]; then
  log "${RED}❌ 认证失败!${NC}"
  log_json "Register Response" "$REGISTER_RESP"
  exit 1
fi
log "${GREEN}✅ 认证成功, Token 长度: ${#TOKEN}${NC}"

# ============================================================
# Step 3: 启动 Pipeline (Standard mode — 包含 Critique + Refine)
# ============================================================
separator "Step 3: 启动 Pipeline Run (standard mode)"

# 用一个真实的 prompt 优化任务来测试
TEST_IDEA="Write a Python script that connects to a PostgreSQL database, fetches user records, and generates a CSV report with pagination support. The script should handle connection errors gracefully and support both command-line arguments and environment variables for configuration."

log "${BOLD}测试输入 (idea):${NC}"
log "$TEST_IDEA"
echo ""

log "发送 POST /api/pipeline/run ..."
RUN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/pipeline/run" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{
    \"idea\": \"$TEST_IDEA\",
    \"skipQuestions\": true,
    \"model\": \"standard\",
    \"clarificationsProvided\": true
  }")

log_json "Pipeline Run Response" "$RUN_RESPONSE"

RUN_ID=$(echo "$RUN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('runId',''))" 2>/dev/null || echo "")
STREAM_URL=$(echo "$RUN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('streamUrl',''))" 2>/dev/null || echo "")
STREAM_TOKEN=$(echo "$RUN_RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin).get('streamToken',''))" 2>/dev/null || echo "")

if [ -z "$RUN_ID" ]; then
  log "${RED}❌ Pipeline 启动失败!${NC}"
  exit 1
fi
log "${GREEN}✅ Pipeline 已启动: runId=$RUN_ID${NC}"

# ============================================================
# Step 4: 监听 SSE 事件流 — 记录每个阶段的输出
# ============================================================
separator "Step 4: 🔬 SSE 事件流监控 — 逐步捕获 Pipeline 输出"

SSE_LOG="$LOG_DIR/sse_events_${TIMESTAMP}.jsonl"
PARSED_LOG="$LOG_DIR/parsed_stages_${TIMESTAMP}.log"
echo "" > "$SSE_LOG"
echo "" > "$PARSED_LOG"

log "连接 SSE 流: $STREAM_URL?st=$STREAM_TOKEN"
log "事件日志: $SSE_LOG"
log "解析日志: $PARSED_LOG"
echo ""

# Use curl to capture SSE events, with a timeout for completion
# We parse each event in real-time
curl -s -N "$BASE_URL${STREAM_URL}?st=${STREAM_TOKEN}" --max-time 300 2>/dev/null | while IFS= read -r line; do
  # Skip empty lines
  [ -z "$line" ] && continue

  # Capture event type
  if [[ "$line" == event:* ]]; then
    CURRENT_EVENT="${line#event: }"
    continue
  fi

  # Capture data payload
  if [[ "$line" == data:* ]]; then
    DATA="${line#data: }"

    # Save raw event
    echo "{\"event\":\"$CURRENT_EVENT\",\"data\":$DATA}" >> "$SSE_LOG"

    # Parse and display based on event type
    case "$CURRENT_EVENT" in
      connected)
        echo -e "${GREEN}🔗 SSE 已连接${NC}"
        ;;

      ping)
        # Silent - don't log pings
        ;;

      stage-start)
        STAGE=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stage','?'))" 2>/dev/null || echo "?")
        MSG=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null || echo "")
        echo ""
        echo -e "${BOLD}${BLUE}▶ STAGE START: [$STAGE] $MSG${NC}"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" 
        echo "" >> "$PARSED_LOG"
        echo "▶ STAGE START: [$STAGE] $MSG" >> "$PARSED_LOG"
        echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" >> "$PARSED_LOG"
        ;;

      stage-progress)
        STAGE=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stage','?'))" 2>/dev/null || echo "?")
        STEP=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('step','?'))" 2>/dev/null || echo "?")
        MSG=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null || echo "")

        echo -e "${CYAN}  📌 [$STAGE/$STEP] $MSG${NC}"

        # 特别关注: 打印 details 中的关键数据
        DETAILS=$(echo "$DATA" | python3 -c "
import sys,json
d=json.load(sys.stdin)
det = d.get('details',{})
if det:
    for k,v in det.items():
        if k in ('model','provider','compositeScore','verdict','scores','contentLength','metrics','candidateId','agent'):
            print(f'    {k}: {v}')
" 2>/dev/null || true)
        if [ -n "$DETAILS" ]; then
          echo -e "${YELLOW}$DETAILS${NC}"
          echo "$DETAILS" >> "$PARSED_LOG"
        fi
        
        echo "  📌 [$STAGE/$STEP] $MSG" >> "$PARSED_LOG"
        ;;

      stage-complete)
        STAGE=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stage','?'))" 2>/dev/null || echo "?")
        MSG=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null || echo "")

        echo -e "${GREEN}  ✅ STAGE COMPLETE: [$STAGE] $MSG${NC}"
        echo "  ✅ STAGE COMPLETE: [$STAGE] $MSG" >> "$PARSED_LOG"

        # 打印 result 中的关键字段 (这是幻觉检查的主战场)
        RESULT=$(echo "$DATA" | python3 -c "
import sys,json
d=json.load(sys.stdin)
r = d.get('result',{})
if r:
    print(json.dumps(r, indent=2, ensure_ascii=False))
" 2>/dev/null || echo "")
        if [ -n "$RESULT" ]; then
          echo -e "${YELLOW}  📊 Stage Result:${NC}"
          echo "$RESULT" | head -60
          if [ $(echo "$RESULT" | wc -l) -gt 60 ]; then
            echo -e "${YELLOW}  ... (truncated, see full log)${NC}"
          fi
          echo "  📊 Stage Result:" >> "$PARSED_LOG"
          echo "$RESULT" >> "$PARSED_LOG"
        fi
        echo ""
        ;;

      stage-skipped)
        STAGE=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stage','?'))" 2>/dev/null || echo "?")
        MSG=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null || echo "")
        echo -e "${YELLOW}  ⏭ STAGE SKIPPED: [$STAGE] $MSG${NC}"
        echo "  ⏭ STAGE SKIPPED: [$STAGE] $MSG" >> "$PARSED_LOG"
        ;;

      stage-warning)
        STAGE=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('stage','?'))" 2>/dev/null || echo "?")
        MSG=$(echo "$DATA" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('message',''))" 2>/dev/null || echo "")
        echo -e "${RED}  ⚠️  STAGE WARNING: [$STAGE] $MSG${NC}"
        echo "  ⚠️  STAGE WARNING: [$STAGE] $MSG" >> "$PARSED_LOG"
        ;;

      pipeline-rejected)
        echo -e "${RED}  🚫 PIPELINE REJECTED${NC}"
        echo "$DATA" | python3 -m json.tool 2>/dev/null || echo "$DATA"
        echo "  🚫 PIPELINE REJECTED" >> "$PARSED_LOG"
        echo "$DATA" >> "$PARSED_LOG"
        ;;

      pipeline-clarification-needed)
        echo -e "${YELLOW}  ❓ CLARIFICATION NEEDED${NC}"
        echo "$DATA" | python3 -m json.tool 2>/dev/null || echo "$DATA"
        echo "  ❓ CLARIFICATION NEEDED" >> "$PARSED_LOG"
        echo "$DATA" >> "$PARSED_LOG"
        ;;

      error)
        echo -e "${RED}  ❌ ERROR${NC}"
        echo "$DATA" | python3 -m json.tool 2>/dev/null || echo "$DATA"
        echo "  ❌ ERROR" >> "$PARSED_LOG"
        echo "$DATA" >> "$PARSED_LOG"
        ;;

      complete)
        SUCCESS=$(echo "$DATA" | python3 -c "import sys,json; print(json.load(sys.stdin).get('success',False))" 2>/dev/null || echo "False")
        if [ "$SUCCESS" = "True" ]; then
          echo ""
          echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════${NC}"
          echo -e "${GREEN}${BOLD}  🎉 PIPELINE COMPLETED SUCCESSFULLY${NC}"
          echo -e "${GREEN}${BOLD}═══════════════════════════════════════════════${NC}"
          
          # 提取最终结果的关键信息
          echo ""
          echo -e "${BOLD}📋 最终选中候选者:${NC}"
          python3 -c "
import sys, json
d = json.loads('''$DATA''')
bc = d.get('bestCandidate', {})
print(f'  ID:         {bc.get(\"id\", \"N/A\")}')
print(f'  Agent:      {bc.get(\"agent\", \"N/A\")}')
m = bc.get('metrics', {})
print(f'  Composite:  {m.get(\"compositeScore\", \"N/A\")}')
print(f'  完整性:     {m.get(\"completeness\", \"N/A\")}')
print(f'  清晰度:     {m.get(\"clarity\", \"N/A\")}')
print(f'  具体性:     {m.get(\"specificity\", \"N/A\")}')
print(f'  结构:       {m.get(\"structure\", \"N/A\")}')
print(f'  连贯性:     {m.get(\"coherence\", \"N/A\")}')
print(f'  创意:       {m.get(\"creativity\", \"N/A\")}')
print(f'  安全性:     {m.get(\"safety\", \"N/A\")}')
print(f'  效率:       {m.get(\"efficiency\", \"N/A\")}')

tu = d.get('tokenUsage', {})
if tu:
    print(f'')
    print(f'  💰 Token使用:')
    print(f'    输入:  {tu.get(\"inputTokens\", 0)}')
    print(f'    输出:  {tu.get(\"outputTokens\", 0)}')
    print(f'    总计:  {tu.get(\"totalTokens\", 0)}')

# 输出生成的 prompt 内容 (截取前 500 字符)
content = bc.get('content', '')
print(f'')
print(f'  📝 生成的 Prompt (前500字符):')
print(f'  {content[:500]}')
if len(content) > 500:
    print(f'  ... (共 {len(content)} 字符)')
" 2>/dev/null || echo "$DATA" | python3 -m json.tool 2>/dev/null || echo "$DATA"

        else
          echo -e "${RED}${BOLD}  ❌ PIPELINE FAILED${NC}"
          echo "$DATA" | python3 -m json.tool 2>/dev/null || echo "$DATA"
        fi

        echo "" >> "$PARSED_LOG"
        echo "═══ PIPELINE COMPLETE (success=$SUCCESS) ═══" >> "$PARSED_LOG"
        echo "$DATA" >> "$PARSED_LOG"

        # Break the loop after complete event
        break
        ;;

      *)
        echo -e "  [${CURRENT_EVENT}] $DATA"
        echo "  [${CURRENT_EVENT}] $DATA" >> "$PARSED_LOG"
        ;;
    esac
  fi
done

echo ""

# ============================================================
# Step 5: 从数据库拉取详细数据做幻觉分析
# ============================================================
separator "Step 5: 🔬 数据库详细分析 — 幻觉定位"

DB_PATH="./data/app.db"
if [ ! -f "$DB_PATH" ]; then
  DB_PATH="./data/app-v0-7.db"
fi

if [ -f "$DB_PATH" ]; then
  log "数据库: $DB_PATH"
  echo ""

  # 5a: 查看 spec 建构结果
  echo -e "${BOLD}═══ [Stage 1] Spec Builder 输出 ═══${NC}"
  SPEC_DATA=$(sqlite3 -json "$DB_PATH" "
    SELECT id, title, summary, spec_json, created_at
    FROM specs
    WHERE id IN (SELECT spec_id FROM runs WHERE id = '$RUN_ID')
    ORDER BY created_at DESC LIMIT 1;
  " 2>/dev/null || echo "[]")
  
  if [ "$SPEC_DATA" != "[]" ] && [ -n "$SPEC_DATA" ]; then
    echo "$SPEC_DATA" | python3 -c "
import sys, json
rows = json.load(sys.stdin)
for row in rows:
    print(f'  Spec ID:  {row[\"id\"]}')
    print(f'  Title:    {row[\"title\"]}')
    print(f'  Summary:  {row[\"summary\"]}')
    spec = json.loads(row['spec_json'])
    print(f'  Task Type:   {spec.get(\"task_type\", \"N/A\")}')
    print(f'  Audience:    {spec.get(\"audience\", \"N/A\")}')
    print(f'  Domain:      {spec.get(\"domain\", \"N/A\")}')
    print(f'  Tone:        {spec.get(\"tone\", \"N/A\")}')
    print(f'  Format:      {spec.get(\"format\", \"N/A\")}')
    cst = spec.get('constraints', [])
    if cst:
        print(f'  Constraints:')
        for c in cst:
            print(f'    - {c}')
    ap = spec.get('antiPatterns', [])
    if ap:
        print(f'  Anti-Patterns:')
        for a in ap:
            print(f'    - {a}')
    sc = spec.get('successCriteria', [])
    if sc:
        print(f'  Success Criteria:')
        for s in sc:
            print(f'    - {s}')
    ec = spec.get('edgeCases', [])
    if ec:
        print(f'  Edge Cases:')
        for e in ec:
            print(f'    - {e}')
    print()
    
    # 🔍 幻觉检查 #1: Spec 是否编造了不相关的内容
    goal = spec.get('userGoal', '')
    print(f'  🔍 幻觉检查 #1: Spec Builder')
    print(f'     原始输入长度: $( echo \"$TEST_IDEA\" | wc -c | tr -d \" \") chars')
    print(f'     生成摘要长度: {len(goal)} chars')
    if 'REST API' in goal and 'PostgreSQL' not in goal and 'CSV' not in goal:
        print(f'     ⚠️  可能幻觉: 原始输入提到 PostgreSQL/CSV 但 Spec 摘要中遗漏')
    elif len(goal) < 20:
        print(f'     ⚠️  可能幻觉: Spec 摘要过短，丢失了原始意图')
    else:
        print(f'     ✅ Spec 看起来合理')
" 2>/dev/null || echo "  (解析失败)"
    echo "$SPEC_DATA" >> "$PARSED_LOG"
  else
    echo -e "${YELLOW}  未找到对应的 Spec 数据${NC}"
  fi

  # 5b: 查看所有候选者的内容
  echo ""
  echo -e "${BOLD}═══ [Stage 3] 候选 Prompt 内容对比 ═══${NC}"
  CANDIDATES=$(sqlite3 -json "$DB_PATH" "
    SELECT id, agent, model, content, metrics_json, created_at
    FROM candidate_prompts
    WHERE spec_id IN (SELECT spec_id FROM runs WHERE id = '$RUN_ID')
    ORDER BY created_at ASC;
  " 2>/dev/null || echo "[]")

  if [ "$CANDIDATES" != "[]" ] && [ -n "$CANDIDATES" ]; then
    echo "$CANDIDATES" | python3 -c "
import sys, json

rows = json.load(sys.stdin)
for i, row in enumerate(rows):
    agent = row['agent']
    content = row['content'] or ''
    metrics_raw = row.get('metrics_json', '{}')
    try:
        metrics = json.loads(metrics_raw) if metrics_raw else {}
    except:
        metrics = {}

    print(f'')
    print(f'  ┌──────────────────────────────────────────────')
    print(f'  │ Candidate #{i+1}: {agent}')
    print(f'  │ ID:    {row[\"id\"]}')
    print(f'  │ Model: {row[\"model\"]}')
    print(f'  │ 长度:  {len(content)} chars')
    
    # 评分信息
    cs = metrics.get('compositeScore')
    if cs is not None:
        print(f'  │ Composite Score: {cs:.4f}')
        for dim in ['completeness','clarity','specificity','structure','coherence','creativity','safety','efficiency']:
            v = metrics.get(dim)
            if v is not None:
                bar = '█' * int(v * 20) + '░' * (20 - int(v * 20))
                flag = '⚠️' if v < 0.6 else '✅' if v >= 0.8 else '  '
                print(f'  │   {dim:14s} {v:.2f} {bar} {flag}')
    
    # Critique 信息
    critique = metrics.get('critique', {})
    if critique:
        print(f'  │ Critique Verdict: {critique.get(\"verdict\", \"N/A\")}')
        weaknesses = critique.get('weaknesses', [])
        if weaknesses:
            print(f'  │ Weaknesses:')
            for w in weaknesses[:5]:
                print(f'  │   ⚡ {w}')
        suggestions = critique.get('suggestions', [])
        if suggestions:
            print(f'  │ Suggestions:')
            for s in suggestions[:5]:
                print(f'  │   💡 {s}')
    
    # 🔍 幻觉检查 #2: 生成的 Prompt 内容是否与原始输入相关
    print(f'  │')
    print(f'  │ 🔍 幻觉检查:')
    
    content_lower = content.lower()
    keywords = ['python', 'postgresql', 'database', 'csv', 'report', 'pagination', 'connection', 'error', 'command-line', 'environment']
    found = [k for k in keywords if k in content_lower]
    missing = [k for k in keywords if k not in content_lower]
    
    print(f'  │   关键词覆盖: {len(found)}/{len(keywords)}')
    if missing:
        print(f'  │   ⚠️  遗漏关键词: {\", \".join(missing)}')
    else:
        print(f'  │   ✅ 所有关键词已覆盖')
    
    # 检查是否有凭空编造的框架/库
    suspicious_terms = ['django', 'flask', 'fastapi', 'sqlalchemy', 'pandas', 'numpy', 'tensorflow']
    hallucinated = [t for t in suspicious_terms if t in content_lower]
    if hallucinated:
        print(f'  │   ⚠️  可能幻觉 — 提到了用户未要求的技术: {\", \".join(hallucinated)}')
    
    print(f'  │')
    print(f'  │ 📝 Prompt 内容 (前300字符):')
    for line in content[:300].split('\\n'):
        print(f'  │   {line}')
    if len(content) > 300:
        print(f'  │   ... (共 {len(content)} 字符)')
    print(f'  └──────────────────────────────────────────────')
" 2>/dev/null || echo "  (解析失败)"
    echo "$CANDIDATES" >> "$PARSED_LOG"
  else
    echo -e "${YELLOW}  未找到候选者数据${NC}"
  fi

  # 5c: 查看 outcome 结果
  echo ""
  echo -e "${BOLD}═══ [Stage 5] Outcome 选择结果 ═══${NC}"
  OUTCOME=$(sqlite3 -json "$DB_PATH" "
    SELECT id, best_candidate_id, result_json, status, model, n, created_at
    FROM outcome_runs
    WHERE spec_id IN (SELECT spec_id FROM runs WHERE id = '$RUN_ID')
    ORDER BY created_at DESC LIMIT 1;
  " 2>/dev/null || echo "[]")

  if [ "$OUTCOME" != "[]" ] && [ -n "$OUTCOME" ]; then
    echo "$OUTCOME" | python3 -c "
import sys, json

rows = json.load(sys.stdin)
for row in rows:
    result = json.loads(row.get('result_json', '{}'))
    print(f'  Outcome ID:     {row[\"id\"]}')
    print(f'  Best Candidate: {row[\"best_candidate_id\"]}')
    print(f'  Selection:      {result.get(\"selectionMethod\", \"N/A\")}')
    print(f'  Reasoning:      {result.get(\"reasoning\", \"N/A\")}')
    
    pw = result.get('pairwise')
    if pw:
        print(f'  Pairwise Winner: {pw.get(\"winner\", \"N/A\")}')
        print(f'  Confidence:      {pw.get(\"confidenceScore\", \"N/A\")}')
        print(f'  Reasoning:       {pw.get(\"reasoning\", \"N/A\")}')
    
    ranking = result.get('ranking', [])
    if ranking:
        print(f'  Ranking:')
        for r in ranking:
            print(f'    #{r[\"rank\"]} {r[\"agent\"]:25s} score={r[\"compositeScore\"]:.4f}')
    
    bc = result.get('bestCandidate', {})
    if bc:
        print(f'  Best Source:     {bc.get(\"source\", \"N/A\")}')
        print(f'  Best Agent:      {bc.get(\"agent\", \"N/A\")}')
" 2>/dev/null || echo "  (解析失败)"
  fi

  # 5d: 查看 Pipeline 运行指标
  echo ""
  echo -e "${BOLD}═══ [综合] Pipeline 运行指标 ═══${NC}"
  RUN_METRICS=$(sqlite3 -json "$DB_PATH" "
    SELECT id, status, model, metrics_json, created_at, completed_at
    FROM runs
    WHERE id = '$RUN_ID'
    LIMIT 1;
  " 2>/dev/null || echo "[]")

  if [ "$RUN_METRICS" != "[]" ] && [ -n "$RUN_METRICS" ]; then
    echo "$RUN_METRICS" | python3 -c "
import sys, json

rows = json.load(sys.stdin)
for row in rows:
    metrics = json.loads(row.get('metrics_json', '{}'))
    print(f'  Run ID:        {row[\"id\"]}')
    print(f'  Status:        {row[\"status\"]}')
    print(f'  Mode:          {metrics.get(\"mode\", \"N/A\")}')
    print(f'  Duration:      {metrics.get(\"durationMs\", 0)/1000:.1f}s')
    
    tokens = metrics.get('tokens', {})
    print(f'  Tokens Input:  {tokens.get(\"input\", 0)}')
    print(f'  Tokens Output: {tokens.get(\"output\", 0)}')
    print(f'  Tokens Total:  {tokens.get(\"total\", 0)}')
    
    calls = metrics.get('calls_total', {})
    print(f'  LLM Calls:')
    for stage, count in calls.items():
        if count > 0:
            print(f'    {stage}: {count}')
    
    timing = metrics.get('stageTiming', {})
    if timing:
        print(f'  Stage Timing:')
        for stage, ms in timing.items():
            print(f'    {stage}: {ms/1000:.1f}s')
    
    print(f'  Best Score:    {metrics.get(\"bestScore\", \"N/A\")}')
    print(f'  Best Agent:    {metrics.get(\"bestAgent\", \"N/A\")}')
    print(f'  Best Source:   {metrics.get(\"bestSource\", \"N/A\")}')
    print(f'  Eval Failures: {metrics.get(\"evalFailures\", 0)}')
    print(f'  Candidates:    {metrics.get(\"candidateCount\", 0)}')
    print(f'  Exemplars:     {metrics.get(\"exemplars_found\", 0)}')
    
    verdicts = metrics.get('critique_verdicts', [])
    if verdicts:
        print(f'  Critique Verdicts:')
        for v in verdicts:
            print(f'    {v.get(\"agent\",\"?\"): <25s} → {v.get(\"verdict\", \"N/A\")}')
" 2>/dev/null || echo "  (解析失败)"
  fi

else
  log "${YELLOW}⚠️  数据库文件未找到, 跳过详细分析${NC}"
fi

# ============================================================
# Step 6: 幻觉风险总结
# ============================================================
echo ""
separator "Step 6: 🎯 幻觉风险总结"

echo -e "${BOLD}Pipeline 各阶段幻觉风险:${NC}"
echo ""
echo -e "  ${YELLOW}Stage 0 - Input Validation:${NC}  低风险 (规则引擎，无LLM)"
echo -e "  ${YELLOW}Stage 0.5 - Ambiguity:${NC}       中风险 (LLM判断是否需要澄清)"
echo -e "  ${RED}Stage 1 - Spec Builder:${NC}      ⚠️  高风险 — LLM 将原始输入解析为13字段 spec"
echo -e "                               可能编造 audience/domain/constraints"
echo -e "                               可能遗漏或曲解用户意图"
echo -e "  ${RED}Stage 3 - Generation:${NC}        ⚠️  高风险 — LLM 基于 spec 生成 prompt"  
echo -e "                               可能引入用户未要求的技术/框架"
echo -e "                               可能忽略原始 spec 中的约束"
echo -e "  ${YELLOW}Stage 3b - Critique:${NC}         中风险 — 交叉模型评审"
echo -e "                               评分可能不准确 (一切 0.85 综合征)"
echo -e "  ${YELLOW}Stage 3c - Refine:${NC}           中风险 — 基于 critique 改进"
echo -e "                               可能在改进时引入新幻觉"
echo -e "  ${YELLOW}Stage 4 - Evaluation:${NC}        中风险 — 8维评分"
echo -e "                               分数可能虚高 (LLM 自我评价偏差)"
echo -e "  ${GREEN}Stage 5 - Outcome:${NC}          低风险 (纯数学排序，无LLM)"
echo ""
echo -e "${BOLD}💡 建议:${NC}"
echo "  1. 重点检查 Stage 1 (Spec Builder) 输出是否与原始输入一致"
echo "  2. 对比 Stage 3 两个候选者，看是否覆盖了所有原始关键词"
echo "  3. Stage 4 评分 < 0.6 的维度是真实弱点"
echo "  4. 查看完整日志: $LOG_FILE"
echo "  5. 查看 SSE 事件: $SSE_LOG"
echo "  6. 查看解析结果: $PARSED_LOG"
echo ""
