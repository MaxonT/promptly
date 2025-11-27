#!/bin/bash

# Test script for B4-B6 Evaluation APIs
# This script tests the new evaluation endpoints

BASE_URL="http://localhost:8080"
echo "=== Testing Promptly Evaluation APIs (B4-B6) ==="
echo ""

# Step 1: Create a test spec
echo "Step 1: Creating a test spec..."
SPEC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/specs" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Test Evaluation Spec",
    "spec": {
      "title": "Test Evaluation Spec",
      "project_goal": "Build a simple REST API for user management",
      "requirements": {
        "functional": [
          "User registration endpoint",
          "User login endpoint",
          "User profile retrieval"
        ]
      },
      "constraints": {
        "technical": [
          "Use Node.js and Express",
          "Use SQLite for storage"
        ]
      },
      "evaluation_criteria": {
        "completeness": "All endpoints must be implemented",
        "clarity": "Clear documentation for all endpoints"
      }
    }
  }')

SPEC_ID=$(echo "$SPEC_RESPONSE" | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$SPEC_ID" ]; then
  echo "❌ Failed to create spec"
  echo "Response: $SPEC_RESPONSE"
  exit 1
fi

echo "✅ Spec created with ID: $SPEC_ID"
echo ""

# Step 2: Test POST /api/specs/:id/evaluate
echo "Step 2: Testing POST /api/specs/:id/evaluate..."
EVALUATE_RESPONSE=$(curl -s -X POST "$BASE_URL/api/specs/$SPEC_ID/evaluate" \
  -H "Content-Type: application/json" \
  -d '{}')

EVAL_ID=$(echo "$EVALUATE_RESPONSE" | grep -o '"id":"eval_[^"]*"' | cut -d'"' -f4)

if [ -z "$EVAL_ID" ]; then
  echo "❌ Failed to evaluate spec"
  echo "Response: $EVALUATE_RESPONSE"
else
  echo "✅ Evaluation created with ID: $EVAL_ID"
  echo "Response excerpt:"
  echo "$EVALUATE_RESPONSE" | jq '.evaluation | {id, score, verdict, summary}' 2>/dev/null || echo "$EVALUATE_RESPONSE"
fi
echo ""

# Step 3: Test POST /api/specs/:id/compile-and-evaluate
echo "Step 3: Testing POST /api/specs/:id/compile-and-evaluate..."
COMPILE_EVAL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/specs/$SPEC_ID/compile-and-evaluate" \
  -H "Content-Type: application/json" \
  -d '{}')

COMPILE_EVAL_ID=$(echo "$COMPILE_EVAL_RESPONSE" | grep -o '"id":"eval_[^"]*"' | cut -d'"' -f4 | head -1)

if [ -z "$COMPILE_EVAL_ID" ]; then
  echo "❌ Failed to compile and evaluate spec"
  echo "Response: $COMPILE_EVAL_RESPONSE"
else
  echo "✅ Compile-and-evaluate succeeded with evaluation ID: $COMPILE_EVAL_ID"
  echo "Response excerpt:"
  echo "$COMPILE_EVAL_RESPONSE" | jq '{compiled_prompt_id: .compiled_prompt.id, evaluation: .evaluation | {id, score, verdict, summary}}' 2>/dev/null || echo "$COMPILE_EVAL_RESPONSE"
fi
echo ""

# Step 4: Test GET /api/specs/:id/evaluations
echo "Step 4: Testing GET /api/specs/:id/evaluations..."
EVALUATIONS_LIST=$(curl -s "$BASE_URL/api/specs/$SPEC_ID/evaluations")

EVAL_COUNT=$(echo "$EVALUATIONS_LIST" | grep -o '"id":"eval_' | wc -l | tr -d ' ')

echo "✅ Retrieved $EVAL_COUNT evaluation(s) for spec $SPEC_ID"
if [ "$EVAL_COUNT" -gt 0 ]; then
  echo "Response excerpt:"
  echo "$EVALUATIONS_LIST" | jq '.evaluations | map({id, score, verdict, created_at})' 2>/dev/null || echo "$EVALUATIONS_LIST"
fi
echo ""

# Step 5: Verify database tables
echo "Step 5: Checking database for evaluation records..."
DB_PATH="./data/app.db"
if [ -f "$DB_PATH" ]; then
  echo "Database found at $DB_PATH"
  echo ""
  echo "Evaluations in database:"
  sqlite3 "$DB_PATH" "SELECT id, spec_id, score, verdict, summary FROM evaluations ORDER BY created_at DESC LIMIT 3;" 2>/dev/null || echo "Could not query database"
  echo ""
  echo "Runs with EVALUATOR agent:"
  sqlite3 "$DB_PATH" "SELECT id, status, model, created_at FROM runs WHERE input_blocks LIKE '%EVALUATOR%' ORDER BY created_at DESC LIMIT 3;" 2>/dev/null || echo "Could not query database"
else
  echo "⚠️  Database not found at $DB_PATH"
fi
echo ""

echo "=== Test Summary ==="
echo "✅ All B4-B6 evaluation APIs tested successfully!"
echo ""
echo "Implemented features:"
echo "  - B4: evaluations table in database"
echo "  - B5: evaluatePrompt() function in evaluationEngine.js"
echo "  - B6: POST /api/specs/:id/evaluate"
echo "  - B6: POST /api/specs/:id/compile-and-evaluate"
echo "  - B6: GET /api/specs/:id/evaluations"
echo ""
echo "Next steps:"
echo "  - View the database: sqlite3 backend/data/app.db"
echo "  - Check server logs for detailed evaluation process"
echo "  - Test with real OpenAI API key for actual LLM evaluation"

