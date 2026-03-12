# Promptly Chrome Extension (V1)

This extension wraps Promptly's existing pipeline optimization flow in a popup UI.

## Features

- Sync auth token from an already logged-in Promptly tab
- Optimize raw prompts via `POST /api/pipeline/run` + SSE stream
- Copy optimized prompt
- Save local optimization history (`chrome.storage.local`)

## Load in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select this folder: `extensions/promptly-chrome/`

## First-time setup

1. Log in at [Promptly](https://promptly.solutions)
2. Open extension popup
3. Click **Connect Promptly Account**
4. Paste your raw prompt and click **Optimize**

## Backend CORS for extension

Backend must allow your extension origin, for example:

```bash
CHROME_EXTENSION_ORIGINS=chrome-extension://<YOUR_EXTENSION_ID>
```

You can find `<YOUR_EXTENSION_ID>` on `chrome://extensions` after loading unpacked.
