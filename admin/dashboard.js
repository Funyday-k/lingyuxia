(async function () {
  'use strict';
  const status = document.getElementById('connection-status');
  try {
    const response = await fetch('./settings.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('Settings unavailable');
    const settings = await response.json();
    const authReady = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(settings.netlify_site_id || '');
    const statsReady = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(settings.goatcounter_code || '');
    status.textContent = authReady ? '登录配置已填写 · 请进入编辑器验证登录' : '首次使用 · 请先连接登录服务';
    document.getElementById('auth-state').textContent = authReady ? '已填写，待登录验证' : '待配置';
    document.getElementById('analytics-state').textContent = statsReady ? '已填写，隐私设置需在服务端确认' : '待配置';
    if (!authReady) {
      document.querySelectorAll('.editor-link').forEach(function (link) {
        link.href = '#auth-help';
        link.addEventListener('click', function () { document.getElementById('auth-help').open = true; });
      });
    }
    if (statsReady) {
      const link = document.getElementById('analytics-link');
      link.href = 'https://' + settings.goatcounter_code + '.goatcounter.com/';
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = '登录统计面板 ↗';
    }
  } catch (error) {
    status.textContent = '无法读取连接配置，请刷新重试。';
  }
}());
