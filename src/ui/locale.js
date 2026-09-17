import { messages } from './messages.js';

let locale = 'en';
let formats;
const storageKey = 'emergence.locale';

export function t(key, values = {}) {
  return messages[locale][key].replace(/\{(\w+)\}/g, (_, name) => String(values[name]));
}

export function formatNumber(value, kind = 'number') {
  return formats[kind].format(value);
}

export function initLocale() {
  try {
    if (window.localStorage.getItem(storageKey) === 'pl') locale = 'pl';
  } catch {
    // Language selection remains available when persistence is blocked.
  }

  function apply() {
    document.documentElement.lang = locale;
    formats = {
      number: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
      integer: new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }),
      compact: new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 0 }),
      percent: new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }),
    };
    for (const element of document.querySelectorAll('[data-i18n]')) {
      element.textContent = t(element.dataset.i18n);
    }
    for (const attribute of ['aria-label', 'title', 'alt', 'content']) {
      for (const element of document.querySelectorAll(`[data-i18n-${attribute}]`)) {
        element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
      }
    }
    for (const button of document.querySelectorAll('[data-locale]')) {
      button.disabled = false;
      button.setAttribute('aria-pressed', String(button.dataset.locale === locale));
    }
    document.dispatchEvent(new Event('emergence:localechange'));
  }

  document.querySelector('.language-switcher').addEventListener('click', (event) => {
    const button = event.target.closest('[data-locale]');
    if (!button || button.dataset.locale === locale) return;
    locale = button.dataset.locale;
    apply();
    try { window.localStorage.setItem(storageKey, locale); } catch { /* Optional persistence. */ }
  });
  apply();
}
