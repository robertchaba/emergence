import { initTheme } from './theme.js';
import { initLocale } from './locale.js';
import { initWorldUI } from './world-ui.js';

initLocale();
initTheme();
if (document.querySelector('#world-form')) initWorldUI();
