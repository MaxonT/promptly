const STORAGE_KEYS = {
  AUTH_TOKEN: "auth.token",
  AUTH_SYNCED_AT: "auth.syncedAt",
  HISTORY_ITEMS: "history.items",
  LAST_OPTIMIZATION: "optimize.lastResult"
};

const MESSAGE_TYPES = {
  AUTH_SYNC_REQUEST: "AUTH_SYNC_REQUEST",
  AUTH_SYNC_RESULT: "AUTH_SYNC_RESULT",
  AUTH_GET: "AUTH_GET",
  AUTH_CLEAR: "AUTH_CLEAR",
  OPTIMIZE_START: "OPTIMIZE_START",
  OPTIMIZE_RESULT: "OPTIMIZE_RESULT",
  HISTORY_GET: "HISTORY_GET",
  HISTORY_SAVE: "HISTORY_SAVE",
  HISTORY_DELETE: "HISTORY_DELETE",
  HISTORY_CLEAR: "HISTORY_CLEAR"
};

const HISTORY_LIMIT = 50;

const PROMPTLY_TAB_PATTERNS = [
  "https://promptly.solutions/*",
  "https://www.promptly.solutions/*",
  "https://promptly-v0-6-cloudtest-1.onrender.com/*",
  "https://promptly-v0-6-cloudtest-cursor-dev.onrender.com/*"
];

function getStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.get(keys, (result) => resolve(result));
  });
}

function setStorage(values) {
  return new Promise((resolve) => {
    chrome.storage.local.set(values, () => resolve());
  });
}

function removeStorage(keys) {
  return new Promise((resolve) => {
    chrome.storage.local.remove(keys, () => resolve());
  });
}

async function readTokenViaContentScript(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: "READ_PROMPTLY_TOKEN" }, (response) => {
      if (chrome.runtime.lastError) {
        resolve(null);
        return;
      }
      const token = response?.token;
      resolve(typeof token === "string" && token.trim() ? token.trim() : null);
    });
  });
}

async function readTokenViaExecuteScript(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      try {
        return localStorage.getItem("promptly.token") || "";
      } catch {
        return "";
      }
    }
  });

  const token = typeof result === "string" ? result.trim() : "";
  return token || null;
}

async function syncAuthTokenFromPromptly() {
  const tabs = await chrome.tabs.query({ url: PROMPTLY_TAB_PATTERNS });
  if (!tabs.length) {
    return {
      ok: false,
      error: "No Promptly tab found. Open promptly.solutions and sign in first."
    };
  }

  const orderedTabs = [...tabs].sort((a, b) => Number(b.active) - Number(a.active));

  for (const tab of orderedTabs) {
    try {
      const token =
        (await readTokenViaContentScript(tab.id)) ||
        (await readTokenViaExecuteScript(tab.id));

      if (!token) continue;

      const syncedAt = new Date().toISOString();
      await setStorage({
        [STORAGE_KEYS.AUTH_TOKEN]: token,
        [STORAGE_KEYS.AUTH_SYNCED_AT]: syncedAt
      });

      return {
        ok: true,
        type: MESSAGE_TYPES.AUTH_SYNC_RESULT,
        token,
        syncedAt,
        sourceTabId: tab.id,
        sourceUrl: tab.url || null
      };
    } catch {
      // Continue trying next Promptly tab
    }
  }

  return {
    ok: false,
    error: "Promptly token not found. Please sign in on Promptly first."
  };
}

function normalizeHistoryEntry(entry) {
  const nowIso = new Date().toISOString();
  return {
    id: typeof entry?.id === "string" && entry.id ? entry.id : crypto.randomUUID(),
    createdAt:
      typeof entry?.createdAt === "string" && entry.createdAt
        ? entry.createdAt
        : nowIso,
    input: typeof entry?.input === "string" ? entry.input : "",
    output: typeof entry?.output === "string" ? entry.output : "",
    model: typeof entry?.model === "string" && entry.model ? entry.model : "fast",
    runId: typeof entry?.runId === "string" ? entry.runId : ""
  };
}

async function getHistoryItems() {
  const result = await getStorage([STORAGE_KEYS.HISTORY_ITEMS]);
  const items = result[STORAGE_KEYS.HISTORY_ITEMS];
  return Array.isArray(items) ? items : [];
}

async function saveHistoryItem(entry) {
  const normalized = normalizeHistoryEntry(entry);
  const existing = await getHistoryItems();
  const nextItems = [normalized, ...existing.filter((x) => x.id !== normalized.id)].slice(0, HISTORY_LIMIT);
  await setStorage({ [STORAGE_KEYS.HISTORY_ITEMS]: nextItems });
  return nextItems;
}

async function deleteHistoryItem(id) {
  const existing = await getHistoryItems();
  const nextItems = existing.filter((item) => item.id !== id);
  await setStorage({ [STORAGE_KEYS.HISTORY_ITEMS]: nextItems });
  return nextItems;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    switch (message?.type) {
      case MESSAGE_TYPES.AUTH_SYNC_REQUEST: {
        const response = await syncAuthTokenFromPromptly();
        sendResponse(response);
        return;
      }

      case MESSAGE_TYPES.AUTH_GET: {
        const result = await getStorage([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.AUTH_SYNCED_AT]);
        const token = result[STORAGE_KEYS.AUTH_TOKEN] || null;
        sendResponse({
          ok: true,
          token,
          isConnected: !!token,
          syncedAt: result[STORAGE_KEYS.AUTH_SYNCED_AT] || null
        });
        return;
      }

      case MESSAGE_TYPES.AUTH_CLEAR: {
        await removeStorage([STORAGE_KEYS.AUTH_TOKEN, STORAGE_KEYS.AUTH_SYNCED_AT]);
        sendResponse({ ok: true });
        return;
      }

      case MESSAGE_TYPES.OPTIMIZE_START: {
        sendResponse({ ok: true, startedAt: new Date().toISOString() });
        return;
      }

      case MESSAGE_TYPES.OPTIMIZE_RESULT: {
        await setStorage({
          [STORAGE_KEYS.LAST_OPTIMIZATION]: {
            ok: !!message?.payload?.ok,
            runId: message?.payload?.runId || "",
            finishedAt: new Date().toISOString()
          }
        });
        sendResponse({ ok: true });
        return;
      }

      case MESSAGE_TYPES.HISTORY_GET: {
        const items = await getHistoryItems();
        sendResponse({ ok: true, items });
        return;
      }

      case MESSAGE_TYPES.HISTORY_SAVE: {
        const items = await saveHistoryItem(message?.payload);
        sendResponse({ ok: true, items });
        return;
      }

      case MESSAGE_TYPES.HISTORY_DELETE: {
        const id = typeof message?.payload?.id === "string" ? message.payload.id : "";
        const items = id ? await deleteHistoryItem(id) : await getHistoryItems();
        sendResponse({ ok: true, items });
        return;
      }

      case MESSAGE_TYPES.HISTORY_CLEAR: {
        await setStorage({ [STORAGE_KEYS.HISTORY_ITEMS]: [] });
        sendResponse({ ok: true, items: [] });
        return;
      }

      default:
        sendResponse({ ok: false, error: "Unknown message type" });
    }
  })().catch((error) => {
    sendResponse({ ok: false, error: error?.message || "Unexpected background error" });
  });

  return true;
});
