import { t } from './locale.js';

/** A candidate worker validates the upload before the current run is replaced. */
export function createRestoreDialog({ onOpen, onRestore, prepareRestore }) {
  const dialog = document.createElement('dialog');
  dialog.id = 'restore-dialog';
  dialog.className = 'restore-dialog';
  dialog.setAttribute('aria-labelledby', 'restore-title');
  dialog.innerHTML = `
    <form>
      <h2 id="restore-title" data-i18n="restoreState"></h2>
      <p class="field-note" data-i18n="restoreHelp"></p>
      <label for="restore-file" data-i18n="saveFile"></label>
      <input id="restore-file" type="file" accept=".json,application/json" required autofocus />
      <p id="restore-status" class="field-note" role="status"></p>
      <div class="restore-actions">
        <button class="action-button" type="button" data-i18n="cancel"></button>
        <button class="action-button primary" type="submit" data-i18n="restoreState"></button>
      </div>
    </form>`;
  const input = dialog.querySelector('input');
  const submit = dialog.querySelector('[type="submit"]');
  const status = dialog.querySelector('[role="status"]');
  let candidate = null;
  let statusKey = '';
  let returnFocus = null;
  function translate() {
    dialog.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
    status.textContent = statusKey ? t(statusKey) : '';
  }
  function setBusy(busy, key = '') {
    input.disabled = busy;
    submit.disabled = busy;
    dialog.querySelector('form').setAttribute('aria-busy', String(busy));
    statusKey = key;
    translate();
  }
  function cancel() {
    candidate?.terminate();
    candidate = null;
    setBusy(false);
  }
  dialog.addEventListener('close', () => {
    cancel();
    if (dialog.returnValue !== 'restored') returnFocus?.focus({ preventScroll: true });
  });
  dialog.addEventListener('cancel', cancel);
  dialog.querySelector('[type="button"]').addEventListener('click', () => dialog.close());
  input.addEventListener('change', () => setBusy(false));
  dialog.querySelector('form').addEventListener('submit', event => {
    event.preventDefault();
    const file = input.files[0];
    if (!file || candidate) return;
    setBusy(true, 'restoringState');
    function fail(key = 'restoreFailed') {
      cancel();
      setBusy(false, key);
      input.focus();
    }
    try {
      candidate = new Worker(new URL('./life-worker.js', import.meta.url), { type: 'module' });
      const worker = candidate;
      worker.onmessage = async ({ data }) => {
        if (candidate !== worker) return;
        if (data.error) { fail(); return; }
        let prepared;
        try { prepared = await prepareRestore?.(); }
        catch { if (candidate === worker) fail('restoreUnavailable'); return; }
        if (candidate !== worker) return;
        candidate = null;
        dialog.close('restored');
        onRestore(worker, data, prepared);
      };
      worker.onerror = () => { if (candidate === worker) fail(); };
      worker.postMessage({ command: 'restore', file });
    } catch { fail(); }
  });
  document.body.append(dialog);
  document.addEventListener('emergence:localechange', translate);
  translate();
  return {
    get open() { return dialog.open; },
    destroy() {
      cancel();
      document.removeEventListener('emergence:localechange', translate);
      dialog.remove();
    },
    show() {
      const opener = document.activeElement;
      returnFocus = opener.closest('#application-menu')?.querySelector('summary')
        ?? (opener === document.body ? document.querySelector('#restore-setup') : opener);
      onOpen();
      input.value = '';
      dialog.returnValue = '';
      setBusy(false);
      dialog.showModal();
    },
  };
}

export function downloadSave(json, day) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `emergence-day-${day}.json`;
  document.body.append(link);
  try { link.click(); } finally {
    link.remove();
    // Give the browser time to take ownership of the download before cleanup.
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}
