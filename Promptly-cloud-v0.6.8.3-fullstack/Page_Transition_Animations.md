# Page Transition Animations

## Overview
Subtle, directional page transition animations that add life and flow to the wizard without overwhelming users. Uses slide + fade effects with spatial metaphors.

---

## 🎯 Design Goals

1. **Directional Clarity**: Next = left, Back = right (natural reading flow)
2. **Subtle Motion**: Soft, fast, not distracting
3. **Smooth Flow**: GPU-accelerated transforms
4. **No Overwhelm**: Quick timing (200-250ms)

---

## 🎬 Animation Catalog

### 1. Card Entrance Animation (Staggered) ✅

**Already Implemented:**

```
Question 1  ← 0ms delay
Question 2  ← 80ms delay
Question 3  ← 160ms delay
Question 4  ← 240ms delay
Question 5  ← 320ms delay
```

**Effect:** Cards appear in cascade, creating flow

**Implementation:**
```javascript
card.style.animationDelay = `${idx * 80}ms`;
```

**CSS:**
```css
@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.wizard-question-card {
  animation: slideInUp 0.4s cubic-bezier(0.4, 0, 0.2, 1) both;
}
```

---

### 2. Next Button (Forward Navigation) →

#### Visual Flow

```
Step 1: Current page slides out left
┌─────────────┐
│ Q1, Q2, Q3  │ ←←←  (fading + moving left)
└─────────────┘

Step 2: New page slides in from right
              ┌─────────────┐
       →→→    │ Q6, Q7, Q8  │  (appearing + moving in)
              └─────────────┘
```

#### Animation Sequence

