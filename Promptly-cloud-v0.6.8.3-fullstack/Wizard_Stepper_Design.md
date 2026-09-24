# Wizard Stepper Design

## Overview
Top-level wizard progress visualization showing three main stages: Describe → Questions → Finalize. Provides users with a strong sense of structured progress throughout the entire wizard flow.

---

## 🎯 Design Goals

1. **Clear Overview**: User sees all steps at a glance
2. **Progress Tracking**: Visual indication of current position
3. **Achievement**: Completed steps shown with checkmarks
4. **Motivation**: See how close to completion

---

## 📊 Complete Visual Layout

### Full Wizard Interface

```
╔═══════════════════════════════════════════════════════╗
║ [Logo] Promptly Question Wizard          v0.6.5      ║  ← Header
╠═══════════════════════════════════════════════════════╣
║                                                       ║
║   ┌─────┐          ┌─────┐          ┌─────┐         ║  ← Stepper (NEW!)
║   │  1  │──────────│  2  │──────────│  3  │         ║
║   └─────┘          └─────┘          └─────┘         ║
║   Describe       Questions        Finalize          ║
║                                                       ║
╠═══════════════════════════════════════════════════════╣
║ [Main content panels below]                          ║
╚═══════════════════════════════════════════════════════╝
```

---

## 🎨 Visual States

### State 1: Describe (Active)

```
╔═══════╗          ╭───────╮          ╭───────╮
║   1   ║──────────│   2   │──────────│   3   │
╚═══════╝          ╰───────╯          ╰───────╯
┗ Describe         Questions          Finalize
  (purple)         (gray)             (gray)
```

**Features:**
- Step 1: Purple gradient fill + glow
- Step 2 & 3: Gray outline only
- Connector 1: Gray
- Connector 2: Gray

---

### State 2: Questions (Active, Describe Completed)

```
╔═══════╗          ╔═══════╗          ╭───────╮
║   ✓   ║██████████║   2   ║──────────│   3   │
╚═══════╝          ╚═══════╝          ╰───────╯
┗ Describe         Questions          Finalize
  (green ✓)        (purple)           (gray)
```

**Features:**
- Step 1: Green fill + checkmark (✓)
- Step 2: Purple gradient fill + glow
- Step 3: Gray outline only
- Connector 1: Green → Purple gradient (filled)
- Connector 2: Gray

---

### State 3: Finalize (Active, All Completed)

```
╔═══════╗          ╔═══════╗          ╔═══════╗
║   ✓   ║██████████║   ✓   ║██████████║   3   ║
╚═══════╝          ╚═══════╝          ╚═══════╝
┗ Describe         Questions          Finalize
  (green ✓)        (green ✓)          (purple)
```

**Features:**
- Step 1 & 2: Green fill + checkmark (✓)
- Step 3: Purple gradient fill + glow
- Connector 1 & 2: Both filled with gradient

---

## 🎭 Component Details

### Circle (Step Indicator)

#### Default (Future Step)
```
╭───────╮
│   3   │  ← Number
╰───────╯
```

**CSS:**
- Size: 40px × 40px
- Border: 2px solid rgba(148,163,184,0.4) - gray
- Background: rgba(15,23,42,0.8) - dark
- Text color: rgba(255,255,255,0.5) - muted white
- Font size: 1rem
- Font weight: 600

---

#### Active (Current Step)
```
╔═══════╗
║   2   ║  ← Bright white number
╚═══════╝
    ↓ glow ring
```

**CSS:**
- Border: #7C3AED (purple)
- Background: `linear-gradient(135deg, #7C3AED, #6D28D9)`
- Text color: #ffffff (pure white)
- Shadow: `0 4px 16px rgba(124,58,237,0.4)`
- Glow ring: `0 0 0 4px rgba(124,58,237,0.2)`
- Animation: stepSlideIn (0.3s)

**Animation:**
```css
@keyframes stepSlideIn {
  from { opacity: 0; transform: scale(0.8); }
  to { opacity: 1; transform: scale(1); }
}
```

---

#### Completed Step
```
╔═══════╗
║   ✓   ║  ← Checkmark
╚═══════╝
```

**CSS:**
- Border: #16A34A (green)
- Background: #16A34A (solid green)
- Text: White checkmark (✓)
- Font size: 1.1rem
- Font weight: 700

**Checkmark Positioning:**
```css
.wizard-stepper-step--completed .wizard-stepper-circle::after {
  content: "✓";
  position: absolute;
}
```

---

### Label (Step Name)

#### Default
```
Questions  ← Muted text
```

**CSS:**
- Font size: 0.875rem
- Font weight: 500
- Color: rgba(255,255,255,0.6) - 60% white
- Transition: 0.3s

---

#### Active
```
Questions  ← Purple text (bold)
```

