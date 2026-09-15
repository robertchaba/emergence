const storageKey = 'emergence.theme';

export function initTheme() {
  const root = document.documentElement;
  const switcher = document.querySelector('.theme-switcher');
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

  applyTheme();
  switcher.hidden = false;
}
