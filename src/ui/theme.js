import { t } from './locale.js';

const storageKey = 'emergence.theme';

export function initTheme() {
  const root = document.documentElement;
  const switcher = document.querySelector('.theme-switcher');
  const picker = document.querySelector('.theme-picker');
  const trigger = picker.querySelector('summary');
  const system = window.matchMedia('(prefers-color-scheme: dark)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let preference = 'system';
  let transition = null;
  let coolingDown = false;

  function finishTransition() {
    transition?.remove();
    transition = null;
  }

  function flicker() {
    finishTransition();
    if (reducedMotion.matches || document.hidden || coolingDown) return;
    // Two low-contrast power dips and a localized phosphor afterglow. Changing
    // the palette only once also keeps the atlas redraw independent of flicker.
    transition = document.createElement('div');
    transition.className = 'theme-transition';
    transition.setAttribute('aria-hidden', 'true');
    transition.addEventListener('animationend', finishTransition, { once: true });
    document.body.append(transition);
    // Rapid choices take effect immediately without repeatedly flashing.
    coolingDown = true;
    window.setTimeout(() => { coolingDown = false; }, 1000);
  }

  try {
    const saved = window.localStorage.getItem(storageKey);
    if (saved === 'light' || saved === 'dark') preference = saved;
  } catch {
    // Storage can be unavailable; the control still works for this page visit.
  }

  function applyTheme(animate = false) {
    const next = preference === 'system'
      ? (system.matches ? 'dark' : 'light')
      : preference;
    const changed = root.dataset.theme !== next;
    if (changed) {
      root.dataset.theme = next;
      if (animate === true) flicker();
    }
    switcher.querySelector(`input[value="${preference}"]`).checked = true;
    picker.dataset.preference = preference;
    const label = t('themeChoice', { theme: t(preference) });
    trigger.setAttribute('aria-label', label);
    trigger.title = label;
  }

  switcher.addEventListener('change', (event) => {
    preference = event.target.value;
    applyTheme(true);

    try {
      if (preference === 'system') window.localStorage.removeItem(storageKey);
      else window.localStorage.setItem(storageKey, preference);
    } catch {
      // Persistence is optional; applying an explicit theme is not.
    }
  });

  system.addEventListener('change', () => {
    if (preference === 'system') applyTheme(true);
  });

  reducedMotion.addEventListener('change', () => {
    if (reducedMotion.matches) finishTransition();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) finishTransition();
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
