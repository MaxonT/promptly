/**
 * Promptly SEO Manager — Runtime SEO optimization for multi-domain setup
 * Handles canonical URLs, alternate links, and structured data across:
 *   - https://promptly.solutions (primary)
 *   - https://promptly-v0-6-cloudtest-1.onrender.com (secondary)
 *
 * Include this script in <head> of every public page:
 *   <script src="lib/seoManager.js"></script>
 */
(function () {
  'use strict';

  const PRIMARY_DOMAIN = 'https://promptly.solutions';
  const SECONDARY_DOMAIN = 'https://promptly-v0-6-cloudtest-1.onrender.com';

  const currentPath = window.location.pathname;
  const primaryUrl = PRIMARY_DOMAIN + currentPath;
  const secondaryUrl = SECONDARY_DOMAIN + currentPath;

  // 1. Ensure canonical always points to primary domain
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = primaryUrl;

  // 2. Ensure alternate link exists for the other domain
  let alternate = document.querySelector('link[rel="alternate"]');
  if (!alternate) {
    alternate = document.createElement('link');
    alternate.rel = 'alternate';
    document.head.appendChild(alternate);
  }
  // Alternate points to whichever domain we're NOT currently on
  const currentOrigin = window.location.origin;
  alternate.href = currentOrigin === PRIMARY_DOMAIN ? secondaryUrl : primaryUrl;

  // 3. Fix Open Graph URL to always use primary domain
  const ogUrl = document.querySelector('meta[property="og:url"]');
  if (ogUrl) ogUrl.content = primaryUrl;

  // 4. Fix og:image to primary domain
  const ogImage = document.querySelector('meta[property="og:image"]');
  if (ogImage && ogImage.content.includes(SECONDARY_DOMAIN)) {
    ogImage.content = ogImage.content.replace(SECONDARY_DOMAIN, PRIMARY_DOMAIN);
  }

  // 5. Fix twitter:image to primary domain
  const twImage = document.querySelector('meta[name="twitter:image"]');
  if (twImage && twImage.content.includes(SECONDARY_DOMAIN)) {
    twImage.content = twImage.content.replace(SECONDARY_DOMAIN, PRIMARY_DOMAIN);
  }

  // 6. Inject robots meta if missing
  if (!document.querySelector('meta[name="robots"]')) {
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'index, follow';
    document.head.appendChild(robots);
  }

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
      if (data.url && data.url.includes(SECONDARY_DOMAIN)) {
        data.url = data.url.replace(SECONDARY_DOMAIN, PRIMARY_DOMAIN);
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
