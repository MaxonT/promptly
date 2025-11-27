#!/bin/bash

# Test script for Q1-Q3: Question Engine Advanced Controls
# Tests: Snapshot/Restore, Back/Skip, and Regenerate

BASE_URL="http://localhost:8080"
echo "=== Testing Promptly Q1-Q3 Advanced Controls ==="
echo ""

# Step 1: Create a test session
echo "Step 1: Creating a test question session..."
SESSION_RESPONSE=$(curl -s -X POST "$BASE_URL/api/question-sessions" \
  -H "Content-Type: application/json" \
  -d '{
    "initial_description": "Build a todo list app with React and Express",
    "kind": "coding"
  }')

SESSION_ID=$(echo "$SESSION_RESPONSE" | grep -o '"session_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SESSION_ID" ]; then
  echo "❌ Failed to create session"
  echo "Response: $SESSION_RESPONSE"
  exit 1
fi

echo "✅ Session created: $SESSION_ID"
echo ""

# Get first question
FIRST_Q_ID=$(echo "$SESSION_RESPONSE" | grep -o '"id":"q_[^"]*"' | head -1 | cut -d'"' -f4)
echo "First question ID: $FIRST_Q_ID"
echo ""

# Step 2: Answer one question
echo "Step 2: Answering the first question..."
ANSWER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/question-sessions/$SESSION_ID/answer" \
  -H "Content-Type: application/json" \
  -d "{
    \"answers\": [{
      \"question_id\": \"$FIRST_Q_ID\",
      \"value\": \"React with TypeScript\"
    }]
  }")

echo "✅ Answer submitted"
echo ""

# Step 3: Test Q1 - Save Snapshot
echo "Step 3: Testing Q1 - Save Snapshot..."
SNAPSHOT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/question-sessions/$SESSION_ID/snapshot")

SNAPSHOT_ID=$(echo "$SNAPSHOT_RESPONSE" | grep -o '"snapshot_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SNAPSHOT_ID" ]; then
  echo "❌ Failed to save snapshot"
  echo "Response: $SNAPSHOT_RESPONSE"
else
  echo "✅ Snapshot saved: $SNAPSHOT_ID"
fi
echo ""

# Step 4: Test Q1 - Restore Snapshot
echo "Step 4: Testing Q1 - Restore Latest Snapshot..."
RESTORE_RESPONSE=$(curl -s "$BASE_URL/api/question-sessions/$SESSION_ID/snapshot/latest")

RESTORED=$(echo "$RESTORE_RESPONSE" | grep -o '"ok":true')

if [ -n "$RESTORED" ]; then
  echo "✅ Snapshot restored successfully"
  echo "Response excerpt:"
  echo "$RESTORE_RESPONSE" | jq '{ok, snapshot_id, created_at}' 2>/dev/null || echo "$RESTORE_RESPONSE" | head -c 200
else
  echo "❌ Failed to restore snapshot"
  echo "Response: $RESTORE_RESPONSE"
fi
echo ""

# Step 5: Test Q2 - Go Back
echo "Step 5: Testing Q2 - Go Back..."
BACK_RESPONSE=$(curl -s -X POST "$BASE_URL/api/question-sessions/$SESSION_ID/answer" \
  -H "Content-Type: application/json" \
  -d "{
    \"answers\": [{\"question_id\": \"dummy\", \"value\": null}],
    \"control\": \"back\"
  }")

BACK_SUCCESS=$(echo "$BACK_RESPONSE" | grep -o '"ok":true')

if [ -n "$BACK_SUCCESS" ]; then
  echo "✅ Back control worked"
  echo "Response:"
  echo "$BACK_RESPONSE" | jq '{ok, message, questions: (.questions | length)}' 2>/dev/null || echo "$BACK_RESPONSE" | head -c 200
else
  echo "⚠️  Back control response (might be at first question):"
  echo "$BACK_RESPONSE" | head -c 300
fi
echo ""

# Step 6: Test Q2 - Skip
echo "Step 6: Testing Q2 - Skip Current Question..."
# Get current questions
CURRENT_Q_RESPONSE=$(curl -s "$BASE_URL/api/question-sessions/$SESSION_ID/answer" \
  -H "Content-Type: application/json" \
  -d "{
    \"answers\": [{\"question_id\": \"$FIRST_Q_ID\", \"value\": \"test\"}]
  }")

NEXT_Q_ID=$(echo "$CURRENT_Q_RESPONSE" | grep -o '"id":"q_[^"]*"' | head -1 | cut -d'"' -f4)

if [ -n "$NEXT_Q_ID" ]; then
  SKIP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/question-sessions/$SESSION_ID/answer" \
    -H "Content-Type: application/json" \
    -d "{
      \"answers\": [{\"question_id\": \"$NEXT_Q_ID\", \"value\": null}],
      \"control\": \"skip\"
    }")

  SKIP_SUCCESS=$(echo "$SKIP_RESPONSE" | grep -o '"ok":true')

  if [ -n "$SKIP_SUCCESS" ]; then
    echo "✅ Skip control worked"
    echo "Response:"
    echo "$SKIP_RESPONSE" | jq '{ok, message, questions: (.questions | length)}' 2>/dev/null || echo "$SKIP_RESPONSE" | head -c 200
  else
    echo "❌ Failed to skip"
    echo "Response: $SKIP_RESPONSE"
  fi
else
  echo "⚠️  No next question available to skip"
fi
echo ""

# Step 7: Test Q3 - Regenerate Question
echo "Step 7: Testing Q3 - Regenerate Question..."
REGEN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/question-sessions/$SESSION_ID/questions/$FIRST_Q_ID/regenerate")

REGEN_SUCCESS=$(echo "$REGEN_RESPONSE" | grep -o '"ok":true')

if [ -n "$REGEN_SUCCESS" ]; then
  echo "✅ Question regenerated successfully"
  echo "Response:"
  echo "$REGEN_RESPONSE" | jq '{ok, message, question: {id: .question.id, type: .question.type, content: (.question.content | .[0:60])}}' 2>/dev/null || echo "$REGEN_RESPONSE" | head -c 300
else
  echo "❌ Failed to regenerate question"
  echo "Response: $REGEN_RESPONSE"
fi
echo ""

# Step 8: Verify database
echo "Step 8: Checking database for Q1-Q3 records..."
DB_PATH="./data/app.db"
if [ -f "$DB_PATH" ]; then
  echo "Database found at $DB_PATH"
  echo ""
  echo "Snapshots:"
  sqlite3 "$DB_PATH" "SELECT id, session_id, substr(created_at, 1, 19) as created FROM question_snapshots ORDER BY created_at DESC LIMIT 3;" 2>/dev/null || echo "Could not query snapshots"
  echo ""
  echo "Actions (back/skip/regenerate):"
  sqlite3 "$DB_PATH" "SELECT id, action, substr(created_at, 1, 19) as created FROM question_actions ORDER BY created_at DESC LIMIT 5;" 2>/dev/null || echo "Could not query actions"
else
  echo "⚠️  Database not found at $DB_PATH"
fi
echo ""

echo "=== Test Summary ==="
echo "✅ All Q1-Q3 advanced control APIs tested!"
echo ""
echo "Implemented features:"
echo "  - Q1: Snapshot save & restore"
echo "  - Q2: Back & Skip controls"
echo "  - Q3: Question regeneration"
echo ""
echo "Next steps:"
echo "  - Open wizard.html in browser to test UI controls"
echo "  - Check that Back/Skip/Regenerate buttons work"
echo "  - Verify snapshot save/restore in UI"

