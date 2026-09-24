# Guided Flow Experience

## Overview
Transform the wizard from a static form into a guided journey with premium animations and visual feedback.

---

## 🎯 Design Philosophy

**Before:** User fills a form, clicks button, sees results  
**After:** User enters a guided flow with clear visual progression and feedback

---

## ✨ Feature Breakdown

### 1. Enhanced Typing Experience

#### Purple Caret
```css
caret-color: #7C3AED;
```

**Visual:**
```
Project idea
┌───────────────────────────────┐
│ Help me design a...│          │  ← Purple blinking cursor
└───────────────────────────────┘
```

**Benefits:**
- Brand consistency (matches theme color)
- More visible than default black/white
- Subtle but noticeable

---

### 2. Focus State Magic ✨

#### Before Focus (Default)
```
Project idea
┌───────────────────────────────┐
│                                │
└───────────────────────────────┘
Border: rgba(148,163,184,0.6) - gray
Background: rgba(15,23,42,0.8) - dark semi-transparent
```

#### After Focus (Active)
```
1. Describe your project  ← Title shifts up + turns purple
╔═══════════════════════════════╗
║                               ║  ← Input lifts up
╚═══════════════════════════════╝
  ↑ Purple border + glow ring
```

**CSS Implementation:**
```css
textarea:focus {
  outline: none;
  border-color: rgba(124,58,237,0.8);           /* Purple border */
  background: rgba(15,23,42,0.95);              /* More opaque */
  box-shadow: 
    0 0 0 3px rgba(124,58,237,0.2),             /* Focus ring */
    0 0 20px rgba(124,58,237,0.15);             /* Glow effect */
  transform: translateY(-2px);                   /* Lift up */
}
```

**Animation:**
- Duration: `0.3s`
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)` (Material Design)
- Properties: `all` (border, background, shadow, transform)

---

### 3. Title Animation

#### Interactive Behavior
```
User clicks textarea/select
        ↓
Title shifts up 4px + turns purple
        ↓
User blurs input
        ↓
