// Google tag is enabled only for the public GitHub Pages deployment.
export function initAnalytics() {
  if (window.location.origin !== 'https://robertchaba.github.io'
    || !window.location.pathname.startsWith('/emergence/')) return;

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag('js', new Date());
  window.gtag('config', 'G-YWYZTQZ4V3');

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://www.googletagmanager.com/gtag/js?id=G-YWYZTQZ4V3';
  document.head.append(script);
}
