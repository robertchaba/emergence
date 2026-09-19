import { initTheme } from './theme.js';
import { initLocale } from './locale.js';
import { initWorldUI } from './world-ui.js';
import { initAbout } from './about.js';
import { initAnalytics } from './analytics.js';
import { initLandingRestore } from './landing-restore.js';

initAnalytics();
initLocale();
initTheme();
initAbout();
if (document.querySelector('#world-form')) initWorldUI();
else if (document.querySelector('#restore-landing')) initLandingRestore();
