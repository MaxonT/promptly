# 🧪 Testing Guide - User Test Fixes

**Version:** v1.0  
**Date:** 2025-11-29  
**Commit:** be9625d

---

## 🎯 Quick Test Checklist

### ✅ Dashboard (index.html)

#### Test 1.1 - Input Validation
1. Open `index.html` in browser
2. Locate "Project idea" textarea (Question Wizard section)
3. Verify:
   - [ ] "Start Question Wizard" button is **disabled** when page loads
   - [ ] Type < 10 characters → button stays **disabled**
   - [ ] Type 10+ characters → button **enables**
   - [ ] Clear input → button **disables** again
   - [ ] Border color changes: red (empty) → orange (< 10 chars) → green (valid)

#### Test 1.3 - Placeholder Example
- [ ] Placeholder shows: "Example: Build a prompt to summarize YouTube videos into 5 bullet points."
- [ ] Hint text shows: "Minimum 10 characters required"
- [ ] Label shows asterisk: "Project idea *"

#### Test 3.2 - Toast Notification
1. Fill in any Task description
2. Click "Run Optimization"
3. Verify:
   - [ ] Toast appears at top center with "✓ Best Prompt has been updated!"
   - [ ] Toast auto-dismisses after 4 seconds
   - [ ] Page auto-scrolls to "Best Prompt" section
   - [ ] Best Prompt card has blue pulse border effect for 2 seconds

#### Test 3.3 - KPI Tooltips
1. Hover over each KPI label (Accuracy, F1, Pass Rate, Token Cost, Progress %)
2. Verify:
   - [ ] Info icon (ⓘ) appears after label
   - [ ] Tooltip appears above label with explanation
   - [ ] **Accuracy**: "Percentage of test cases that passed with correct outputs"
   - [ ] **F1**: "Balance between precision and recall (higher is better)"
   - [ ] **Pass Rate**: "Ratio of successful runs to total attempts"
   - [ ] **Token Cost**: "Average tokens used per request (lower is better for cost)"
   - [ ] **Progress %**: "Completion percentage towards target accuracy"

---

### ✅ Wizard (wizard.html)

#### Test 1.2 - Auto-Fill from Dashboard
1. On `index.html`, enter project idea: "Build a chatbot for customer support"
2. Click "Start Question Wizard"
3. On `wizard.html`, verify:
   - [ ] Project idea field **auto-fills** with entered text
   - [ ] Border briefly turns **green**
   - [ ] Log shows: "✓ Project idea loaded from previous page"
4. Refresh wizard page directly (without coming from dashboard)
5. Verify:
   - [ ] Field is empty (sessionStorage cleared after one-time use)

#### Test 2.1 - Enhanced Loading State
1. Fill project idea and click "Generate Questions"
2. Verify loading overlay shows:
   - [ ] Spinner animation
   - [ ] "Generating questions..."
   - [ ] "This usually takes 10-15 seconds"
   - [ ] "We'll generate 5-8 customized questions for your project"
3. If backend is slow (>30s):
   - [ ] Message updates to "Still working..."
   - [ ] Shows "This is taking longer than usual"
   - [ ] Shows "Please check your connection or try refreshing"

---

## 🎨 Visual Checks

### Light Theme
- [ ] Switch to light theme
- [ ] All tooltips readable (dark background)
- [ ] Toast notifications visible
- [ ] Input validation colors work

### Dark Theme
- [ ] Switch to dark theme
- [ ] All tooltips readable (dark background with border)
- [ ] Toast notifications visible
- [ ] Input validation colors work

### Responsive
- [ ] Test on mobile viewport (< 768px)
- [ ] Tooltips still work
- [ ] Toast responsive
- [ ] Buttons accessible

---

## 🐛 Known Issues to Watch

### Non-critical
- Form label warnings in HTML (cosmetic, no functional impact)

### Not Implemented (Future)
- Onboarding flow (Problem 5.2)
- Full session progress indicator (Problem 5.1)

---

## 📊 Performance Checks

- [ ] No JavaScript errors in console
- [ ] Page loads in < 2s
- [ ] Animations smooth (60fps)
- [ ] sessionStorage properly cleared after wizard load
- [ ] No memory leaks from tooltips/toasts

---

## 🔄 Regression Tests

Ensure existing functionality still works:

- [ ] Theme switching (auto/light/dark)
- [ ] Language selection
- [ ] Charts rendering
- [ ] Version history
- [ ] Cookie consent banner
- [ ] Wizard question generation
- [ ] Question pagination (Back/Next)
- [ ] Snapshot save/restore
- [ ] Regenerate individual questions

---

## ✨ User Acceptance Criteria

All 7 fixes should make the following user stories work:

1. **As a new user**, I cannot submit empty forms by accident
2. **As a new user**, I see examples to guide my input
3. **As a returning user**, my data flows smoothly between pages
4. **As any user**, I know when the system is loading
5. **As any user**, I get clear feedback when actions complete
6. **As a curious user**, I can learn what each metric means
7. **As a confused user**, I see helpful error messages

---

## 📝 Test Report Template

```
Date: ___________
Tester: ___________
Browser: ___________
OS: ___________

✅ PASSED: 
- Test 1.1: ____
- Test 1.2: ____
- Test 1.3: ____
- Test 2.1: ____
- Test 3.2: ____
- Test 3.3: ____

❌ FAILED:
- None / [describe issue]

💡 SUGGESTIONS:
- [optional improvements]
```

---

**Ready for QA**: ✅  
**Ready for Production**: Pending QA approval

