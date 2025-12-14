(function () {
  const supportedLocales = [
    'en', 'zh-CN', 'es', 'fr', 'ja', 'ko', 'ar', 'pt', 'hi'
  ];
  const localeLabels = {
    en: 'English',
    'zh-CN': '中文',
    es: 'Español',
    fr: 'Français',
    ja: '日本語',
    ko: '한국어',
    ar: 'العربية',
    pt: 'Português',
    hi: 'हिन्दी'
  };
  const storedLocale = localStorage.getItem('locale') || 'en';
  const loadedLocales = new Set();

  const i18n = window.i18next || (window.i18next = window.i18next || null);
  if (!i18n) {
    console.error('i18next not found - translations will not work');
    return;
  }

  const instance = i18n.createInstance();
  window.i18n = instance;

  function translateElement(el) {
    const key = el.dataset.i18n;
    if (!key) return;
    const translation = instance.t(key);
    if (!translation) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      el.placeholder = translation;
      return;
    }
    if (el.tagName === 'OPTION') {
      el.textContent = translation;
      return;
    }
    el.textContent = translation;
  }

  function translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(translateElement);
  }

  function highlightNav() {
    const current = window.location.pathname.split('/').pop();
    document.querySelectorAll('.navlinks a').forEach((link) => {
      link.classList.toggle('active', current && link.getAttribute('href') === current);
    });
  }

  function initLangSelect() {
    const select = document.getElementById('langSelect');
    if (!select) return;
    select.innerHTML = supportedLocales
      .map((code) => `<option value="${code}">${localeLabels[code] || code}</option>`)
      .join('');
    select.value = instance.language || storedLocale;
    select.addEventListener('change', (event) => {
      changeLanguage(event.target.value);
    });
  }

  async function changeLanguage(locale) {
    if (!supportedLocales.includes(locale)) {
      locale = 'en';
    }
    if (!loadedLocales.has(locale)) {
      try {
        const response = await fetch(`locales/${locale}.json`);
        const data = await response.json();
        instance.addResourceBundle(locale, 'translation', data, true, true);
        loadedLocales.add(locale);
      } catch (error) {
        console.error('Unable to load locale', locale, error);
        return;
      }
    }
    await instance.changeLanguage(locale);
    localStorage.setItem('locale', locale);
    translatePage();
    highlightNav();
    const langSelect = document.getElementById('langSelect');
    if (langSelect) {
      langSelect.value = locale;
    }
  }

  instance
    .init({
      lng: storedLocale,
      fallbackLng: 'en',
      debug: false,
      interpolation: {
        escapeValue: false
      }
    })
    .then(() => {
      initLangSelect();
      changeLanguage(instance.language || storedLocale);
      instance.on('languageChanged', translatePage);
    });

  document.addEventListener('DOMContentLoaded', () => {
    translatePage();
    highlightNav();
  });
})();
