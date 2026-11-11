(async function () {
  'use strict';
  const status = document.getElementById('editor-status');
  try {
    const response = await fetch('./settings.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Settings unavailable');
    const settings = await response.json();
    if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(settings.netlify_site_id || '')) {
      status.textContent = '登录服务尚未连接。请返回管理首页，完成“首次连接”中的设置。';
      return;
    }
    window.CMS_MANUAL_INIT = true;
    status.textContent = '正在加载编辑器…';
    await new Promise(function (resolve, reject) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/decap-cms@3.17.3/dist/decap-cms.js';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
    window.registerSiteListFormat(window.CMS, window.jsyaml);
    window.CMS.init({ config: { backend: { site_domain: settings.netlify_site_id } } });
    document.getElementById('editor-notice').hidden = true;
  } catch (error) {
    status.textContent = '编辑器加载失败。请检查网络及连接配置，然后重试。';
    document.getElementById('retry').hidden = false;
  }
}());

// Inform the same-origin management shell before it replaces this editor.
if (window.parent !== window) {
  let lastDirty = false;
  new MutationObserver(function () {
    const text = document.body.innerText;
    const dirty = text.includes('含未保存的修改') || text.includes('Unsaved Changes');
    if (dirty !== lastDirty) {
      lastDirty = dirty;
      window.parent.postMessage({ type: 'site-editor-dirty', dirty: dirty }, window.location.origin);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
