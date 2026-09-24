# Plan Limits UI Implementation Summary

## Overview
Implemented comprehensive plan limits UI in Question Wizard to make free/premium distinctions clear to users.

## Changes Made

### 1. Frontend - wizard.js

#### Default Mode Change
- Changed default mode from "standard" to "fast" (line 110)
- Updated MODE_OPTIONS with `requiresPremium` flags:
  - `fast`: false (A+ tier, free)
  - `deep`: true (S tier, premium)
  - `ultra`: true (S+ tier, premium)

#### Plan Checking Logic
Added functions to fetch and enforce plan limits:

```javascript
// Fetch user plan information from backend
async function fetchUserPlanInfo() {
  const res = await fetch(`${API_BASE}/api/billing/status`);
  const data = await res.json();
  return {
    plan: data.plan || 'free',
    isPremium: data.plan !== 'free',
    dailyLimit: data.limits?.questionWizard?.daily || 5,
    used: data.usage?.questionWizard || 0
  };
}
```

#### Mode Selector Enhancement
Modified `initModeSelector()` to:
- Disable premium modes for free users by adding `.is-disabled` class
- Show upgrade prompts when clicking disabled modes
- Display plan usage banner at top of wizard

#### Plan Info Banner
Created dynamic banner showing:
- Current plan badge (🆓 Free Plan / 💎 Premium Plan)
- Usage stats (e.g., "Question Wizard: 3/5 used today")
- Upgrade link for free users
- "Unlimited access" message for premium users

### 2. Frontend - wizard.html

#### Premium Badges
Added `<span class="wizard-mode-premium-badge">💎 Premium</span>` to:
- Deep Thinking mode card (line 203)
- Ultra Thinking mode card (line 210)

Added `data-requires-premium="true"` attribute to premium mode cards.

### 3. Frontend - wizard.css

#### Premium Badge Styling
```css
.wizard-mode-premium-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  background: linear-gradient(135deg, #f59e0b 0%, #f97316 100%);
  color: white;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3);
}
```

#### Disabled State Styling
```css
.wizard-mode-option.is-disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: auto;
}
```

#### Plan Banner Styling
Added complete styling for `.wizard-plan-banner`, `.wizard-plan-info`, `.wizard-plan-badge`, `.wizard-plan-limit`, and `.wizard-plan-upgrade` with:
- Gradient backgrounds
- Hover effects
- Responsive layout
- Slide-in animation

### 4. Backend - routes/billing.js

#### Enhanced /api/billing/status Endpoint
Added plan limits and usage information to response:

```javascript
import { getUserPlan, getDailyUsage } from "../lib/planLimits.js";

// Response now includes:
{
  plan: 'free' | 'monthly' | 'yearly' | 'trial',
  limits: {
    promptOptimization: { daily: 8 | null },
    questionWizard: { daily: 5 | null }
  },
  usage: {
    promptOptimization: number,
    questionWizard: number
  },
  // ... existing fields
}
```

## User Experience Flow

### Free Plan Users
1. Opens Question Wizard
2. Sees plan banner: "🆓 Free Plan | Question Wizard: 3/5 used today | ⬆️ Upgrade"
3. Fast mode is selected by default (available)
4. Deep and Ultra modes show "💎 Premium" badges and are grayed out
5. Clicking disabled mode shows: "🔒 Deep Thinking mode requires Premium. Upgrade now for unlimited access."

### Premium Plan Users
1. Opens Question Wizard
2. Sees plan banner: "💎 Premium Plan | ✨ Unlimited access to all modes"
3. All three modes (fast, deep, ultra) are fully accessible
4. No restrictions or upgrade prompts

## Plan Limits Reference

### Free Plan
- Prompt Optimization: 8 times/day
- Question Wizard: 5 times/day
- Allowed modes: fast, standard only
- Deep and Ultra modes: locked

### Pro Plans (Monthly/Yearly/Trial)
- Prompt Optimization: unlimited
- Question Wizard: unlimited
- All modes available: fast, standard, deep, ultra

## API Contract

### GET /api/billing/status
**Response:**
```json
{
  "ok": true,
  "plan": "free",
  "limits": {
    "promptOptimization": { "daily": 8 },
    "questionWizard": { "daily": 5 }
  },
  "usage": {
    "promptOptimization": 3,
    "questionWizard": 2
  },
  "subscription": { ... },
  "tokens": { ... }
}
```

## Testing Checklist

- [ ] Free user sees plan banner with usage stats
- [ ] Free user cannot click deep/ultra modes (grayed out)
- [ ] Clicking disabled mode shows upgrade prompt
- [ ] Premium user sees "unlimited access" banner
- [ ] Premium user can access all modes
- [ ] Default mode is "fast" for all users
- [ ] Plan usage updates after each wizard run
- [ ] Upgrade link redirects to subscription.html
- [ ] Mode selector keyboard navigation works
- [ ] Premium badges display correctly

## Files Modified

1. `frontend/wizard.js` - Plan checking logic, mode selector, banner display
2. `frontend/wizard.html` - Premium badge markup
3. `frontend/wizard.css` - Premium badge and disabled state styling, plan banner CSS
4. `backend/src/routes/billing.js` - Enhanced status endpoint with limits/usage

## Next Steps

1. Test with real user accounts (free and premium)
2. Verify usage counting increments correctly
3. Test upgrade flow from wizard to subscription page
4. Add similar plan indicators to hero page if needed
5. Monitor analytics for conversion rate from upgrade prompts