**CSS:**
- Font size: 0.875rem
- Font weight: 600 (bold)
- Color: #7C3AED (purple)
- Animation: stepFadeIn (0.3s)

**Animation:**
```css
@keyframes stepFadeIn {
  from { opacity: 0; transform: translateX(-20px); }
  to { opacity: 1; transform: translateX(0); }
}
```

---

#### Completed
```
Describe  ← Slightly brighter
```

**CSS:**
- Color: rgba(255,255,255,0.8) - 80% white

---

### Connector (Line Between Steps)

#### Default
```
────────────  (gray line)
```

**CSS:**
- Width: 120px
- Height: 2px
- Background: rgba(148,163,184,0.3) - light gray
- Transition: 0.3s

---

#### Completed
```
████████████  (gradient fill)
```

**CSS:**
- Background: `linear-gradient(90deg, #16A34A, #7C3AED)`
- Green (completed step) → Purple (current step)

---

## 🎬 Animation Sequence

### Transition: Describe → Questions

```
Time:  0ms      150ms           300ms
       │        │               │
       ├────────┤ Step 1 → green
       │        ├───────────────┤ Connector 1 fills
       │                        ├───────────────┤ Step 2 → purple
       │                                        │
Step 1 Step 1     Connector       Step 2       Complete
active completes  animates        activates
```

**Sequence:**
1. Step 1 changes to green (instant)
2. Checkmark (✓) appears
3. Connector 1 fills with gradient
4. Step 2 circle animates (scale + fade)
5. Step 2 label fades in

**Duration:** ~300ms total

---

## 🔧 JavaScript Implementation

### Update Function

```javascript
function updateWizardStepper(currentStep) {
  const steps = [stepDescribe, stepQuestions, stepFinalize];
  const stepNames = ['describe', 'questions', 'finalize'];
  const currentIndex = stepNames.indexOf(currentStep);
  
  // Update step states
  steps.forEach((step, index) => {
    step.classList.remove('wizard-stepper-step--active', 
                          'wizard-stepper-step--completed');
    
    if (index < currentIndex) {
      // Previous steps = completed
      step.classList.add('wizard-stepper-step--completed');
    } else if (index === currentIndex) {
      // Current step = active
      step.classList.add('wizard-stepper-step--active');
    }
    // else: future steps (no class)
  });
  
  // Update connectors
  stepConnectors.forEach((connector, index) => {
    if (index < currentIndex) {
      connector.classList.add('wizard-stepper-connector--completed');
    } else {
      connector.classList.remove('wizard-stepper-connector--completed');
    }
  });
}
```

---

### When to Call

```javascript
// 1. Page load (initial state)
updateWizardStepper('describe');

// 2. After starting wizard (success)
async function startWizard() {
  // ... create session ...
  updateWizardStepper('questions');
}

// 3. After finalizing (success)
async function finalizeSession() {
  // ... finalize spec ...
  updateWizardStepper('finalize');
}
```

---

## 📐 Layout Specifications

### Container
```css
.wizard-stepper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  padding: 1.5rem 2rem;
  background: rgba(15,23,42,0.4);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid rgba(148,163,184,0.2);
}
```

**Visual:**
```
┌───────────────────────────────────────┐
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │  ← Blurred glass background
│                                       │
│   [Step 1] ─── [Step 2] ─── [Step 3] │  ← Centered
│                                       │
└───────────────────────────────────────┘
```

---

### HTML Structure

```html
<div class="wizard-stepper">
  <!-- Step 1 -->
  <div class="wizard-stepper-step wizard-stepper-step--active" id="step-describe">
    <div class="wizard-stepper-circle">1</div>
    <div class="wizard-stepper-label">Describe</div>
  </div>
  
  <!-- Connector 1 -->
  <div class="wizard-stepper-connector"></div>
  
  <!-- Step 2 -->
  <div class="wizard-stepper-step" id="step-questions">
    <div class="wizard-stepper-circle">2</div>
    <div class="wizard-stepper-label">Questions</div>
  </div>
  
  <!-- Connector 2 -->
  <div class="wizard-stepper-connector"></div>
  
  <!-- Step 3 -->
  <div class="wizard-stepper-step" id="step-finalize">
    <div class="wizard-stepper-circle">3</div>
    <div class="wizard-stepper-label">Finalize</div>
  </div>
</div>
```

---

## 🎨 Color Palette

### Active Step (Purple)
```
Circle border:    #7C3AED
Circle fill:      linear-gradient(135deg, #7C3AED, #6D28D9)
Label:            #7C3AED
Shadow:           rgba(124, 58, 237, 0.4)
Glow ring:        rgba(124, 58, 237, 0.2)
```

### Completed Step (Green)
```
Circle border:    #16A34A
Circle fill:      #16A34A
Checkmark:        #ffffff
Label:            rgba(255, 255, 255, 0.8)
```

