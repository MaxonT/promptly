#!/bin/bash

# Promptly Attachment Feature Test Script
# Tests the attachment functionality for the enhance API

API_BASE="${API_BASE:-http://localhost:8080}"

echo "🧪 Testing Promptly Attachment Feature"
echo "======================================"
echo "API Base: $API_BASE"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASS=0
FAIL=0

# Function to test endpoint
test_endpoint() {
  local endpoint=$1
  local description=$2
  local payload=$3
  
  echo -n "Testing $description... "
  
  response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/enhance$endpoint" \
    -H "Content-Type: application/json" \
    -d "$payload")
  
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n -1)
  
  if [ "$http_code" -eq 200 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    PASS=$((PASS + 1))
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
    echo "Response: $body"
    FAIL=$((FAIL + 1))
  fi
}

echo "📋 Test 1: Plain text request (no attachments)"
echo "----------------------------------------------"
test_endpoint "/structure" "Structure enhancement" '{
  "prompt": "Help me write a better prompt for summarizing articles"
}'
echo ""

echo "📋 Test 2: Request with single attachment"
echo "----------------------------------------"
# Create a small base64 image (1x1 red pixel PNG)
RED_PIXEL="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="

test_endpoint "/structure" "Structure with image attachment" "{
  \"prompt\": \"Analyze this image and describe what you see\",
  \"attachments\": [
    {
      \"name\": \"test_image.png\",
      \"size\": 68,
      \"type\": \"image/png\",
      \"dataURL\": \"data:image/png;base64,$RED_PIXEL\"
    }
  ]
}"
echo ""

echo "📋 Test 3: Request with multiple attachments"
echo "-------------------------------------------"
test_endpoint "/style" "Style with multiple files" "{
  \"prompt\": \"Improve this prompt\",
  \"attachments\": [
    {
      \"name\": \"screenshot.png\",
      \"size\": 102400,
      \"type\": \"image/png\",
      \"dataURL\": \"data:image/png;base64,$RED_PIXEL\"
    },
    {
      \"name\": \"notes.pdf\",
      \"size\": 204800,
      \"type\": \"application/pdf\",
      \"dataURL\": \"data:application/pdf;base64,JVBERi0xLjQK\"
    },
    {
      \"name\": \"demo.mp4\",
      \"size\": 2048000,
      \"type\": \"video/mp4\",
      \"dataURL\": \"data:video/mp4;base64,AAAAIGZ0eXBpc29t\"
    }
  ]
}"
echo ""

echo "📋 Test 4: All enhance endpoints"
echo "-------------------------------"
for endpoint in "/structure" "/style" "/simplify" "/score" "/validate"; do
  test_endpoint "$endpoint" "$endpoint endpoint" '{
    "prompt": "Test prompt",
    "attachments": []
  }'
done
echo ""

echo "📋 Test 5: Error handling (missing prompt)"
echo "-----------------------------------------"
echo -n "Testing error handling... "
response=$(curl -s -w "\n%{http_code}" -X POST "$API_BASE/api/enhance/structure" \
  -H "Content-Type: application/json" \
  -d '{"attachments": []}')

http_code=$(echo "$response" | tail -n1)
if [ "$http_code" -eq 400 ]; then
  echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code - correctly rejected)"
  PASS=$((PASS + 1))
else
  echo -e "${RED}✗ FAIL${NC} (HTTP $http_code - should be 400)"
  FAIL=$((FAIL + 1))
fi
echo ""

echo "======================================"
echo "📊 Test Results"
echo "======================================"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✅ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}❌ Some tests failed.${NC}"
  echo ""
  echo "Troubleshooting tips:"
  echo "1. Make sure the backend is running: cd backend && npm start"
  echo "2. Check OPENAI_API_KEY is set in backend/.env"
  echo "3. Verify API_BASE is correct (default: http://localhost:8080)"
  echo ""
  exit 1
fi

