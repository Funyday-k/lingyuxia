(async function () {
  'use strict';
  const byId = id => document.getElementById(id);
  const sections = {
    about: ['About me / 管理概览', '从上方选择栏目，在这里管理主页内容。', '/', null],
    'about-edit': ['About me', '编辑个人介绍与联系方式。', '/', 'pages/entries/about'],
    research: ['Research', '编辑研究方向与项目介绍。', '/research/', 'pages/entries/research'],
    publications: ['Publications', '个人论文与页面内容分别管理；原有占位图片可在页面内容中修改。', '/publications/', 'publications'],
    'publications-page': ['Publications · 页面内容', '编辑页面介绍与原有占位图片。', '/publications/', 'pages/entries/publications_page'],
    daily: ['Daily Paper', '按日期展开已有论文，编辑标题、作者、摘要与点评。', '/daily-paper/', 'daily_papers/entries/papers'],
    notes: ['Note', '管理笔记正文与附件。互动专题的标题、简介和入口可单独编辑。', '/note/', 'notes'],
    'note-collections': ['Note · 互动专题', '编辑专题目录；实验页面中的程序保留原样。', '/note/', 'note_collections/entries/explore'],
    cv: ['CV', '编辑简历与教育经历。', '/cv/', 'pages/entries/cv'],
    gallery: ['Gallery', '编辑已有相册，或新建相册并上传照片。', '/portfolio/', 'gallery'],
    'gallery-page': ['Gallery · 页面内容', '编辑相册列表页面的标题和介绍。', '/portfolio/', 'pages/entries/gallery_page'],
    visitors: ['访问统计', '私人访问面板，与内容编辑共用这个管理入口。', null, null],
    settings: ['网站设置', '管理网站标题、侧栏信息与服务连接。', '/', 'settings']
  };
  const groups = { 'about-edit':'about', 'publications-page':'publications', 'note-collections':'notes', 'gallery-page':'gallery' };
  const actions = {
    publications: [['论文条目','publications'],['页面内容与图片','publications-page']],
    notes: [['笔记','notes'],['互动专题目录','note-collections']],
    gallery: [['相册','gallery'],['列表页面','gallery-page']]
  };
  const base = new URL('../', location.href);
  let authReady = false, statsURL = '', active = 'about', editorRoute = '', dirty = false;
  const editor = byId('editor-frame');
  window.addEventListener('message', function (event) {
    if (event.origin === location.origin && event.source === editor.contentWindow && event.data?.type === 'site-editor-dirty') dirty = event.data.dirty === true;
  });
  window.addEventListener('beforeunload', function (event) { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
  function showSection() {
    const key = Object.hasOwn(sections, location.hash.slice(1)) ? location.hash.slice(1) : 'about';
    const [title, description, publicPath, route] = sections[key];
    if (route && route !== editorRoute && dirty && !window.confirm('编辑器中有未保存的修改。切换栏目会丢失这些修改，仍然继续吗？')) {
      history.replaceState(null, '', '#' + active); return;
    }
    active = key;
    const group = groups[key] || key;
    document.querySelectorAll('[data-section]').forEach(link => {
      if (link.dataset.section === group) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    });
    byId('section-title').textContent = title;
    byId('section-description').textContent = description;
    byId('view-public').hidden = !publicPath;
    if (publicPath) byId('view-public').href = new URL(publicPath.replace(/^\//,''), base).href;
    byId('overview-panel').hidden = key !== 'about';
    byId('editor-panel').hidden = !route || !authReady;
    byId('visitors-panel').hidden = key !== 'visitors';
    byId('workspace').classList.toggle('editing', Boolean(route && authReady));
    const links = byId('section-actions'); links.replaceChildren();
    for (const [label, target] of actions[group] || []) {
      const link = document.createElement('a'); link.textContent = label; link.href = '#' + target;
      if (target === key) link.setAttribute('aria-current','page'); links.appendChild(link);
    }
    links.hidden = !links.children.length;
    if (route && authReady && route !== editorRoute) {
      editor.src = './editor.html?section=' + encodeURIComponent(key) + '#/collections/' + route;
      editorRoute = route; dirty = false;
    }
    if (key === 'visitors' && statsURL && !byId('stats-frame').getAttribute('src')) byId('stats-frame').src = statsURL;
    byId('connection-status').textContent = route && !authReady ? '登录服务尚未配置，请返回管理概览查看首次连接说明。' : key === 'visitors' && !statsURL ? '访问统计尚未配置。' : '';
    byId('connection-status').hidden = !byId('connection-status').textContent;
  }
  try {
    const response = await fetch('./settings.json', {cache:'no-store'});
    if (!response.ok) throw new Error('Settings unavailable');
    const settings = await response.json();
    authReady = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(settings.netlify_site_id || '');
    if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(settings.goatcounter_code || '')) statsURL = 'https://' + settings.goatcounter_code + '.goatcounter.com/';
    byId('auth-state').textContent = authReady ? '已配置' : '待配置';
    byId('analytics-state').textContent = statsURL ? '已配置 · 仅登录用户可见' : '待配置';
    if (statsURL) byId('analytics-login').href = statsURL;
    byId('refresh-stats').addEventListener('click', () => { if (statsURL) byId('stats-frame').src = statsURL; });
    window.addEventListener('hashchange', showSection); showSection();
  } catch (error) {
    byId('connection-status').textContent = '连接配置读取失败，请刷新重试。';
  }
}());
