import { t } from './locale.js';

const storageKey = 'emergence.theme';

export function initTheme() {
  const root = document.documentElement;
  const switcher = document.querySelector('.theme-switcher');
  const picker = document.querySelector('.theme-picker');
  const trigger = picker.querySelector('summary');
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  let preference = 'system';

  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {
    // Storage can be unavailable; the control still works for this page visit.
  }

  function applyTheme() {
    root.dataset.theme = preference === 'system'
      ? (system.matches ? 'dark' : 'light')
      : preference;
    switcher.querySelector(`input[value="${preference}"]`).checked = true;
    picker.dataset.preference = preference;
    const label = t('themeChoice', { theme: t(preference) });
    trigger.setAttribute('aria-label', label);
    trigger.title = label;
  }

  switcher.addEventListener('change', (event) => {
    preference = event.target.value;
    applyTheme();

    try {
      if (preference === 'system') window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, preference);
    } catch {
      // Persistence is optional; applying an explicit theme is not.
    }
  });

  system.addEventListener('change', () => {
    if (preference === 'system') applyTheme();
  });

  document.addEventListener('emergence:localechange', applyTheme);
  picker.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { picker.open = false; trigger.focus(); }
  });
  document.addEventListener('pointerdown', (event) => {
    if (!picker.contains(event.target)) picker.open = false;
  });
  picker.addEventListener('focusout', (event) => {
    if (!picker.contains(event.relatedTarget)) picker.open = false;
  });

  applyTheme();
  picker.hidden = false;
}
