# Pill Button Design System

## Overview
Premium SaaS-quality interactive buttons for question choices with smooth animations and clear visual feedback.

---

## Visual States

### 1. Default State 🔘

```
┌──────────────────────────┐
│ ○  Web Application       │  ← Transparent background
└──────────────────────────┘  ← Light gray border
```

**Properties:**
- Background: `transparent`
- Border: `1.5px solid rgba(148,163,184,0.3)`
- Text color: `rgba(255,255,255,0.85)`
- Indicator: Empty circle (○) or square (□)

---

### 2. Hover State 🎯

```
┌──────────────────────────┐
│ ◐  Web Application       │  ← Light purple fill
└──────────────────────────┘  ← Purple border + shadow
     ↑ Lifts slightly
```

**Properties:**
- Background: `rgba(124,58,237,0.12)` (12% purple)
- Border: `rgba(124,58,237,0.5)` (50% purple)
- Transform: `translateY(-1px)` (subtle lift)
- Shadow: `0 4px 12px rgba(124,58,237,0.15)`
- Indicator: Highlighted circle/square

**Animation:**
- Duration: `0.25s`
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`

---

### 3. Selected State ✅

```
╔══════════════════════════╗
║ ✓  Web Application       ║  ← Solid purple gradient
╚══════════════════════════╝  ← Enhanced shadow
```

**Properties:**
- Background: `linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%)`
- Border: `rgba(124,58,237,0.8)`
- Text color: `#ffffff` (pure white)
- Font weight: `600` (bold)
- Shadow: `0 4px 16px rgba(124,58,237,0.35)`
- Indicator: White circle/square with checkmark (✓)

**Animation Sequence:**
1. Button scales: `1 → 1.03 → 1` (0.3s)
2. Check icon pops: `scale(0) → scale(1.2) → scale(1)` (0.3s)

---

## Visual Indicators

### Single Choice (Radio Button) 🔘
```
Default:   ○  Option
Hover:     ◐  Option
Selected:  ●✓ Option
```

**Shape:** Circle (`border-radius: 50%`)

---

### Multiple Choice (Checkbox) ☑️
```
Default:   □  Option
Hover:     ▣  Option
Selected:  ■✓ Option
```

**Shape:** Rounded square (`border-radius: 4px`)

---

## Layout Specifications

### Button Structure
```
┌─────────────────────────────────┐
│ [○] Text Label                  │
│  ↑                               │
│  18px indicator                  │
│  at 0.875rem from left           │
└─────────────────────────────────┘
```

**Dimensions:**
- Padding: `0.625rem 1.125rem` (top/bottom, right)
- Left padding: `2.5rem` (room for indicator)
- Indicator size: `18px × 18px`
- Indicator position: `0.875rem` from left edge
- Border radius: `999px` (pill shape)
- Border width: `1.5px`

### Spacing
```
[Button]  0.75rem  [Button]  0.75rem  [Button]
```

- Gap between buttons: `0.75rem`
- Consistent vertical and horizontal spacing
- Buttons wrap naturally on small screens

---

## Animations

### 1. Selection Bounce

```css
@keyframes pillSelect {
  0%   { transform: scale(1);    }  ← Start
  50%  { transform: scale(1.03); }  ← Expand
  100% { transform: scale(1);    }  ← Return
}
```

**Purpose:** Provides tactile feedback when selecting an option

---

### 2. Check Icon Pop

```css
@keyframes checkPop {
  0%   { transform: translateY(-50%) scale(0);   opacity: 0; }  ← Hidden
  50%  { transform: translateY(-50%) scale(1.2); opacity: 1; }  ← Overshoot
  100% { transform: translateY(-50%) scale(1);   opacity: 1; }  ← Settle
}
```

**Purpose:** Emphasizes successful selection with playful entrance

---

## Question Type Labels

Clear labels help users understand interaction:

| Type | Label | Indicator |
|------|-------|-----------|
| `single_choice` | "Single Choice (Pick one)" | ○ Circle |
| `multi_choice` | "Multiple Choice (Pick any)" | □ Square |
| `yes_no` | "Yes/No" | ○ Circle |
| `short_text` | "Short Text" | — None |

---

## Color Palette

### Purple Theme (Primary)
```
Default border:   rgba(148, 163, 184, 0.3)  #94A3B8 @ 30%
Hover border:     rgba(124, 58, 237, 0.5)   #7C3AED @ 50%
Hover fill:       rgba(124, 58, 237, 0.12)  #7C3AED @ 12%
Selected gradient start: #7C3AED
Selected gradient end:   #6D28D9
```

