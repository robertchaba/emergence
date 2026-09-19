import { initTheme } from './theme.js';
import { initLocale } from './locale.js';
import { initWorldUI } from './world-ui.js';
import { initAbout } from './about.js';

initLocale();
initTheme();
initAbout();
if (document.querySelector('#world-form')) initWorldUI();
