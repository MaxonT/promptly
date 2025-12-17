#!/bin/bash

echo "🔍 Quick Language Feature Diagnosis"
echo "===================================="
echo ""

echo "1️⃣ Checking backend code modifications..."
echo ""

echo "✓ Checking llmAgents.js for language parameter:"
if grep -q "language = 'en'" backend/src/lib/llmAgents.js; then
    echo "  ✅ FOUND: generateRawSpec has language parameter"
else
    echo "  ❌ NOT FOUND: generateRawSpec missing language parameter!"
fi

echo ""
echo "✓ Checking questionSessions.js for userLanguage:"
if grep -q "userLanguage" backend/src/routes/questionSessions.js; then
    echo "  ✅ FOUND: userLanguage extraction exists"
else
    echo "  ❌ NOT FOUND: userLanguage extraction missing!"
fi

echo ""
echo "✓ Checking LANGUAGE_MAP:"
if grep -q "LANGUAGE_MAP" backend/src/lib/llmAgents.js; then
    echo "  ✅ FOUND: LANGUAGE_MAP defined"
else
    echo "  ❌ NOT FOUND: LANGUAGE_MAP missing!"
fi

echo ""
echo "2️⃣ Checking frontend wizard.js..."
echo ""

echo "✓ Checking if wizard.js passes language parameter:"
if grep -q "language: currentLanguage" frontend/wizard.js; then
    COUNT=$(grep -c "language: currentLanguage" frontend/wizard.js)
    echo "  ✅ FOUND: language parameter passed in $COUNT places"
else
    echo "  ❌ NOT FOUND: language parameter not passed in wizard.js!"
fi

echo ""
echo "3️⃣ Backend service status..."
echo ""

if pgrep -f "node.*server.js" > /dev/null; then
    echo "  ✅ Backend process is running"
    echo "  ⚠️  BUT: You MUST restart it for changes to take effect!"
    echo ""
    echo "  Run these commands:"
    echo "  1. Stop backend: Ctrl+C in the backend terminal"
    echo "  2. Restart: cd backend && npm start"
else
    echo "  ❌ Backend is NOT running!"
    echo ""
    echo "  Start it with: cd backend && npm start"
fi

echo ""
echo "===================================="
echo "📋 Quick Fix Checklist:"
echo ""
echo "[ ] 1. Stop backend service (Ctrl+C)"
echo "[ ] 2. Restart backend: cd backend && npm start"
echo "[ ] 3. Clear browser cache (Cmd+Shift+R or Ctrl+Shift+R)"
echo "[ ] 4. Select 简体中文 in language dropdown"
echo "[ ] 5. Open DevTools → Network tab"
echo "[ ] 6. Run Wizard and check finalize request has 'language: zh-CN'"
echo "[ ] 7. Check backend console shows 'with language: zh-CN'"
echo ""
echo "===================================="

