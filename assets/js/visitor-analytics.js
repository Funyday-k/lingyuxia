(function () {
  'use strict';
  const loader = document.currentScript;
  const code = loader && loader.getAttribute('data-goatcounter-code');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(code || '')) return;
  if (window.location.hostname !== 'funyday-k.github.io') return;
  if (/^\/lingyuxia\/admin(?:\/|$)/.test(window.location.pathname)) return;
  // Do not collect query parameters or hash fragments.
  window.goatcounter = { path: window.location.pathname };
  const script = document.createElement('script');
  script.src = 'https://gc.zgo.at/count.js';
  script.async = true;
  script.dataset.goatcounter = 'https://' + code + '.goatcounter.com/count';
  document.head.appendChild(script);
}());
