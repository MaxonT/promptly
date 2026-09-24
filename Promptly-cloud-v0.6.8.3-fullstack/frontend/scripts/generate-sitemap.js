#!/usr/bin/env node
/**
 * generate-sitemap.js — Auto-generate primary-domain sitemaps for Promptly
 *
 * Usage:
 *   node scripts/generate-sitemap.js
 *
 * Generates:
 *   - sitemap.xml         (sitemap index for the primary hostname)
 *   - sitemap-pages.xml   (public page URLs on https://promptly.solutions)
 */

const fs = require('fs');
const path = require('path');

// ── Configuration ──────────────────────────────────────────
const PRIMARY_DOMAIN = 'https://promptly.solutions';
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
</sitemapindex>`;
}

// ── Pages Sitemap (sitemap-pages.xml) ──────────────────────
function generatePagesSitemap() {
  const urls = PAGES.map(page => `  <url>
    <loc>${PRIMARY_DOMAIN}${page.path}</loc>
    <lastmod>${TODAY}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
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
console.log(`Primary domain: ${PRIMARY_DOMAIN}`);
console.log(`Pages included: ${PAGES.length}`);
