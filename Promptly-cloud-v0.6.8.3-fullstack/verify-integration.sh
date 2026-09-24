#!/bin/bash

# 验证 Promptly 集成状态
BASE_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$BASE_DIR"
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"

source_env() {
  if [ -f "$PROJECT_ROOT/.env" ]; then
    set -o allexport
    source "$PROJECT_ROOT/.env"
    set +o allexport
  fi
}

check_file_reference() {
  local file="$1"
  local token="$2"
  if grep -q "$token" "$file"; then
    echo "✔ $file includes $token"
  else
    echo "✗ $file missing $token"
    exit 1
  fi
}

echo "=== Promptly Integration Verification ==="
source_env

echo "1. Checking version parity..."
FRONTEND_VERSION=$(node -p "require('./frontend/package.json').version")
BACKEND_VERSION=$(node -p "require('./backend/package.json').version")
echo "- Frontend version: $FRONTEND_VERSION"
echo "- Backend version:  $BACKEND_VERSION"
if [ "$FRONTEND_VERSION" != "$BACKEND_VERSION" ]; then
  echo "❌ Version mismatch"
  exit 1
else
  echo "✔ Version parity confirmed"
fi

echo "2. Checking config references..."
check_file_reference "$PROJECT_ROOT/frontend/index.html" "config.js"
check_file_reference "$PROJECT_ROOT/frontend/wizard.html" "config.js"

echo "3. Checking environment variable templates..."
if [ -f "$PROJECT_ROOT/frontend/.env.example" ]; then
  echo "⚠ .env.example exists (optional)."
else
  echo "ℹ .env.example does not exist (optional)."
fi

echo "4. Checking Vercel config..."
if grep -q "npm run build" "$PROJECT_ROOT/frontend/vercel.json"; then
  echo "✔ vercel.json uses npm run build"
else
  echo "✗ vercel.json build command missing"
  exit 1
fi

echo "5. Checking config.js is gitignored..."
if grep -q "/frontend/config.js" "$PROJECT_ROOT/.gitignore"; then
  echo "✔ config.js ignored"
else
  echo "✗ config.js not ignored"
  exit 1
fi

echo "6. Checking backend routes file presence..."
for route in auth doc share specs questionSessions runs outcomeRuns enhance prompts pipeline; do
  if [ ! -f "$PROJECT_ROOT/backend/src/routes/${route}.js" ]; then
    echo "✗ Missing route file: $route"
    exit 1
  fi
done
echo "✔ All backend route files present"

echo "7. Checking server log middleware..."
if grep -q "log middleware" "$PROJECT_ROOT/backend/src/server.js" || grep -q "res.on('finish'" "$PROJECT_ROOT/backend/src/server.js"; then
  echo "✔ Request logging middleware exists"
else
  echo "✗ Request logging middleware missing"
  exit 1
fi

echo "8. Checking root health endpoint..."
if curl -sf "$BACKEND_URL/api/health" >/dev/null 2>&1; then
  echo "✔ Backend health endpoint reachable"
else
  echo "⚠ Unable to reach backend health endpoint. Skipping."
fi

echo "=== Integration verification complete ==="

