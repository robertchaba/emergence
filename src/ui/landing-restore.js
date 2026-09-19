import { createRestoreDialog } from './save-dialog.js';
import { initWorldUI } from './world-ui.js';
import { translateContent } from './locale.js';

export function initLandingRestore() {
  const button = document.querySelector('#restore-landing');
  const dialog = createRestoreDialog({
    onOpen() {},
    async prepareRestore() {
      // Reuse the shipped workspace markup only after the file validates.
      // Keep the landing page intact if loading fails or the visitor cancels.
      const response = await fetch('./world.html');
      if (!response.ok) throw new Error('Workspace unavailable.');
      const template = new DOMParser().parseFromString(await response.text(), 'text/html');
      const setup = template.querySelector('#world-setup');
      const workspace = template.querySelector('#workspace');
      if (!setup || !workspace) throw new Error('Workspace unavailable.');
      return { setup: document.importNode(setup, true), workspace: document.importNode(workspace, true) };
    },
    onRestore(worker, data, { setup, workspace }) {
      dialog.destroy();
      document.querySelector('#main').replaceChildren(setup);
      document.body.append(workspace);
      document.querySelector('.page-preferences').classList.remove('landing-preferences');
      document.querySelector('title').dataset.i18n = 'setupTitle';
      translateContent();
      initWorldUI({ worker, data });
    },
  });
  button.addEventListener('click', () => dialog.show());
  button.disabled = false;
}