### Future Step (Gray)
```
Circle border:    rgba(148, 163, 184, 0.4)
Circle fill:      rgba(15, 23, 42, 0.8)
Number:           rgba(255, 255, 255, 0.5)
Label:            rgba(255, 255, 255, 0.6)
```

### Connectors
```
Default:          rgba(148, 163, 184, 0.3)
Completed:        linear-gradient(90deg, #16A34A, #7C3AED)
```

---

## 📊 User Journey Examples

### Example 1: New User

**Page Load:**
```
╔═══════╗          ╭───────╮          ╭───────╮
║   1   ║──────────│   2   │──────────│   3   │
╚═══════╝          ╰───────╯          ╰───────╯
```
Message: "Start by describing your project"

---

**After Starting:**
```
╔═══════╗          ╔═══════╗          ╭───────╮
║   ✓   ║██████████║   2   ║──────────│   3   │
╚═══════╝          ╚═══════╝          ╰───────╯
```
Message: "Answer guided questions"

---

**After Finalizing:**
```
╔═══════╗          ╔═══════╗          ╔═══════╗
║   ✓   ║██████████║   ✓   ║██████████║   3   ║
╚═══════╝          ╚═══════╝          ╚═══════╝
```
Message: "View your generated spec"

---

## 🎯 User Benefits

### 1. Clear Orientation
```
User sees: "I'm on step 2 of 3"
```
→ Knows exactly where they are

### 2. Progress Visualization
```
User sees: [✓]──[2]──[ ]
```
→ 1 done, 1 current, 1 remaining

### 3. Motivation
```
User sees: Almost done! (step 3 of 3)
```
→ Encouraged to complete

### 4. No Confusion
```
User always knows:
- What they just completed (green ✓)
- What they're doing now (purple)
- What's coming next (gray)
```

---

## 📱 Responsive Behavior

### Desktop (Full Width)
```
╔═══════╗          ╔═══════╗          ╭───────╮
║   ✓   ║──────────║   2   ║──────────│   3   │
╚═══════╝          ╚═══════╝          ╰───────╯
Describe        Questions         Finalize
```

---

### Mobile (Future Enhancement)
```
╔═══╗      ╔═══╗      ╭───╮
║ ✓ ║──────║ 2 ║──────│ 3 │
╚═══╝      ╚═══╝      ╰───╯
```
- Smaller circles (30px)
- Shorter connectors (60px)
- Smaller font sizes
- Labels may stack or abbreviate

---

## ✅ Testing Checklist

- [ ] Stepper visible on page load
- [ ] Step 1 active initially (purple)
- [ ] After starting wizard, Step 1 → green ✓
- [ ] After starting wizard, Step 2 → purple (active)
- [ ] Connector 1 fills with gradient
- [ ] Circle animation plays (scale + fade)
- [ ] Label animation plays (slide + fade)
- [ ] After finalizing, Step 2 → green ✓
- [ ] After finalizing, Step 3 → purple (active)
- [ ] Connector 2 fills with gradient
- [ ] All transitions smooth (0.3s)
- [ ] Checkmarks visible on completed steps
- [ ] Colors match design spec

---

## 🚀 Future Enhancements

### 1. Clickable Steps
Navigate back to previous steps by clicking

### 2. Tooltips
```
Hover over step:
┌──────────────────────────┐
│ Describe your project    │  ← Tooltip
│ Status: Completed        │
└──────────────────────────┘
       ╔═══════╗
       ║   ✓   ║
       ╚═══════╝
```

### 3. Progress Percentage
```
33% Complete  ← Above stepper
╔═══════╗          ╔═══════╗          ╭───────╮
║   ✓   ║██████████║   2   ║──────────│   3   │
```

### 4. Sub-steps
```
Questions (3/5 answered)
╔═══════╗
║   2   ║  ● ● ● ○ ○  ← Mini progress
╚═══════╝
```

### 5. Estimated Time
```
Describe      Questions      Finalize
2 min         5-10 min       1 min
```

---

## 📦 Files Modified

- `frontend/wizard.html` - Stepper HTML structure
- `frontend/wizard.css` - Stepper styles + animations
- `frontend/wizard.js` - State update logic

---

## 🎯 Result

**Before:** No indication of overall wizard structure
```
[Panels appear]
[User confused about overall flow]
```

**After:** Crystal clear 3-stage progress
```
╔═══════╗          ╔═══════╗          ╭───────╮
║   ✓   ║██████████║   2   ║──────────│   3   │
╚═══════╝          ╚═══════╝          ╰───────╯
Describe        Questions         Finalize

[I'm on Questions, Describe is done, Finalize is next]
```

**User Experience:**
- ✅ Always know current stage
- ✅ See what's completed (green ✓)
- ✅ See what's active (purple)
- ✅ See what's coming (gray)
- ✅ Motivated by progress visualization
- ✅ Smooth, professional animations

---

**Clear, structured, motivating! 🎉**

