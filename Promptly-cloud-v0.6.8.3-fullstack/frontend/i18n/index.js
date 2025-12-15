import { i18nConfig } from './config.js';
import { LanguageDetector } from './detector.js';
import { TranslationLoader } from './loader.js';

class I18nManager {
  constructor() {
    this.loader = new TranslationLoader();
    this.detector = new LanguageDetector();
    this.instance = null;
    this.loadedLocales = new Set();
  }

  async init() {
    // Ensure i18next is loaded
    const i18next = window.i18next;
    if (!i18next) {
      console.error('[i18n] i18next library not found');
      return;
    }

    this.instance = i18next.createInstance();
    
    // Detect language
    const detectedLang = this.detector.detect();
    console.log(`[i18n] Detected language: ${detectedLang}`);

    // Load initial translations (detected + fallback)
    try {
      const [userLangData, fallbackData] = await Promise.all([
        this.loader.load(detectedLang),
        detectedLang !== i18nConfig.fallbackLocale ? this.loader.load(i18nConfig.fallbackLocale) : Promise.resolve(null)
      ]);

      await this.instance.init({
        lng: detectedLang,
        fallbackLng: i18nConfig.fallbackLocale,
        resources: {
          [detectedLang]: { translation: userLangData },
          ...(fallbackData ? { [i18nConfig.fallbackLocale]: { translation: fallbackData } } : {})
        },
        debug: false,
        interpolation: { escapeValue: false }
      });

      this.loadedLocales.add(detectedLang);
      if (fallbackData) this.loadedLocales.add(i18nConfig.fallbackLocale);

      // Expose to window for backward compatibility
      window.i18n = this.instance;
      window.i18nManager = this;
      
      // Initialize UI
      this.initUI();
      
      // Global event listeners
      this.instance.on('languageChanged', () => {
        this.translatePage();
        this.updateRTL();
      });

    } catch (e) {
      console.error('[i18n] Initialization failed', e);
    }
  }

  initUI() {
    this.initLangSelect();
    this.translatePage();
    this.updateRTL();
    this.highlightNav();
  }

  initLangSelect() {
    const select = document.getElementById('langSelect');
    if (!select) return;

    select.innerHTML = i18nConfig.supportedLocales
      .map(code => `<option value="${code}">${i18nConfig.localeLabels[code] || code}</option>`)
      .join('');
    
    // Handle locale matching (e.g. en-US -> en)
    const currentLang = this.instance.language;
    if (i18nConfig.supportedLocales.includes(currentLang)) {
      select.value = currentLang;
    } else {
      const shortLang = currentLang.split('-')[0];
      if (i18nConfig.supportedLocales.includes(shortLang)) {
        select.value = shortLang;
      }
    }
    
    // Use onchange for direct binding and to avoid listener accumulation
    select.onchange = (e) => {
        console.log('[i18n] Language change requested:', e.target.value);
        this.changeLanguage(e.target.value);
    };
  }

  async changeLanguage(locale) {
    if (!i18nConfig.supportedLocales.includes(locale)) return;

    // Load if missing
    if (!this.loadedLocales.has(locale)) {
      try {
        const data = await this.loader.load(locale);
        this.instance.addResourceBundle(locale, 'translation', data, true, true);
        this.loadedLocales.add(locale);
      } catch (e) {
        console.error(`[i18n] Failed to switch to ${locale}`, e);
        return;
      }
    }

    await this.instance.changeLanguage(locale);
    localStorage.setItem('locale', locale);
    
    // Update select if changed programmatically
    const select = document.getElementById('langSelect');
    if (select) select.value = locale;
  }

  translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.dataset.i18n;
      const translation = this.instance.t(key);
      
      if (!translation) return;

      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.placeholder = translation;
      } else if (el.tagName === 'OPTION') {
        el.textContent = translation;
      } else {
        el.textContent = translation;
      }
    });
  }

  updateRTL() {
    const lang = this.instance.language;
    const isRTL = ['ar', 'he', 'fa', 'ur'].includes(lang);
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
  }

  highlightNav() {
    const current = window.location.pathname.split('/').pop();
    document.querySelectorAll('.navlinks a').forEach((link) => {
      link.classList.toggle('active', current && link.getAttribute('href') === current);
    });
  }

  formatNumber(value, options = {}) {
    if (value == null || isNaN(value)) return '—';
    try {
      return new Intl.NumberFormat(this.instance.language, options).format(value);
    } catch (e) {
      return String(value);
    }
  }

  formatPercent(value, decimals = 1) {
    if (value == null || isNaN(value)) return '—';
    try {
      return new Intl.NumberFormat(this.instance.language, {
        style: 'percent',
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
      }).format(value);
    } catch (e) {
      return `${(value * 100).toFixed(decimals)}%`;
    }
  }
}

// Start
const i18nManager = new I18nManager();

// Ensure DOM is ready before init to find UI elements
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => i18nManager.init());
} else {
  i18nManager.init();
}

// Export for debugging if needed
export default i18nManager;
