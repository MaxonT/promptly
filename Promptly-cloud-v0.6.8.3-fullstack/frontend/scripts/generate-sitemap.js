#!/usr/bin/env node
/**
 * generate-sitemap.js — Auto-generate sitemaps for Promptly multi-domain setup
 *
 * Usage:
 *   node scripts/generate-sitemap.js
 *
 * Generates:
 *   - sitemap.xml         (sitemap index referencing domain-specific sitemaps)
 *   - sitemap-pages.xml   (all public page URLs for both domains)
 *
 * Industry standards followed:
 *   - Sitemaps.org protocol (https://www.sitemaps.org/protocol.html)
 *   - Google sitemap guidelines
 *   - Cross-domain alternate URL references
 */

const fs = require('fs');
const path = require('path');

// ── Configuration ──────────────────────────────────────────
const PRIMARY_DOMAIN = 'https://promptly.solutions';
const SECONDARY_DOMAIN = 'https://promptly-v0-6-cloudtest-1.onrender.com';
const FRONTEND_DIR = path.resolve(__dirname, '..');
const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// Pages to include in sitemap (path, changefreq, priority)
const PAGES = [
  { path: '/',                  changefreq: 'weekly',  priority: '1.0' },
  { path: '/wizard.html',      changefreq: 'weekly',  priority: '0.9' },
  { path: '/enhancer.html',    changefreq: 'weekly',  priority: '0.9' },
  { path: '/subscription.html',changefreq: 'monthly', priority: '0.7' },
  { path: '/privacy.html',     changefreq: 'yearly',  priority: '0.4' },
  { path: '/terms.html',       changefreq: 'yearly',  priority: '0.4' },
  { path: '/cookies.html',     changefreq: 'yearly',  priority: '0.3' },
];

// ── Sitemap Index (sitemap.xml) ────────────────────────────
function generateSitemapIndex() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${PRIMARY_DOMAIN}/sitemap-pages.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${SECONDARY_DOMAIN}/sitemap-pages.xml</loc>
    <lastmod>${TODAY}</lastmod>
  </sitemap>
</sitemapindex>`;
}

// ── Pages Sitemap (sitemap-pages.xml) ──────────────────────
function generatePagesSitemap() {
  const urls = PAGES.map(page => `  <url>
    <loc>${PRIMARY_DOMAIN}${page.path}</loc>
    <xhtml:link rel="alternate" hreflang="x-default" href="${PRIMARY_DOMAIN}${page.path}" />
    <xhtml:link rel="alternate" href="${SECONDARY_DOMAIN}${page.path}" />
    <lastmod>${TODAY}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>`;
}

// ── Write Files ────────────────────────────────────────────
const sitemapIndexPath = path.join(FRONTEND_DIR, 'sitemap.xml');
const pagesSitemapPath = path.join(FRONTEND_DIR, 'sitemap-pages.xml');

fs.writeFileSync(sitemapIndexPath, generateSitemapIndex(), 'utf8');
console.log(`✓ Generated ${sitemapIndexPath}`);

fs.writeFileSync(pagesSitemapPath, generatePagesSitemap(), 'utf8');
console.log(`✓ Generated ${pagesSitemapPath}`);

console.log(`\nSitemaps generated for date: ${TODAY}`);
console.log(`Primary domain:   ${PRIMARY_DOMAIN}`);
console.log(`Secondary domain: ${SECONDARY_DOMAIN}`);
console.log(`Pages included:   ${PAGES.length}`);