### Shadows
```
Hover:    0 4px 12px rgba(124, 58, 237, 0.15)
Selected: 0 4px 16px rgba(124, 58, 237, 0.35)
          + 0 2px 8px rgba(124, 58, 237, 0.2)
```

---

## Interaction Logic

### Single Choice Behavior
```javascript
// When user clicks an option:
1. Deselect all other options in the group
2. Select the clicked option
3. Trigger selection animation
4. Store value in currentAnswers Map
```

**Code:**
```javascript
function updateSelection() {
  selected.clear();                          // Clear all
  selected.add(opt.value);                   // Add this one
  pills.forEach(p => p.classList.remove("is-selected"));  // Visual clear
  pill.classList.add("is-selected");         // Visual select
  currentAnswers.set(q.id, opt.value);       // Store
}
```

---

### Multiple Choice Behavior
```javascript
// When user clicks an option:
1. Toggle this option (on/off)
2. Keep other selections unchanged
3. Trigger selection animation
4. Store array of values in currentAnswers Map
```

**Code:**
```javascript
function updateSelection() {
  if (selected.has(opt.value)) {
    selected.delete(opt.value);              // Remove
    pill.classList.remove("is-selected");
  } else {
    selected.add(opt.value);                 // Add
    pill.classList.add("is-selected");
  }
  currentAnswers.set(q.id, Array.from(selected));  // Store array
}
```

---

## Accessibility Enhancements

### Keyboard Support (Future)
- Tab: Navigate between options
- Space/Enter: Toggle selection
- Arrow keys: Move within group

### Screen Reader Support (Future)
- `role="radio"` for single-choice
- `role="checkbox"` for multi-choice
- `aria-checked` attribute
- `aria-label` for context

---

## Technical Details

### CSS Classes
```css
.wizard-pill                  /* Base pill button */
.wizard-pill--multi           /* Multi-choice variant (square indicator) */
.wizard-pill.is-selected      /* Selected state */
.wizard-choice-row            /* Container for pills */
```

### DOM Structure
```html
<div class="wizard-choice-row">
  <button class="wizard-pill" data-value="web">
    Web Application
  </button>
  <button class="wizard-pill" data-value="mobile">
    Mobile App
  </button>
</div>
```

### Pseudo-elements
- `::before` - Radio/checkbox indicator background
- `::after` - Checkmark icon (only when selected)

---

## Example Scenarios

### Scenario 1: Platform Selection (Single)
```
Question 1
SINGLE CHOICE (PICK ONE)
What is the primary platform for your project?

○ Web Application
○ Mobile App (iOS/Android)
○ Desktop Application
○ Other (please specify)
```

**After selecting "Mobile App":**
```
●✓ Web Application
●✓ Mobile App (iOS/Android)      ← Selected (purple fill)
○  Desktop Application
○  Other (please specify)
```

---

### Scenario 2: Features Selection (Multi)
```
Question 3
MULTIPLE CHOICE (PICK ANY)
Which features do you need?

□ User Authentication
□ Payment Processing
□ Real-time Chat
□ Push Notifications
```

**After selecting Authentication and Chat:**
```
■✓ User Authentication           ← Selected
□  Payment Processing
■✓ Real-time Chat                ← Selected
□  Push Notifications
```

---

## Performance Considerations

### Optimizations
1. **CSS-only animations** - No JavaScript animation overhead
2. **Hardware acceleration** - `transform` and `opacity` only
3. **Efficient DOM updates** - Direct classList manipulation
4. **Event delegation** (potential future improvement)

### Browser Compatibility
- All modern browsers (Chrome, Firefox, Safari, Edge)
- CSS animations with fallbacks
- Graceful degradation on older browsers

---

## Future Enhancements

1. **Ripple effect** on click (Material Design style)
2. **Keyboard navigation** support
3. **Focus indicators** for accessibility
4. **Dark/light mode** variants
5. **Custom color themes** per project type
6. **Sound effects** on selection (optional)
7. **Haptic feedback** on mobile devices

---

## Testing Checklist

- [ ] Single-choice: Only one option selected at a time
- [ ] Multi-choice: Multiple options can be selected
- [ ] Hover effect appears on mouse over
- [ ] Selection animation plays on click
- [ ] Check icon appears with pop animation
- [ ] Border radius differs between single (circle) and multi (square)
- [ ] Text is readable in all states
- [ ] Spacing is consistent across all buttons
- [ ] Works on mobile/touch devices
- [ ] Answers persist when navigating between pages

---

## Files Modified

- `frontend/wizard.css` - Visual styles and animations
- `frontend/wizard.js` - Selection logic and DOM updates

---

**Result:** Premium, modern, SaaS-quality interaction that feels responsive, tactile, and delightful! ✨

