/**
 * Promptly SEO Manager — Runtime SEO normalization
 * Keeps all search-facing signals pinned to the primary hostname and
 * applies a noindex fallback when the site is served from a secondary domain.
 *
 * Include this script in <head> of every public page:
 *   <script src="lib/seoManager.js"></script>
 */
(function () {
  'use strict';

  const PRIMARY_DOMAIN = 'https://promptly.solutions';
  const currentPath = window.location.pathname;
  const primaryUrl = PRIMARY_DOMAIN + currentPath;
  const currentOrigin = window.location.origin;
  const isPrimaryHost = currentOrigin === PRIMARY_DOMAIN;

  // 1. Ensure canonical always points to primary domain
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = primaryUrl;

  // 2. Remove cross-host alternate tags; they dilute hostname-level SEO signals.
  document.querySelectorAll('link[rel="alternate"]').forEach(function (node) {
    node.remove();
  });

  // 3. Fix Open Graph URL to always use primary domain
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = primaryUrl;

  // 4. Fix og:image to primary domain
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage && ogImage.content.includes(currentOrigin)) {
    ogImage.content = ogImage.content.replace(currentOrigin, PRIMARY_DOMAIN);
  }

  // 5. Fix twitter:image to primary domain
  const twImage = document.querySelector('meta[name="twitter:image"]');
  if (twImage && twImage.content.includes(currentOrigin)) {
    twImage.content = twImage.content.replace(currentOrigin, PRIMARY_DOMAIN);
  }

  // 6. Keep the primary host indexable and mark fallback hosts as noindex.
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {
    robots = document.createElement('meta');
    robots.name = 'robots';
    document.head.appendChild(robots);
  }
  robots.content = isPrimaryHost
    ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1'
    : 'noindex, nofollow, noarchive';

  // 7. Inject JSON-LD WebSite schema if not present
  const existingLD = document.querySelectorAll('script[type="application/ld+json"]');
  let hasWebSite = false;
  existingLD.forEach(function (el) {
    try {
      const data = JSON.parse(el.textContent);
      if (data['@type'] === 'WebSite') {
        // Fix URL in existing WebSite schema
        data.url = PRIMARY_DOMAIN + '/';
        el.textContent = JSON.stringify(data);
        hasWebSite = true;
      }
      // Fix any other schema URLs
      if (data.url && data.url.includes(currentOrigin)) {
        data.url = data.url.replace(currentOrigin, PRIMARY_DOMAIN);
        el.textContent = JSON.stringify(data);
      }
      if (data.logo && data.logo.includes(currentOrigin)) {
        data.logo = data.logo.replace(currentOrigin, PRIMARY_DOMAIN);
        el.textContent = JSON.stringify(data);
      }
      if (data.screenshot && data.screenshot.includes(currentOrigin)) {
        data.screenshot = data.screenshot.replace(currentOrigin, PRIMARY_DOMAIN);
        el.textContent = JSON.stringify(data);
      }
    } catch (e) { /* ignore parse errors */ }
  });

  if (!hasWebSite) {
    const wsSchema = document.createElement('script');
    wsSchema.type = 'application/ld+json';
    wsSchema.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      'name': 'Promptly',
      'url': PRIMARY_DOMAIN + '/',
      'description': 'AI-powered prompt optimization studio for ChatGPT, Claude, Gemini and any LLM.'
    });
    document.head.appendChild(wsSchema);
  }
})();
