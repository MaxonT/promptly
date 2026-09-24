(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type !== "READ_PROMPTLY_TOKEN") return false;

    try {
      const token = localStorage.getItem("promptly.token") || null;
      sendResponse({
        ok: true,
        token,
        sourceUrl: window.location.href
      });
    } catch (error) {
      sendResponse({
        ok: false,
        token: null,
        error: error?.message || "Failed to read token"
      });
    }

    return true;
  });
})();