Title returns to original position + color
```

**CSS:**
```css
.wizard-panel--idea.is-focused h2 {
  transform: translateY(-4px);
  color: #7C3AED;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
```

**JavaScript:**
```javascript
ideaInput?.addEventListener("focus", () => {
  ideaPanel?.classList.add("is-focused");
});

ideaInput?.addEventListener("blur", () => {
  ideaPanel?.classList.remove("is-focused");
});
```

**Visual Effect:**
```
Normal:    1. Describe your project
                ↓ (user focuses input)
Focused:   1. Describe your project  ← Shifted up + purple
```

---

### 4. Page Transition Sequence 🎬

#### Step-by-Step Flow

**Step 1: User clicks "Start wizard"**
```
[Start wizard] ← Click
```

**Step 2: Button enters loading state**
```
[Starting...] ← Shimmer animation
```

**Step 3: Left panel fades out (300ms)**
```
1. Describe your project     1. Describe your project
┌─────────────────────┐  →  ┌─────────────────────┐
│ Project idea        │      │ Project idea        │  ← Fading out
│ [Starting...]       │      │ [Starting...]       │     Moving left
└─────────────────────┘      └─────────────────────┘
Opacity: 1 → 0.5 → 0
Position: X(0) → X(-30px)
```

**Step 4: API call executes**
```
POST /api/question-sessions
{ "initial_description": "...", "kind": "..." }
```

**Step 5: Questions panel fades in (from right)**
```
2. Answer guided questions
┌─────────────────────┐
│ Question 1          │  ← Fading in
│ ○ Option A          │     Moving from right
│ ○ Option B          │
└─────────────────────┘
Opacity: 0 → 0.5 → 1
Position: X(30px) → X(0)
```

**Step 6: Questions appear with stagger**
```
Question 1  ← 0ms delay
Question 2  ← 80ms delay
Question 3  ← 160ms delay
Question 4  ← 240ms delay
Question 5  ← 320ms delay
```

#### Animation Keyframes

**Left Panel Exit:**
```css
@keyframes fadeOutLeft {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(-30px);
  }
}
```

**Right Panel Entrance:**
```css
@keyframes fadeInRight {
  from {
    opacity: 0;
    transform: translateX(30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

#### Timing Diagram
```
Time:  0ms      300ms           900ms           1500ms
       │        │               │               │
       ├────────┤ Left fades out
       │        ├───────────────┤ API call
       │        │        ├──────┤ Right fades in
       │        │               ├───────────────┤ Questions appear (staggered)
       │        │               │               │
User   Button   Left panel      Questions       All questions
clicks disabled invisible       start appearing visible
```

---

### 5. Button States & Animations

#### State 1: Default (Ready)
```
╭─────────────────────╮
│   Start wizard      │  ← Gradient background
╰─────────────────────╯
```
- Background: `linear-gradient(120deg, #7C3AED, #06B6D4)`
- Hover: Lifts up 2px + shadow

#### State 2: Hover
```
╭─────────────────────╮
│   Start wizard      │  ← Lifted + glowing
╰─────────────────────╯
    ↑ 2px lift
```
- Transform: `translateY(-2px)`
- Shadow: `0 4px 16px rgba(124,58,237,0.4)`

#### State 3: Loading (Disabled)
```
╭═════════════════════╮
║   Starting...       ║  ← Shimmer effect
╚═════════════════════╝
    ↑ Gradient sliding
```
- Disabled: `true`
- Text: "Starting..."
- Animation: Shimmer (gradient slides horizontally)

**Shimmer Animation:**
```css
@keyframes shimmer {
  0%   { background-position: 200% 0; }   ← Start right
  100% { background-position: -200% 0; }  ← End left
}
```
- Duration: `2s`
- Loop: `infinite`
- Easing: `linear`

#### State 4: Success
```
╭─────────────────────╮
│ Session started     │  ← Stays disabled
╰─────────────────────╯
```
- Text: "Session started"
- Still disabled (prevents re-clicking)

#### State 5: Error Recovery
```
╭─────────────────────╮
│   Start wizard      │  ← Re-enabled
╰─────────────────────╯
```
- Animations revert
- Button re-enables
- User can retry

---

## 📊 Visual Timeline

### Complete User Journey

```
1. PAGE LOAD
   ┌─────────────────────────────────────┐
   │ 1. Describe your project            │
   │ ┌─────────────────────────────────┐ │
   │ │ Project idea                    │ │
   │ └─────────────────────────────────┘ │
   │ [Start wizard]                      │
   └─────────────────────────────────────┘

2. USER FOCUSES INPUT
   ┌─────────────────────────────────────┐
   │ 1. Describe your project ← Purple!  │  ← Title shifts up
   │ ╔═════════════════════════════════╗ │
   │ ║ Help me design a...│            ║ │  ← Purple caret
   │ ╚═════════════════════════════════╝ │  ← Glow ring
   │    ↑ Input lifted                   │
   │ [Start wizard]                      │
   └─────────────────────────────────────┘

3. USER CLICKS "START WIZARD"
   ┌─────────────────────────────────────┐
   │ 1. Describe your project            │
   │ ┌─────────────────────────────────┐ │
   │ │ Help me design a full-stack...  │ │
   │ └─────────────────────────────────┘ │
   │ [Starting...] ← Shimmer             │
   └─────────────────────────────────────┘

4. LEFT PANEL FADES OUT (0.3s)
   ┌─────────────────────────────────────┐
   │ 1. Describe your project            │  ← Fading...
   │ ┌─────────────────────────────────┐ │     Moving left
   │ │ Help me design a full-stack...  │ │
   │ └─────────────────────────────────┘ │
   │ [Starting...]                       │
   └─────────────────────────────────────┘
   Opacity: 0.5

5. QUESTIONS FADE IN FROM RIGHT (0.6s)
   ┌─────────────────────────────────────┐
   │ 2. Answer guided questions          │  ← Appearing
   │ ┌─────────────────────────────────┐ │     from right
   │ │ Question 1                      │ │
   │ │ What is your platform?          │ │
   │ │ ○ Web  ○ Mobile  ○ Desktop      │ │
   │ └─────────────────────────────────┘ │
   └─────────────────────────────────────┘
   Opacity: 0.5

6. ALL QUESTIONS VISIBLE
   ┌─────────────────────────────────────┐
   │ 2. Answer guided questions          │
   │ ┌─────────────────────────────────┐ │
   │ │ Question 1                      │ │  ← 0ms
   │ │ ○ Web  ○ Mobile  ○ Desktop      │ │
   │ └─────────────────────────────────┘ │
   │ ┌─────────────────────────────────┐ │
   │ │ Question 2                      │ │  ← 80ms
   │ │ ○ Yes  ○ No                     │ │
   │ └─────────────────────────────────┘ │
   │ ┌─────────────────────────────────┐ │
   │ │ Question 3                      │ │  ← 160ms
   │ └─────────────────────────────────┘ │
   └─────────────────────────────────────┘
```

---

## 🎨 CSS Classes Reference

### Focus State
```css
.wizard-panel--idea.is-focused h2 {
  /* Title animation when input focused */
  transform: translateY(-4px);
  color: #7C3AED;
}
```

### Transition States
```css
.wizard-panel--idea.is-starting {
  /* Left panel exit animation */
  animation: fadeOutLeft 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.wizard-panel--qa.is-appearing {
  /* Right panel entrance animation */
  animation: fadeInRight 0.6s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
```

### Button States
```css
.wizard-button-primary:disabled {
  /* Loading state with shimmer */
  opacity: 0.6;
  cursor: not-allowed;
  animation: shimmer 2s linear infinite;
}
```

---

## 🔧 JavaScript Implementation

### Focus Tracking
```javascript
// Get panel references
const ideaPanel = document.querySelector(".wizard-panel--idea");

// Listen for focus events
ideaInput?.addEventListener("focus", () => {
  ideaPanel?.classList.add("is-focused");
});

ideaInput?.addEventListener("blur", () => {
  ideaPanel?.classList.remove("is-focused");
});
```

### Transition Sequencing
```javascript
async function startWizard() {
  // 1. Validate input
  if (!idea) {
    ideaError.textContent = "Please describe your project idea...";
    return;
  }
  
  // 2. Start exit animation
  ideaPanel?.classList.add("is-starting");
  startBtn.disabled = true;
  startBtn.textContent = "Starting...";
  
  // 3. Wait for animation (300ms)
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // 4. Start API call + entrance animation
  qaPanel?.classList.add("is-appearing");
  const res = await fetch("/api/question-sessions", {...});
  
  // 5. Handle response
  if (!res.ok) {
    // Revert animations on error
    ideaPanel?.classList.remove("is-starting");
    qaPanel?.classList.remove("is-appearing");
    startBtn.disabled = false;
    startBtn.textContent = "Start wizard";
    return;
  }
  
  // 6. Success - render questions
  renderCurrentPage();
  startBtn.textContent = "Session started";
}
```

---

## 🎯 UX Benefits

### 1. Clear Visual Feedback
- User knows exactly which section is active
- Purple accent draws attention to focused elements
- Smooth animations feel professional

### 2. Guided Experience
- Transition animations suggest progression
- One section at a time (left panel → right panel)
- Feels like a journey, not a form

### 3. Loading State Clarity
- Button shimmer indicates processing
- Text changes communicate state
- No ambiguity about what's happening

### 4. Error Recovery
- Graceful animation reversal
- Button re-enables automatically
- User can retry without confusion

### 5. Premium Feel
- Smooth cubic-bezier easing
- Consistent timing (300ms, 600ms)
- No jarring transitions

---

## 📐 Timing Guidelines

### Animation Durations
- **Focus/blur:** 0.3s (quick, responsive)
- **Panel exit:** 0.5s (noticeable but not slow)
- **Panel entrance:** 0.6s (slightly longer for emphasis)
- **Shimmer:** 2s loop (calm, professional)

### Easing Function
```css
cubic-bezier(0.4, 0, 0.2, 1)
```
- Material Design standard easing
- Starts quickly, slows at end
- Feels natural and polished

---

## 🧪 Testing Checklist

- [ ] Focus textarea → Title moves up + turns purple
- [ ] Blur textarea → Title returns to normal
- [ ] Focus select dropdown → Title moves up
- [ ] Click "Start wizard" → Button shows "Starting..." with shimmer
- [ ] API call succeeds → Left panel fades out left
- [ ] Questions appear → Right panel fades in right
- [ ] Questions stagger → 0ms, 80ms, 160ms, 240ms, 320ms delays
- [ ] API call fails → Animations revert, button re-enables
- [ ] Hover enabled button → Lifts up + shadow
- [ ] Hover disabled button → No effect

---

## 📦 Files Modified

- `frontend/wizard.css` - Animations + focus styles
- `frontend/wizard.js` - Event listeners + transition sequencing

---

## 🚀 Deployment

Upload to Vercel and test immediately:

```bash
cd frontend/
vercel --prod
```

**Test Flow:**
1. Visit wizard page
2. Click in textarea
3. Type description
4. Click "Start wizard"
5. Watch the magic happen! ✨

---

**Result:** A cohesive, guided experience that feels premium and delightful. Users feel like they're being guided through a flow, not filling out a boring form.

