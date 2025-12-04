# Global Status Manager API

## Overview

The Global Status Manager provides a persistent cross-page status bar that maintains visibility even when users navigate away from the wizard page.

## Features

- Fixed position status bar at top of viewport
- Persists across page navigation via `sessionStorage`
- Real-time progress bar with percentage
- Elapsed time counter
- Mode-specific time estimates
- Success/error state with color coding
- Auto-hide on completion

## API Reference

### `globalStatus.init()`
Initialize the status bar. Called automatically on DOM ready.

### `globalStatus.show(options)`
Display the status bar with the specified options.

```javascript
globalStatus.show({
  title: '🧙‍♂️ Question Wizard Running',
  subtitle: 'Generating questions...',
  progress: 0,
  mode: 'deep',      // 'fast', 'deep', or 'ultra'
  estimatedTime: true,
  state: 'loading'   // 'loading', 'success', or 'error'
});
```

### `globalStatus.updateProgress(percent)`
Update the progress bar percentage (0-100).

```javascript
globalStatus.updateProgress(45);
```

### `globalStatus.complete(options)`
Mark the status as complete.

```javascript
globalStatus.complete({
  message: '✅ Questions ready!',
  autoHide: true,
  autoHideDelay: 3000
});
```

### `globalStatus.error(options)`
Mark the status as error.

```javascript
globalStatus.error({
  message: '❌ Generation failed',
  details: 'Network timeout',
  autoHide: false
});
```

### `globalStatus.hide()`
Hide the status bar immediately.

### `globalStatus.isVisible()`
Check if the status bar is currently visible.

## Time Estimates by Mode

| Mode  | Time Range |
|-------|------------|
| Fast  | 10–40s     |
| Deep  | 30–90s     |
| Ultra | 90–180s    |

## SessionStorage Schema

```json
{
  "startTime": 1733328000000,
  "visible": true,
  "title": "🧙‍♂️ Question Wizard Running",
  "subtitle": "Generating questions...",
  "progress": 45,
  "mode": "deep",
  "estimatedTime": true,
  "state": "loading",
  "timestamp": 1733328045000
}
```

## CSS Classes

| Class | Description |
|-------|-------------|
| `.global-status-bar` | Main container |
| `.global-status-bar.hidden` | Hidden state |
| `.global-status--success` | Success state (green) |
| `.global-status--error` | Error state (red) |

## Integration Example

```javascript
// In wizard.js - Starting wizard
async function startWizard() {
  globalStatus.show({
    title: '🧙‍♂️ Question Wizard Running',
    subtitle: 'Generating questions...',
    progress: 0,
    mode: currentMode,
    estimatedTime: true
  });

  try {
    const response = await startQuestionSession();
    globalStatus.complete({
      message: '✅ Questions ready!',
      autoHide: true
    });
  } catch (error) {
    globalStatus.error({
      message: '❌ Generation failed',
      details: error.message
    });
  }
}
```

## Cross-Page Persistence

The status bar automatically:
1. Saves state to `sessionStorage` when shown
2. Restores state when page loads
3. Clears state after 5 minutes (stale data protection)
4. Clears state when hidden
