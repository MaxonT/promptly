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
      
      // Global event listeners
      this.instance.on('languageChanged', () => {
        this.translatePage();
        this.updateRTL();
      });

      console.log('[i18n] Initialization successful, language:', this.instance.language);

    } catch (e) {
      console.error('[i18n] Initialization failed', e);
      // Initialize with minimal config to allow UI to work
      try {
        await this.instance.init({
          lng: detectedLang,
          fallbackLng: i18nConfig.fallbackLocale,
          resources: {},
          debug: false,
          interpolation: { escapeValue: false }
        });
        window.i18n = this.instance;
        window.i18nManager = this;
        console.log('[i18n] Fallback initialization successful');
      } catch (fallbackError) {
        console.error('[i18n] Fallback initialization also failed', fallbackError);
      }
    } finally {
      // Initialize UI regardless of translation loading status
      // This ensures the language dropdown is populated even if network fails
      this.initUI();
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
    if (!select) {
      console.warn('[i18n] #langSelect not found in DOM');
      return;
    }

    console.log('[i18n] Initializing language selector...');

    // Force clear and rebuild to ensure no stale state
    select.innerHTML = '';
    const options = i18nConfig.supportedLocales
      .map(code => `<option value="${code}">${i18nConfig.localeLabels[code] || code}</option>`)
      .join('');
    select.innerHTML = options;
    
    // Handle locale matching (e.g. en-US -> en)
    const currentLang = (this.instance && this.instance.language) ? this.instance.language : i18nConfig.defaultLocale;
    
    // Set value explicitly
    if (i18nConfig.supportedLocales.includes(currentLang)) {
      select.value = currentLang;
    } else {
      const shortLang = currentLang.split('-')[0];
      if (i18nConfig.supportedLocales.includes(shortLang)) {
        select.value = shortLang;
      } else {
        select.value = i18nConfig.defaultLocale;
      }
    }
    
    console.log('[i18n] Language selector current value:', select.value);
    console.log('[i18n] Language selector has', select.options.length, 'options');
    console.log('[i18n] i18next instance exists:', !!this.instance);
    
    // Use onchange for direct binding and to avoid listener accumulation
    select.onchange = (e) => {
        console.log('[i18n] Language dropdown changed! New value:', e.target.value);
        this.changeLanguage(e.target.value);
    };
    
    // Also add a click listener to verify the element is clickable
    select.onclick = () => {
      console.log('[i18n] Language dropdown clicked!');
    };
    
    console.log('[i18n] Language selector initialized successfully');
  }

  async changeLanguage(locale) {
    console.log(`[i18n] changeLanguage called with locale: ${locale}`);
    
    if (!i18nConfig.supportedLocales.includes(locale)) {
      console.warn(`[i18n] Unsupported locale: ${locale}`);
      return;
    }

    // Safety check: if initialization failed, we can't change language
    if (!this.instance) {
      console.error('[i18n] Cannot change language: i18next instance not initialized');
      console.error('[i18n] Attempting to re-initialize...');
      
      // Attempt to re-initialize
      try {
        await this.init();
        if (!this.instance) {
          alert("语言系统未初始化。请刷新页面。\nLanguage system not initialized. Please refresh the page.");
          return;
        }
      } catch (e) {
        console.error('[i18n] Re-initialization failed', e);
        alert("语言系统初始化失败。请刷新页面。\nLanguage system failed to initialize. Please refresh the page.");
        return;
      }
    }

    console.log(`[i18n] Changing language to: ${locale}`);

    // Load if missing
    if (!this.loadedLocales.has(locale)) {
      console.log(`[i18n] Loading translations for ${locale}...`);
      try {
        const data = await this.loader.load(locale);
        this.instance.addResourceBundle(locale, 'translation', data, true, true);
        this.loadedLocales.add(locale);
        console.log(`[i18n] Successfully loaded translations for ${locale}`);
      } catch (e) {
        console.error(`[i18n] Failed to load translations for ${locale}`, e);
        // Continue anyway - will use fallback language
        console.warn(`[i18n] Continuing with fallback language`);
      }
    }

    await this.instance.changeLanguage(locale);
    localStorage.setItem('locale', locale);
    
    console.log(`[i18n] Language changed successfully to: ${locale}`);
    
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

// Expose to window IMMEDIATELY (before init) so it's always available
window.i18nManager = i18nManager;

// Ensure DOM is ready before init to find UI elements
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => i18nManager.init());
} else {
  i18nManager.init();
}

// Export for debugging if needed
export default i18nManager;