**Phase 1: Exit (200ms)**
```css
@keyframes slideOutLeft {
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

**Timing:** 200ms (fast exit)  
**Easing:** `cubic-bezier(0.4, 0, 0.6, 1)` (accelerate out)

---

**Phase 2: Entrance (250ms)**
```css
@keyframes slideInRight {
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

**Timing:** 250ms (smooth entrance)  
**Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` (decelerate in)

---

#### JavaScript Implementation

```javascript
async function handleNext() {
  if (currentPageIndex < totalPages - 1) {
    // 1. Add exit animation class
    questionsContainer.classList.add('wizard-questions--slide-out-left');
    
    // 2. Wait for exit animation (200ms)
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 3. Update page index
    currentPageIndex++;
    
    // 4. Swap classes: remove exit, add entrance
    questionsContainer.classList.remove('wizard-questions--slide-out-left');
    questionsContainer.classList.add('wizard-questions--slide-in-right');
    
    // 5. Render new content
    renderCurrentPage();
    
    // 6. Clean up after entrance completes (250ms)
    setTimeout(() => {
      questionsContainer.classList.remove('wizard-questions--slide-in-right');
    }, 250);
    
    return;
  }
}
```

---

### 3. Back Button (Backward Navigation) ←

#### Visual Flow

```
Step 1: Current page slides out right
              ┌─────────────┐
              │ Q6, Q7, Q8  │ →→→  (fading + moving right)
              └─────────────┘

Step 2: Previous page slides in from left
┌─────────────┐
│ Q1, Q2, Q3  │  ←←←  (appearing + moving in)
└─────────────┘
```

#### Animation Sequence

**Phase 1: Exit (200ms)**
```css
@keyframes slideOutRight {
  from {
    opacity: 1;
    transform: translateX(0);
  }
  to {
    opacity: 0;
    transform: translateX(30px);
  }
}
```

**Timing:** 200ms (fast exit)  
**Easing:** `cubic-bezier(0.4, 0, 0.6, 1)` (accelerate out)

---

**Phase 2: Entrance (250ms)**
```css
@keyframes slideInLeft {
  from {
    opacity: 0;
    transform: translateX(-30px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

**Timing:** 250ms (smooth entrance)  
**Easing:** `cubic-bezier(0.4, 0, 0.2, 1)` (decelerate in)

---

#### JavaScript Implementation

```javascript
async function goBack() {
  if (currentPageIndex > 0) {
    // 1. Add exit animation class
    questionsContainer.classList.add('wizard-questions--slide-out-right');
    
    // 2. Wait for exit animation (200ms)
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 3. Update page index
    currentPageIndex--;
    
    // 4. Swap classes: remove exit, add entrance
    questionsContainer.classList.remove('wizard-questions--slide-out-right');
    questionsContainer.classList.add('wizard-questions--slide-in-left');
    
    // 5. Render new content
    renderCurrentPage();
    
    // 6. Clean up after entrance completes (250ms)
    setTimeout(() => {
      questionsContainer.classList.remove('wizard-questions--slide-in-left');
    }, 250);
  }
}
```

---

## 📊 Complete Animation Timeline

### Next Button Click

```
Time:  0ms      200ms           450ms
       │        │               │
       ├────────┤ Slide out left (opacity 1→0, X 0→-30px)
       │        ├───────────────┤ Slide in right (opacity 0→1, X 30→0)
       │        │   ├───┤ Content updated
       │        │               │
Old    Exit     New content     New content   Animation
page   starts   rendered        fully visible complete
```

**Total Duration:** ~450ms (200ms exit + 250ms entrance)

---

### Back Button Click

```
Time:  0ms      200ms           450ms
       │        │               │
       ├────────┤ Slide out right (opacity 1→0, X 0→30px)
       │        ├───────────────┤ Slide in left (opacity 0→1, X -30→0)
       │        │   ├───┤ Content updated
       │        │               │
Old    Exit     Previous        Previous      Animation
page   starts   content         content       complete
                 rendered        fully visible
```

**Total Duration:** ~450ms (200ms exit + 250ms entrance)

---

## 🎨 Easing Curves

### Exit Animations (Accelerate Out)
```
cubic-bezier(0.4, 0, 0.6, 1)
    ↑    ↑   ↑    ↑
    │    │   │    └─ End fast
    │    │   └────── Accelerate
    │    └──────────── Start slow
    └───────────────── Standard start
```

**Feel:** Snappy, responsive, eager to leave

---

### Entrance Animations (Decelerate In)
```
cubic-bezier(0.4, 0, 0.2, 1)
    ↑    ↑   ↑    ↑
    │    │   │    └─ End slow (settle)
    │    │   └────── Decelerate
    │    └──────────── Start fast
    └───────────────── Standard start
```

**Feel:** Smooth, gentle landing, comfortable arrival

---

## 📐 Motion Parameters

### Distance
```
Slide distance: 30px
```

**Why 30px?**
- Subtle enough to not be jarring
- Visible enough to create clear direction
- Comfortable reading distance

---

### Timing
```
Exit:     200ms (faster)
Entrance: 250ms (slower)
```

**Why different?**
- Exit should be snappy (don't delay user)
- Entrance should be smooth (welcome new content)
- Industry standard (Material Design, iOS)

---

### Opacity Curve
```
Exit:     1.0 → 0.7 → 0.3 → 0.0
Entrance: 0.0 → 0.3 → 0.7 → 1.0
```

**Combined with slide:** Creates smooth fade + slide effect

---

## 🎯 Directional Metaphor

### Spatial Model
```
Past Pages          Current          Future Pages
    ←              [Page 2]              →
(came from left)                  (going to right)
```

**Navigation:**
- **Next →**: Current slides left (revealing right content)
- **Back ←**: Current slides right (revealing left content)

**Mental Model:**
- Pages arranged left-to-right (like a book)
- Next = turn page forward (right → left)
- Back = turn page backward (left → right)

---

## 📊 Example Scenarios

### Scenario 1: Navigate Forward (Page 1 → 2)

**Before Click:**
```
Page 1 visible:
┌─────────────────────────┐
│ Question 1: Platform?   │
│ Question 2: Users?      │
│ Question 3: Features?   │
└─────────────────────────┘
```

**Click "Next" (200ms):**
```
Page 1 sliding out left:
    ┌─────────────────┐
    │ Question 1: ... │ ←←← (fading, moving left)
    │ Question 2: ... │
    └─────────────────┘
Opacity: 1 → 0.5 → 0
```

**Content Update (instant):**
```
DOM replaced with Page 2 content
(not visible yet, positioned 30px right)
```

**Slide In (250ms):**
```
Page 2 appearing from right:
              ┌─────────────────────────┐
       →→→    │ Question 6: Budget?     │ (appearing)
              │ Question 7: Timeline?   │
              │ Question 8: Team size?  │
              └─────────────────────────┘
Opacity: 0 → 0.5 → 1
```

**Final State:**
```
Page 2 fully visible:
┌─────────────────────────┐
│ Question 6: Budget?     │
│ Question 7: Timeline?   │
│ Question 8: Team size?  │
└─────────────────────────┘
```

---

### Scenario 2: Navigate Backward (Page 2 → 1)

**Before Click:**
```
Page 2 visible:
┌─────────────────────────┐
│ Question 6: Budget?     │
│ Question 7: Timeline?   │
│ Question 8: Team size?  │
└─────────────────────────┘
```

**Click "Back" (200ms):**
```
Page 2 sliding out right:
              ┌─────────────────┐
              │ Question 6: ... │ →→→ (fading, moving right)
              │ Question 7: ... │
              └─────────────────┘
Opacity: 1 → 0.5 → 0
```

**Content Update (instant):**
```
DOM replaced with Page 1 content
(not visible yet, positioned 30px left)
```

**Slide In (250ms):**
```
Page 1 appearing from left:
┌─────────────────────────┐
│ Question 1: Platform?   │  ←←← (appearing)
│ Question 2: Users?      │
│ Question 3: Features?   │
└─────────────────────────┘
Opacity: 0 → 0.5 → 1
```

**Final State:**
```
Page 1 fully visible:
┌─────────────────────────┐
│ Question 1: Platform?   │
│ Question 2: Users?      │
│ Question 3: Features?   │
└─────────────────────────┘
```

---

## 🎨 CSS Classes Reference

### Animation Classes

```css
.wizard-questions--slide-out-left {
  animation: slideOutLeft 0.2s cubic-bezier(0.4, 0, 0.6, 1) forwards;
}

.wizard-questions--slide-in-right {
  animation: slideInRight 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}

.wizard-questions--slide-out-right {
  animation: slideOutRight 0.2s cubic-bezier(0.4, 0, 0.6, 1) forwards;
}

.wizard-questions--slide-in-left {
  animation: slideInLeft 0.25s cubic-bezier(0.4, 0, 0.2, 1) forwards;
}
```

**Usage:**
- Apply before transition
- Remove after transition completes
- GPU-accelerated (opacity + transform)

---

## ⚡ Performance Optimizations

### GPU Acceleration
```css
transform: translateX()  /* GPU accelerated */
opacity: 0 → 1          /* GPU accelerated */
```

**Why?**
- No layout recalculation
- Smooth 60fps animations
- Low CPU usage

---

### Animation Cleanup
```javascript
setTimeout(() => {
  questionsContainer.classList.remove('wizard-questions--slide-in-right');
}, 250);
```

**Why?**
- Prevents animation conflicts
- Cleans up DOM
- Allows future animations

---

## 🎯 User Experience Benefits

### 1. Directional Understanding
```
User clicks Next:
"Content is coming from the right" →
Mental model: Moving forward through pages
```

```
User clicks Back:
"Content is returning from the left" ←
Mental model: Going back to previous pages
```

---

### 2. Smooth Transitions
```
No jarring jumps
Pages flow smoothly
Feels polished and professional
```

---

### 3. Progress Sensation
```
Forward motion (Next) feels like progress
Backward motion (Back) feels like review
Clear spatial metaphor
```

---

### 4. Non-Overwhelming
```
Timing: 200-250ms (very quick)
Distance: 30px (subtle)
Opacity: Smooth fade
Result: Noticeable but not distracting
```

---

## 📊 Timing Breakdown

### Total Transition Time

```
Next Button:
├─ Exit animation:     200ms
├─ Content update:       0ms (instant)
├─ Entrance animation: 250ms
└─ Total:              450ms

Back Button:
├─ Exit animation:     200ms
├─ Content update:       0ms (instant)
├─ Entrance animation: 250ms
└─ Total:              450ms
```

**User Perception:** ~0.5 seconds (barely noticeable, feels instant)

---

## 🔧 Technical Implementation

### CSS Keyframes

```css
/* Forward navigation */
@keyframes slideOutLeft {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(-30px); }
}

@keyframes slideInRight {
  from { opacity: 0; transform: translateX(30px); }
  to { opacity: 1; transform: translateX(0); }
}

/* Backward navigation */
@keyframes slideOutRight {
  from { opacity: 1; transform: translateX(0); }
  to { opacity: 0; transform: translateX(30px); }
}

@keyframes slideInLeft {
  from { opacity: 0; transform: translateX(-30px); }
  to { opacity: 1; transform: translateX(0); }
}
```

---

### JavaScript Async Pattern

```javascript
// Pattern for all page transitions
async function transitionPage(direction) {
  // 1. Start exit animation
  questionsContainer.classList.add(`wizard-questions--slide-out-${direction}`);
  
  // 2. Wait for exit
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // 3. Update content
  // (update page index, render)
  
  // 4. Start entrance animation
  const entranceDirection = direction === 'left' ? 'right' : 'left';
  questionsContainer.classList.remove(`wizard-questions--slide-out-${direction}`);
  questionsContainer.classList.add(`wizard-questions--slide-in-${entranceDirection}`);
  
  // 5. Clean up
  setTimeout(() => {
    questionsContainer.classList.remove(`wizard-questions--slide-in-${entranceDirection}`);
  }, 250);
}
```

---

## ✅ Testing Checklist

- [ ] Card entrance: staggered 0/80/160/240/320ms delays
- [ ] Cards fade up from below (slideInUp)
- [ ] Next click: old page slides out left
- [ ] Next click: new page slides in from right
- [ ] Back click: old page slides out right
- [ ] Back click: previous page slides in from left
- [ ] Exit timing: 200ms (fast)
- [ ] Entrance timing: 250ms (smooth)
- [ ] No animation stuttering or lag
- [ ] Transitions feel natural and directional
- [ ] GPU acceleration working (60fps)
- [ ] Animation classes cleaned up properly

---

## 🚀 Future Enhancements

### 1. Swipe Gestures (Mobile)
```
Swipe left → Next page
Swipe right → Previous page
Native mobile feel
```

### 2. Parallax Effect
```
Background moves slower than foreground
Creates depth perception
```

### 3. Blur Transition
```
Exit: blur(0px) → blur(8px)
Entrance: blur(8px) → blur(0px)
Adds cinematic quality
```

### 4. Elastic Easing
```
cubic-bezier(0.68, -0.55, 0.265, 1.55)
Slight overshoot for playfulness
```

---

## 📦 Files Modified

- `frontend/wizard.css` - Animation keyframes + classes
- `frontend/wizard.js` - Async animation sequencing in handleNext() and goBack()

---

## 🎯 Result

**Before:** Instant page changes (jarring)
```
Page 1
↓ (click Next)
Page 2 (instant, no transition)
```

**After:** Smooth, directional slides
```
Page 1
↓ (click Next)
[Page 1 slides left + fades out]  200ms
[Page 2 slides in from right]     250ms
Page 2 (smooth arrival)
```

**User Perception:**
- ✅ Directional navigation (spatial metaphor)
- ✅ Smooth, professional transitions
- ✅ No jarring jumps
- ✅ Feels polished and premium
- ✅ Fast enough to not annoy
- ✅ Slow enough to perceive direction

---

**Smooth, directional, delightful! 🎬✨**

