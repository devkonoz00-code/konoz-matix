/**
 * i18n Engine for MATIX
 * Supports Arabic (RTL), French (LTR), and English (LTR)
 */
class I18n {
  constructor() {
    this.currentLocale = localStorage.getItem('matix_lang') || 'en';
    this.translations = {};
    this.loaded = false;
  }

  async init() {
    await this.setLanguage(this.currentLocale);
  }

  async setLanguage(lang) {
    try {
      const response = await fetch(`./js/locales/${lang}.json`);
      if (!response.ok) throw new Error(`Could not load ${lang}.json`);
      this.translations = await response.json();
      this.currentLocale = lang;
      localStorage.setItem('matix_lang', lang);

      // Update HTML attributes for RTL/LTR
      const isRtl = lang === 'ar';
      document.documentElement.setAttribute('lang', lang);
      document.documentElement.setAttribute('dir', isRtl ? 'rtl' : 'ltr');
      if (isRtl) {
        document.body.classList.add('rtl');
      } else {
        document.body.classList.remove('rtl');
      }

      this.translateDOM();
      window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang, isRtl } }));
    } catch (err) {
      console.error('Failed to set language:', err);
    }
  }

  t(key, fallback = '') {
    return this.translations[key] || fallback || key;
  }

  translateDOM(container = document) {
    const elements = container.querySelectorAll('[data-i18n]');
    elements.forEach((el) => {
      const key = el.getAttribute('data-i18n');
      const translation = this.t(key);
      if (translation) {
        if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          if (el.hasAttribute('placeholder')) {
            el.setAttribute('placeholder', translation);
          } else {
            el.value = translation;
          }
        } else {
          el.textContent = translation;
        }
      }
    });

    const titleElements = container.querySelectorAll('[data-i18n-title]');
    titleElements.forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      const translation = this.t(key);
      if (translation) el.setAttribute('title', translation);
    });
  }
}

export const i18n = new I18n();
