const moduleVersion = new URL(import.meta.url).search;
const [{ GitHubClient }, { login, logout, getToken }, { createContentModel }, { renderMarkdownPreview }, { fetchPaperMetadata, identifyPaperLink }] = await Promise.all([
  import('./github-api.js' + moduleVersion), import('./auth.js' + moduleVersion), import('./content-model.js' + moduleVersion),
  import('./markdown-preview.js' + moduleVersion), import('./paper-metadata.js' + moduleVersion)
]);

const model = createContentModel(window.jsyaml);
const $ = id => document.getElementById(id);
const siteBase = new URL('../', location.href);
const sections = {
  overview: ['管理概览', '一个入口，管理你的主页内容。'],
  about: ['Home / 首页', '编辑个人介绍、教育经历、联系方式与侧栏资料。'],
  research: ['Research', '编辑研究方向与项目介绍。'],
  publications: ['Publications', '管理个人论文、PDF 附件和页面介绍。'],
  daily: ['Daily Paper', '找到论文，直接编辑。所有修改一起保存为草稿。'],
  notes: ['Note', '撰写笔记、上传附件与管理互动专题入口。'],
  cv: ['CV', '编辑教育经历与个人简历。'],
  gallery: ['Gallery', '查看相册照片，编辑说明并上传新图片。'],
  visitors: ['访问统计', '访问量、热门页面与来源，仅登录后可见。'],
  settings: ['网站设置', '编辑主页信息与已连接的服务。']
};
let client, settings, config, ref, draft = null, files = [], busy = false, routeVersion = 0;
let docs = new Map(), uploads = new Map(), deleted = new Set(), savedAssets = new Map(), selected = '', query = '', dateFilter = '', mode = '';
const section = () => Object.hasOwn(sections, location.hash.slice(1)) ? location.hash.slice(1) : 'about';
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (key === 'className') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'value') node.value = value ?? '';
    else if (key === 'hidden') node.hidden = Boolean(value);
    else if (value !== undefined && value !== null) node.setAttribute(key, value);
  }
  for (const child of children.flat()) if (child !== undefined && child !== null) node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  return node;
}
function message(text = '', error = false) { $('message').textContent = text; $('message').hidden = !text; $('message').classList.toggle('error', error); }
function changes() { return [...docs.values()].filter(doc => !deleted.has(doc.path) && model.serialize(doc) !== doc.originalText); }
function isDirty() { return changes().length > 0 || uploads.size > 0 || deleted.size > 0; }
function updateStatus() {
  const dirty = isDirty();
  $('save-state').textContent = dirty ? `有未保存修改 · ${changes().length + deleted.size} 个内容文件${uploads.size ? ` · ${uploads.size} 个附件` : ''}` : draft ? '草稿已保存，尚未发布' : '正在编辑已发布内容';
  $('save-button').disabled = busy || !dirty;
  $('publish-button').disabled = busy || dirty || !draft || draft.legacy;
  $('draft-link').hidden = !draft; if (draft) $('draft-link').href = draft.url;
  $('drafts-button').disabled = busy; $('refresh-button').disabled = busy; $('auth-button').disabled = busy;
}
async function run(action) {
  if (busy) return;
  busy = true; $('content').inert = true; $('dialog-content').inert = true; document.querySelector('.site-nav').inert = true; $('content').classList.add('busy'); updateStatus();
  try { await action(); } catch (error) { message(error.message || '操作失败，请重试。', true); if (error.url && safeURL(error.url)) $('message').append(el('a', {href:error.url, target:'_blank', rel:'noopener', text:' 在 GitHub 检查保存结果 ↗'})); }
  finally { busy = false; $('content').inert = false; $('dialog-content').inert = false; document.querySelector('.site-nav').inert = false; $('content').classList.remove('busy'); updateStatus(); }
}
async function read(path) {
  const cache = docs, currentClient = client, currentRef = ref;
  if (!cache.has(path)) {
    const file = await currentClient.readFile(path, currentRef);
    if (!cache.has(path)) cache.set(path, model.parse(path, file.content));
  }
  return cache.get(path);
}
async function loadContext(nextDraft = null) {
  const nextRef = nextDraft ? nextDraft.headSha : await client.head();
  const nextFiles = await client.listFiles('', nextRef);
  draft = nextDraft; ref = nextRef; files = nextFiles; docs = new Map(); deleted = new Set(); clearUploads(); selected = ''; query = ''; dateFilter = '';
  await render(); updateStatus();
}
function clearUploads() { for (const item of [...uploads.values(), ...savedAssets.values()]) if (item.url) URL.revokeObjectURL(item.url); uploads.clear(); savedAssets.clear(); }
function localDate() { const now = new Date(); return [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-'); }
function safeURL(value) {
  try { const url = new URL(value, siteBase); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}
function assetURL(value) {
  const url = safeURL(value); if (!url) return '';
  const match = [...uploads.values(), ...savedAssets.values()].find(item => new URL(item.publicURL, siteBase).href === url);
  if (match) return match.url;
  const parsed = new URL(url);
  if (draft && ref && parsed.origin === siteBase.origin && parsed.pathname.startsWith(siteBase.pathname)) {
    const path = parsed.pathname.slice(siteBase.pathname.length);
    return `https://raw.githubusercontent.com/${config.backend.repo}/${ref}/${path}`;
  }
  if (ref && parsed.origin === siteBase.origin) { parsed.searchParams.set('v',ref); return parsed.href; }
  return url;
}
function getValue(doc, path) { return path === 'body' ? doc.body : path.split('.').reduce((v, key) => v?.[key], doc.data); }
function setValue(doc, path, value) {
  if (path === 'body') doc.body = value;
  else { const keys = path.split('.'); let obj = doc.data; for (const key of keys.slice(0, -1)) { if (!obj[key] || typeof obj[key] !== 'object') obj[key] = {}; obj = obj[key]; } obj[keys.at(-1)] = value; }
  updateStatus();
}
function inputField(label, value, onChange, opts = {}) {
  const id = 'f-' + Math.random().toString(36).slice(2);
  const input = el(opts.multiline ? 'textarea' : 'input', { id, 'aria-label':label, value: value ?? '', type: opts.type || 'text', rows: opts.rows, placeholder: opts.placeholder || '', onInput: e => onChange(e.target.value) });
  const wrap = el('label', { className: 'field ' + (opts.className || ''), for: id }, el('span', { className: 'field-label', text: label }), input);
  if (opts.hint) wrap.append(el('span', { className: 'field-hint', text: opts.hint }));
  return wrap;
}
function previewText(text) {
  const output = el('div', { className: 'preview markdown-preview' });
  renderMarkdownPreview(output, text || '', { resolveAsset: assetURL, baseURL: siteBase });
  return output;
}
function focusButton() {
  return el('button', {text:'收起列表', className:'focus-editor-button', onClick:event => {
    const grid = event.target.closest('.workspace-grid');
    if (!grid) return;
    const focused = grid.classList.toggle('focus-editor');
    event.target.textContent = focused ? '显示列表' : '收起列表';
  }});
}

function topActions(label, actions = []) {
  return el('div', { className: 'editor-top' }, el('span', { className: 'eyebrow', text: label }), el('div', { className: 'editor-top-actions' }, el('button', { className: 'mobile-back', text: '← 返回列表', onClick: () => { document.querySelector('.workspace-grid')?.classList.remove('has-selection'); } }), ...actions));
}
function showDialog(...children) { $('dialog-content').replaceChildren(...children); if (!$('dialog').open) $('dialog').showModal(); }
function checkLeave() { return !isDirty() || window.confirm('有尚未保存的内容和附件。放弃这些修改吗？'); }
function collection(name) { return config.collections.find(item => item.name === name); }
function tabs(options, current, onPick) { return el('div', { className: 'tabs' }, ...options.map(([key, label]) => el('button', { text: label, 'aria-pressed': key === current, onClick: () => { mode = key; selected = ''; query = ''; onPick(); } }))); }

function paperImportDialog({ initialLink = '', existing = false, apply }) {
  const cache = docs;
  let timer, controller, request = 0, result = null;
  const input = el('input', {type:'text','aria-label':'粘贴论文链接',placeholder:'粘贴 arXiv 链接或 DOI',value:initialLink});
  const status = el('p',{className:'import-status',role:'status',text:'粘贴链接后自动读取，也可点击“读取信息”。'});
  const details = el('div',{className:'import-result'});
  const overwrite = el('input',{type:'checkbox'});
  const applyButton = el('button',{className:'primary',text:existing ? '填入编辑器' : '加入论文列表',disabled:'disabled',onClick:()=>{
    if (!result || cache !== docs) return;
    apply(result, overwrite.checked);
    $('dialog').close(); updateStatus();
    message('论文信息已填入编辑器，请核对后保存草稿。摘要来自公开记录，没有自动生成点评。');
  }});
  async function retrieve() {
    clearTimeout(timer); controller?.abort(); const id = ++request; result = null; applyButton.disabled = true; details.replaceChildren();
    try { identifyPaperLink(input.value); } catch(error) { status.textContent = error.message; return; }
    controller = new AbortController(); status.textContent = '正在读取论文信息…';
    try {
      const metadata = await fetchPaperMetadata(input.value,{signal:controller.signal});
      if (id !== request || !$('dialog').open || cache !== docs) return;
      result = metadata; applyButton.disabled = false;
      status.textContent = '已读取，请核对后填入。';
      details.replaceChildren(el('h3',{text:metadata.title || '未返回标题'}),el('p',{className:'count import-authors',text:metadata.authors || '来源未提供作者'}),el('p',{className:'import-abstract',text:metadata.abstract || '来源未提供摘要，可稍后手动填写。'}),el('a',{href:safeURL(metadata.sourceURL || metadata.link),target:'_blank',rel:'noopener',text:'信息来源：'+metadata.source+' ↗'}));
      if(metadata.date) details.append(el('p',{className:'field-hint',text:'来源记录日期：'+metadata.date}));
      if (metadata.metadataVersion === 'record') details.append(el('p',{className:'field-hint',text:'按 arXiv 公开记录读取；若链接指定了 v1、v2 等版本，请核对摘要是否与该版本一致。'}));
    } catch(error) { if(id === request && $('dialog').open) status.textContent = error.name === 'AbortError' ? '读取已取消。' : error.message; }
  }
  input.addEventListener('input',()=>{
    clearTimeout(timer); controller?.abort(); request++; result=null; applyButton.disabled=true; details.replaceChildren();
    status.textContent = '粘贴 arXiv 或 DOI 链接后自动读取。';
    try { identifyPaperLink(input.value); timer=setTimeout(retrieve,650); } catch { /* Continue accepting input without fetching unsupported destinations. */ }
  });
  showDialog(el('h2',{text:existing ? '从论文链接读取' : '粘贴链接，添加论文'}),el('p',{className:'count',text:'支持 arXiv 摘要页、PDF 链接和 DOI。读取标题、作者、单位与摘要；缺少的信息保持空白。'}),el('div',{className:'import-input-row'},input,el('button',{text:'读取信息',onClick:retrieve})),status,details,
    ...(existing ? [el('label',{className:'overwrite-option'},overwrite,'替换已有标题、作者、单位和摘要等论文信息（默认只补全空字段）')] : []),applyButton);
  $('dialog').addEventListener('close',()=>{ clearTimeout(timer); controller?.abort(); request++; },{once:true});
  if(initialLink.trim()) retrieve(); else input.focus();
}
function fillMetadata(target,values,overwrite=false) {
  for(const [key,value] of Object.entries(values)) if(value != null && String(value).trim() && (overwrite || !String(target[key] || '').trim())) target[key]=value;
}
function handlePaperPaste(event, openImport) {
  const value=event.clipboardData?.getData('text/plain') || '';
  try { identifyPaperLink(value); } catch { return; }
  event.preventDefault(); openImport(value);
}
function importPublication(doc, initialLink = doc.data.arxiv_url || doc.data.doi_url || doc.data.paperurl || '') {
  paperImportDialog({initialLink,existing:true,apply:(metadata,overwrite)=>{
    fillMetadata(doc.data,{title:metadata.title,authors:metadata.authors,excerpt:metadata.abstract,venue:metadata.venue,arxiv_url:metadata.arxiv_url,doi_url:metadata.doi_url,paperurl:metadata.link},overwrite);
    if(overwrite || !doc.data.date || (doc.originalText === '' && doc.data.date === doc.initialDate)) {
      const fullDate = /^\d{4}-\d{2}-\d{2}$/.test(metadata.date || '') && !Number.isNaN(Date.parse(metadata.date+'T00:00:00Z')) && new Date(metadata.date+'T00:00:00Z').toISOString().slice(0,10) === metadata.date;
      if(fullDate) doc.data.date=metadata.date;
      else if(doc.originalText === '' && doc.data.date === doc.initialDate) doc.data.date='';
    }
    updateStatus(); render();
  }});
}

async function renderDaily() {
  const doc = await read('_data/daily_papers.yml');
  const list = el('div', { className: 'entries', role: 'list', 'aria-label': '论文列表' });
  const editor = el('section', { className: 'editor-pane', 'aria-label': '论文编辑' });
  const search = el('input', { type: 'search', placeholder: '搜索标题、作者或点评', 'aria-label': '搜索论文', value: query, onInput: e => { query = e.target.value; renderList(); } });
  const dates = el('select', { 'aria-label': '按日期筛选', onChange: e => { dateFilter = e.target.value; renderList(); } }, el('option', { value: '', text: '所有日期' }));
  const count = el('span', { className: 'count' });
  const importNew = el('button',{text:'从链接添加论文',className:'link-import-button',onClick:()=>paperImportDialog({apply:metadata=>{
    const pos=model.newDaily(doc,dateFilter || localDate());
    fillMetadata(doc.data[pos.dayIndex].papers[pos.paperIndex],{title:metadata.title,link:metadata.link,authors:metadata.authors,affiliations:metadata.affiliations,abstract:metadata.abstract});
    selected=`${pos.dayIndex}:${pos.paperIndex}`; query=''; search.value=''; refreshDates();renderList();renderEditor();grid.classList.add('has-selection');
  }})});
  const pane = el('aside', { className: 'list-pane' }, el('div', { className: 'list-tools' }, search, el('button', { text: '＋ 新增', onClick: () => {
    const day = dateFilter || localDate();
    const pos = model.newDaily(doc, day); selected = `${pos.dayIndex}:${pos.paperIndex}`; updateStatus(); refreshDates(); renderList(); renderEditor(); grid.classList.add('has-selection');
  } })),importNew, el('div', { className: 'filters' }, dates, count), list);
  const grid = el('div', { className: 'workspace-grid' }, pane, editor);
  function refreshDates() {
    dates.replaceChildren(el('option', { value: '', text: '所有日期' }), ...[...new Set(doc.data.map(day => day.date))].sort().reverse().map(date => el('option', { value: date, text: date })));
    dates.value = dateFilter;
  }
  function rows() { return model.flattenDaily(doc).sort((a, b) => b.date.localeCompare(a.date)); }
  function renderList() {
    const filtered = rows().filter(row => (!dateFilter || row.date === dateFilter) && (!query || [row.paper.title, row.paper.authors, row.paper.comment].join(' ').toLowerCase().includes(query.toLowerCase())));
    count.textContent = `${filtered.length} 篇`;
    list.replaceChildren(...filtered.map(row => el('button', { className: 'entry' + (selected === row.id ? ' active' : ''), 'aria-pressed': selected === row.id, onClick: () => { selected = row.id; renderList(); renderEditor(); grid.classList.add('has-selection'); } }, el('span', { className: 'entry-title', text: row.paper.title || row.paper.link || '未命名论文' }), el('span', { className: 'entry-meta', text: row.date }), el('span', { className: 'entry-description', text: row.paper.authors || '尚未填写作者' }))));
    if (!filtered.length) list.append(el('div', { className: 'empty', text: '没有匹配的论文' }));
  }
  function renderEditor() {
    const row = rows().find(item => item.id === selected);
    if (!row) { editor.replaceChildren(el('div', { className: 'empty' }, el('h2', { text: '选择一篇论文' }), el('p', { text: '从左侧直接打开，或新增一篇论文。' }))); return; }
    const update = (key, value) => { model.updateDaily(doc, row.dayIndex, row.paperIndex, { [key]: value }); updateStatus(); if (key === 'title' || key === 'authors') renderList(); refreshPaperPreview(); };
    const preview = el('section',{className:'paper-live-preview preview-column','aria-label':'论文实时预览'});
    function refreshPaperPreview() {
      const body = el('div',{className:'preview'},el('h2',{text:row.paper.title || '论文标题'}),el('p',{className:'count',text:row.paper.authors || ''}),el('h3',{text:'摘要'}),previewText(row.paper.abstract || '尚未填写摘要'),el('h3',{text:'我的点评'}),previewText(row.paper.comment || '尚未填写点评'));
      preview.replaceChildren(el('div',{className:'pane-heading',text:'实时预览'}),body);
    }
    const importCurrent = (initialLink=row.paper.link || '') => paperImportDialog({initialLink,existing:true,apply:(metadata,overwrite)=>{
      fillMetadata(row.paper,{title:metadata.title,link:metadata.link,authors:metadata.authors,affiliations:metadata.affiliations,abstract:metadata.abstract},overwrite);
      renderList();renderEditor();
    }});
    const linkField=inputField('论文链接',row.paper.link,value=>update('link',value),{type:'url',placeholder:'粘贴 arXiv / DOI 链接以读取信息'});
    linkField.querySelector('input').addEventListener('paste',event=>handlePaperPaste(event,importCurrent));
    const dateField = inputField('日期', row.date, () => {}, { type: 'date' });
    dateField.querySelector('input').addEventListener('change', event => {
      const value = event.target.value; if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) { event.target.value = row.date; return; }
      if (value === row.date) return;
      const paper = doc.data[row.dayIndex].papers.splice(row.paperIndex, 1)[0];
      let dayIndex = doc.data.findIndex(day => day.date === value);
      if (dayIndex < 0) { dayIndex = doc.data.length; doc.data.push({ date: value, papers: [] }); }
      doc.data[dayIndex].papers ||= []; doc.data[dayIndex].papers.push(paper);
      selected = `${dayIndex}:${doc.data[dayIndex].papers.length - 1}`; updateStatus(); refreshDates(); renderList(); renderEditor();
    });
    const dayNote = el('button', { text: '当日说明', onClick: () => showDialog(el('h2', { text: row.date + ' · 当日说明' }), inputField('对这一天所有论文的说明', doc.data[row.dayIndex].comment || '', value => { doc.data[row.dayIndex].comment = value; updateStatus(); }, { multiline: true, rows: 6 })) });
    const remove = el('button', { text: '移除论文', className: 'danger', onClick: () => { if (window.confirm('从这份草稿中移除这篇论文？发布前不会改变公开页面。')) { model.removeDaily(doc, row.dayIndex, row.paperIndex); selected = ''; updateStatus(); renderList(); renderEditor(); grid.classList.remove('has-selection'); } } });
    const source = el('section',{className:'source-column'},el('div',{className:'pane-heading',text:'编辑内容'}),
      inputField('论文标题', row.paper.title, value => update('title', value), { multiline: true, rows: 2, className: 'title-field', placeholder: '输入论文标题' }),
      el('div', { className: 'compact-row' }, dateField, linkField),
      el('details', { className: 'metadata' }, el('summary', { text: '作者与单位' }), inputField('作者', row.paper.authors, value => update('authors', value), { multiline: true, rows: 2 }), inputField('作者单位', row.paper.affiliations, value => update('affiliations', value), { multiline: true, rows: 2 })),
      inputField('摘要', row.paper.abstract, value => update('abstract', value), { multiline: true, rows: 7, className: 'abstract-field' }),
      inputField('我的点评', row.paper.comment, value => update('comment', value), { multiline: true, rows: 5, className: 'comment-field', placeholder: '记录值得关注的结果、局限和想法…' }));
    refreshPaperPreview();
    editor.replaceChildren(topActions('PAPER DETAILS',[focusButton(),dayNote,el('button',{text:'读取链接信息',onClick:()=>importCurrent()}),remove]),el('div',{className:'paper-editor-layout'},source,preview));
  }
  refreshDates(); if (!selected && rows().length) selected = rows()[0].id;
  renderList(); renderEditor(); return grid;
}

async function stageFile(file, folder) {
  if (!file) return null;
  if (file.size > 10 * 1024 * 1024) throw new Error('单个附件不能超过 10 MB。');
  if (!/\.(png|jpe?g|gif|webp|avif|pdf)$/i.test(file.name)) throw new Error('请选择 PNG、JPG、GIF、WebP、AVIF 图片或 PDF。');
  const clean = file.name.replace(/[^\p{L}\p{N}._-]/gu, '-');
  const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${clean}`;
  const bytes = new Uint8Array(await file.arrayBuffer()); let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  const publicURL = new URL(path, siteBase).pathname;
  const item = { path, content: btoa(binary), encoding: 'base64', publicURL, url: URL.createObjectURL(file) };
  uploads.set(path, item); updateStatus(); return item;
}
function uploadControl(onUpload, folder, accept = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.avif') {
  const input = el('input', { type: 'file', accept, 'aria-label': '选择要上传的附件', onChange: e => run(async () => { const item = await stageFile(e.target.files[0], folder); if (item) { onUpload(item.publicURL); message('附件已加入本次修改，保存草稿时上传。'); } e.target.value = ''; }) });
  return el('div', { className: 'upload-row' }, input, el('small', { text: '图片 / PDF · 最大 10 MB' }));
}
function imageGrid(body) {
  const images = [...String(body || '').matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g)];
  if (!images.length) return el('p', { className: 'count', text: '相册尚无图片，可在下方上传。' });
  return el('div', { className: 'image-grid' }, ...images.map(match => {
    const src = assetURL(match[2]);
    const caption = el('figcaption', { text: match[1] || '相册照片' });
    const img = el('img', { src: src || '', alt: match[1], loading: 'lazy', onError: () => { caption.textContent = '图片无法加载 · ' + (match[1] || match[2]); } });
    return el('figure', { className: 'image-card' }, img, caption);
  }));
}
function genericForm(doc, schema, { gallery = false } = {}) {
  const wrap = el('section', { className: 'editor-pane' });
  const actions = schema.folder ? [focusButton()] : [];
  if (schema.name === 'publications') actions.push(el('button',{text:'从链接填写',onClick:()=> importPublication(doc)}));
  if (schema.folder) actions.push(el('button', {text:'删除条目', className:'danger', onClick:() => {
    if (!window.confirm('从草稿中删除这个条目？发布后公开页面才会移除，图片附件会保留。')) return;
    if (doc.originalText === '') docs.delete(doc.path); else deleted.add(doc.path);
    selected = ''; updateStatus(); render();
  }}));
  wrap.append(topActions('EDIT CONTENT', actions));
  let pictures;
  if (gallery) { pictures = el('div', {}, imageGrid(doc.body)); wrap.append(pictures); }
  function addField(field, prefix = '') {
    const key = prefix + field.name;
    if (field.widget === 'hidden') return;
    if (field.widget === 'object') { const group = el('fieldset', { className: 'metadata' }, el('legend', { text: field.label })); for (const sub of field.fields || []) group.append(makeField(sub, key + '.')); wrap.append(group); }
    else wrap.append(makeField(field, prefix));
  }
  function makeField(field, prefix) {
    const key = prefix + field.name;
    const isBody = field.name === 'body';
    const isMarkdown = field.widget === 'markdown';
    const livePreview = isMarkdown ? el('div',{className:'preview markdown-preview', 'aria-label':field.label+'预览'}) : null;
    const refreshPreview = () => { if(livePreview) renderMarkdownPreview(livePreview, getValue(doc,key) || '', {resolveAsset:assetURL,baseURL:siteBase}); };
    const multiline = ['text', 'markdown'].includes(field.widget) || field.name === 'title';
    const value = getValue(doc, key);
    const isList = field.widget === 'list';
    const input = inputField(field.label, isList ? (Array.isArray(value) ? value.join(', ') : value || '') : value, next => { setValue(doc, key, isList ? next.split(',').map(x => x.trim()).filter(Boolean) : next); refreshPreview(); }, {
      multiline, rows: isBody ? 18 : field.name === 'title' ? 2 : 4,
      className: isBody ? 'body-field' : field.name === 'title' ? 'title-field' : '',
      hint: isList ? '多个标签用英文逗号分隔。' : (isMarkdown ? 'Markdown 源码；右侧预览随输入更新，公式保留原文。' : field.hint || ''),
      type: field.widget === 'datetime' ? 'date' : 'text'
    });
    if (schema.name === 'publications' && ['paperurl','arxiv_url','doi_url'].includes(field.name)) input.querySelector('input').addEventListener('paste',event=>handlePaperPaste(event,value=>importPublication(doc,value)));
    if (['file', 'image'].includes(field.widget)) {
      input.append(uploadControl(url => { setValue(doc, key, url); input.querySelector('input').value = url; if (image) image.src = assetURL(url); }, field.widget === 'image' ? 'images/uploads' : 'files/uploads'));
      let image;
      if (field.widget === 'image') { image = el('img', { className: 'asset-preview', alt: field.label }); if (value) image.src = assetURL(value); input.append(image); }
    }
    if (isBody) input.append(uploadControl(url => { const text = `\n\n${/\.pdf$/i.test(url) ? '[PDF]' : '![图片说明]'}(${url})\n`; const area = input.querySelector('textarea'); const start = area.selectionStart; const end = area.selectionEnd; const body = String(doc.body || ''); doc.body = body.slice(0, start) + text + body.slice(end); area.value = doc.body; updateStatus(); refreshPreview(); if (pictures) pictures.replaceChildren(imageGrid(doc.body)); }, gallery ? 'images/portfolio' : 'files/uploads'));
    if (isMarkdown) {
      refreshPreview();
      return el('div',{className:'split-editor'},
        el('section',{className:'source-column'},el('div',{className:'pane-heading',text:'源码'}),input),
        el('section',{className:'preview-column'},el('div',{className:'pane-heading',text:'实时预览'}),livePreview));
    }
    return input;
  }
  if (schema.name === 'notes') {
    for (const name of ['title','note_summary','pdf','body']) { const field = schema.fields.find(item=>item.name===name); if(field) addField(field); }
    const extra = el('details',{className:'metadata'},el('summary',{text:'日期、标签与其他信息'}));
    for(const field of schema.fields.filter(item=>!['title','note_summary','pdf','body'].includes(item.name))) extra.append(makeField(field,''));
    wrap.append(extra);
  } else { for (const field of schema.fields) addField(field); }
  return wrap;
}
async function renderCollection(name) {
  const schema = collection(name);
  const records = await Promise.all(files.filter(file => !deleted.has(file.path) && file.path.startsWith(schema.folder + '/') && /\.(md|markdown|html)$/i.test(file.path)).map(file => read(file.path)));
  for (const doc of docs.values()) if (!deleted.has(doc.path) && doc.path.startsWith(schema.folder + '/') && !records.includes(doc)) records.push(doc);
  records.sort((a, b) => String(b.data.date || b.path).localeCompare(String(a.data.date || a.path)));
  const list = el('div', { className: 'entries' });
  const editor = el('div', { className: 'editor-pane' });
  const grid = el('div', { className: 'workspace-grid' });
  const search = el('input', { type: 'search', placeholder: '搜索标题', 'aria-label': '搜索内容', value: query, onInput: e => { query = e.target.value; renderList(); } });
  function renderList() {
    list.replaceChildren(...records.filter(doc => String(doc.data.title || '').toLowerCase().includes(query.toLowerCase())).map(doc => el('button', { className: 'entry' + (selected === doc.path ? ' active' : ''), onClick: () => { selected = doc.path; renderList(); renderEditor(); grid.classList.add('has-selection'); } }, el('span', { className: 'entry-title', text: doc.data.title || '未命名内容' }), el('span', { className: 'entry-meta', text: doc.data.date || (name === 'gallery' ? `${[...String(doc.body).matchAll(/!\[/g)].length} 张图片` : '已收录') }))));
    if (!records.length) list.append(el('p', { className: 'empty', text: '暂无条目，点击新增开始。' }));
  }
  function renderEditor() {
    const doc = records.find(record => record.path === selected);
    editor.replaceChildren(doc ? genericForm(doc, schema, { gallery: name === 'gallery' }) : el('div', { className: 'empty', text: '选择或新建一个条目' }));
  }
  const add = el('button', { text: '＋ 新增', onClick: () => {
    const date = localDate();
    const path = `${schema.folder}/${name === 'notes' ? date + '-' : ''}${crypto.randomUUID().slice(0, 8)}.md`;
    const data = { title: '', ...(name === 'gallery' ? { collection: 'portfolio' } : { date }), ...(name === 'notes' ? {note_type:'Study note'} : {}), ...(name === 'publications' ? { collection: 'publications', authors: '', venue: '' } : {}) };
    const doc = model.parse(path, ''); doc.data = data; doc.kind = 'frontmatter'; doc.initialDate = date; docs.set(path, doc); records.unshift(doc); selected = path; updateStatus(); renderList(); renderEditor(); grid.classList.add('has-selection');
  } });
  grid.append(el('aside', { className: 'list-pane' }, el('div', { className: 'list-tools' }, search, add), list), editor);
  if (!selected && records.length) selected = records[0].path;
  renderList(); renderEditor(); return grid;
}
async function renderPage(name) {
  const schema = collection('pages').files.find(file => file.name === name);
  return el('div', { className: 'section-page' }, genericForm(await read(schema.file), schema));
}
async function renderTopics() {
  const doc = await read('_data/notes.yml');
  const list = el('div', { className: 'entries' }), editor = el('section', { className: 'editor-pane' });
  const grid = el('div', { className: 'workspace-grid' });
  const fields = collection('note_collections').files[0].fields[0].fields;
  let index = Number(selected || 0);
  function draw() {
    list.replaceChildren(...doc.data.map((item, i) => el('button', { className: 'entry' + (i === index ? ' active' : ''), text: item.title || '未命名专题', onClick: () => { index = i; selected = String(i); draw(); grid.classList.add('has-selection'); } })));
    if (!doc.data[index]) { editor.replaceChildren(el('div', { className: 'empty', text: '暂无专题' })); return; }
    editor.replaceChildren(topActions('NOTE COLLECTION'), ...fields.map(field => inputField(field.label, Array.isArray(doc.data[index][field.name]) ? doc.data[index][field.name].join(', ') : doc.data[index][field.name], value => { doc.data[index][field.name] = field.widget === 'list' ? value.split(',').map(x => x.trim()).filter(Boolean) : value; updateStatus(); }, { multiline: field.widget === 'text' })));
  }
  grid.append(el('aside', { className: 'list-pane' }, el('div', { className: 'list-tools' }, el('button', { text: '＋ 新增专题', onClick: () => { doc.data.push({ title: '', url: '', description: '', type: '', language: '' }); index = doc.data.length - 1; updateStatus(); draw(); grid.classList.add('has-selection'); } })), list), editor); draw(); return grid;
}
async function render() {
  const version = ++routeVersion, key = section();
  const [title, description] = sections[key]; $('section-title').textContent = title; $('section-description').textContent = description;
  document.querySelectorAll('[data-section]').forEach(link => { if (link.dataset.section === key) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  $('statistics').hidden = key !== 'visitors'; $('content').hidden = key === 'visitors';
  $('commandbar').hidden = !client || key === 'visitors' || key === 'overview';
  if (key === 'visitors') { if (!$('stats-frame').src && $('stats-frame').dataset.src) $('stats-frame').src = $('stats-frame').dataset.src; $('content').setAttribute('aria-busy', 'false'); return; }
  if (!client) { $('content').replaceChildren(el('section', { className: 'signin' }, el('h2', { text: '开始管理你的主页' }), el('p', { text: '使用 GitHub 登录后，即可编辑论文、笔记和相册。保存草稿后预览，再发布到主页。' }), el('button', { className: 'primary', text: '使用 GitHub 登录', onClick: signIn }))); $('content').setAttribute('aria-busy', 'false'); return; }
  $('content').setAttribute('aria-busy', 'true');
  let output;
  try {
    if (key === 'daily') output = await renderDaily();
    else if (['publications', 'notes', 'gallery'].includes(key)) {
      const options = key === 'publications' ? [['entries', '论文条目'], ['page', '页面介绍与图片']] : key === 'gallery' ? [['entries', '相册'], ['page', '列表页介绍']] : [['entries', '笔记'], ['topics', '互动专题']];
      const activeMode = options.some(([value]) => value === mode) ? mode : 'entries';
      output = el('div', {}, tabs(options, activeMode, render));
      output.append(activeMode === 'entries' ? await renderCollection(key) : activeMode === 'topics' ? await renderTopics() : await renderPage(key === 'gallery' ? 'gallery_page' : 'publications_page'));
    } else if (key === 'about') {
      const homeMode = mode === 'profile' ? 'profile' : 'body';
      output = el('div', {}, tabs([['body','首页正文'],['profile','侧栏资料']],homeMode,render));
      if(homeMode === 'body') output.append(await renderPage('about'));
      else { const schema = collection('settings').files.find(item=>item.name==='profile'); output.append(el('div',{className:'section-page'},genericForm(await read(schema.file),schema))); }
    } else if (key === 'research' || key === 'cv') output = await renderPage(key);
    else if (key === 'settings') {
      const settingsMode = ['profile', 'services', 'about'].includes(mode) ? mode : 'profile';
      output = el('div', {}, tabs([['profile', '网站与侧栏'], ['about', '个人介绍'], ['services', '服务连接']], settingsMode, render));
      if (settingsMode === 'about') output.append(await renderPage('about'));
      else { const schema = collection('settings').files.find(item => item.name === settingsMode); output.append(el('div', { className: 'section-page' }, genericForm(await read(schema.file), schema))); }
    } else {
      output = el('div', { className: 'overview-grid' }, ...Object.entries(sections).filter(([name]) => !['overview', 'settings'].includes(name)).map(([name, [label, detail]]) => el('a', { href: '#' + name, className: 'overview-card' }, el('strong', { text: label }), el('span', { text: detail }))));
    }
    if (version === routeVersion) $('content').replaceChildren(output);
  } catch (error) { if (version === routeVersion) { message(error.message, true); $('content').replaceChildren(el('div', { className: 'empty', text: '内容未能载入。请检查连接后点击“重新载入”。' })); } }
  if (version === routeVersion) $('content').setAttribute('aria-busy', 'false');
}
function normalizeNewPaths() {
  for (const doc of [...docs.values()]) {
    if (doc.originalText !== '' || !doc.path.startsWith('_posts/')) continue;
    const date = doc.data.date;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new Error('请填写笔记日期。');
    const nextPath = `_posts/${date}-${doc.path.split('/').at(-1).replace(/^\d{4}-\d{2}-\d{2}-/, '')}`;
    if (nextPath !== doc.path) { const old = doc.path; docs.delete(old); doc.path = nextPath; docs.set(nextPath, doc); if (selected === old) selected = nextPath; }
  }
}
function validateSchema(doc, fields, prefix = '') {
  for (const field of fields) {
    const key = prefix + field.name;
    if (field.widget === 'object') { validateSchema(doc, field.fields || [], key + '.'); continue; }
    const value = getValue(doc, key);
    const original = key === 'body' ? doc.originalBody : key.split('.').reduce((obj,k) => obj?.[k],doc.originalData);
    if (doc.originalText !== '' && JSON.stringify(value) === JSON.stringify(original)) continue;
    const empty = value == null || value === '' || (Array.isArray(value) && !value.length);
    if (empty && field.required !== false && field.widget !== 'hidden') throw new Error(`请填写“${field.label}”。`);
    if (!empty && field.pattern && !new RegExp(field.pattern[0]).test(String(value))) throw new Error(`${field.label}：${field.pattern[1]}`);
  }
}
function validateChanges() {
  for (const doc of changes()) {
    const folderSchema = config.collections.find(item => item.folder && doc.path.startsWith(item.folder + '/'));
    const fileSchema = config.collections.flatMap(item => item.files || []).find(item => item.file === doc.path);
    if (folderSchema || (fileSchema && !fileSchema.fields.some(field => field.name === 'items'))) validateSchema(doc, (folderSchema || fileSchema).fields);
    if (doc.path === '_data/daily_papers.yml') {
      for (const row of model.flattenDaily(doc)) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) throw new Error('论文日期格式不正确。');
        if (!/^https?:\/\/\S+$/.test(row.paper.link || '')) throw new Error('请为每篇论文填写完整的 http(s) 链接。');
      }
    } else if (doc.kind === 'frontmatter' && !String(doc.data.title || '').trim()) throw new Error('请填写内容标题后再保存。');
    if (doc.path === '_data/site_admin.yml') {
      if (doc.data.netlify_site_id && !/^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(doc.data.netlify_site_id)) throw new Error('Netlify Project ID 格式不正确。');
      if (doc.data.goatcounter_code && !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(doc.data.goatcounter_code)) throw new Error('GoatCounter 名称格式不正确。');
    }
  }
}
async function signIn() {
  // Open the popup within the user's click before asynchronous calls.
  if (busy || !settings) return;
  const pending = login(settings.netlify_site_id);
  await run(async () => { const token = await pending; const candidate = new GitHubClient(token); const user = await candidate.user(); const access = await candidate.repositoryAccess(); if (!access.canWrite) throw new Error('这个 GitHub 账号没有主页仓库的写入权限。'); client = candidate; $('account-name').textContent = user.login; $('auth-button').textContent = '退出'; await loadContext(); message('已登录，可以开始编辑。'); });
}
$('auth-button').addEventListener('click', () => {
  if (!client) return signIn();
  if (!checkLeave()) return;
  logout(); client = null; draft = null; docs = new Map(); deleted = new Set(); routeVersion++; clearUploads(); $('account-name').textContent = '尚未登录'; $('auth-button').textContent = '使用 GitHub 登录'; message(); render();
});
$('save-button').addEventListener('click', () => run(async () => {
  normalizeNewPaths(); validateChanges();
  const pendingFiles = changes().map(doc => ({ path: doc.path, content: model.serialize(doc) }));
  pendingFiles.push(...[...deleted].map(path => ({path,content:null})));
  pendingFiles.push(...[...uploads.values()].map(({ path, content, encoding }) => ({ path, content, encoding })));
  const result = await client.saveDraft({ draft, baseSha: ref, files: pendingFiles, message: `Update homepage: ${section()}` });
  draft = result; ref = result.headSha;
  for (const file of pendingFiles) {
    if (file.content === null) { docs.delete(file.path); files = files.filter(item => item.path !== file.path); }
    else { if (docs.has(file.path)) docs.set(file.path, model.parse(file.path,file.content)); if (!files.some(item => item.path === file.path)) files.push({path:file.path}); }
  }
  for (const [path,item] of uploads) savedAssets.set(path,item);
  uploads.clear(); deleted.clear(); await render(); updateStatus();
  message('草稿已保存。公开主页尚未改变；检查后点击“发布”。');
}));
$('publish-button').addEventListener('click', () => {
  const current = draft;
  showDialog(el('h2', { text: '发布这份草稿？' }), el('p', { text: '此操作会将草稿合并到主页。网站构建完成后，访客将看到更新。' }), el('a', { href: current.url, target: '_blank', rel: 'noopener', text: '查看全部修改 ↗' }), el('p', { className: 'count', text: '如果远端内容发生冲突，发布会停止，不会覆盖已有修改。' }), el('button', { className: 'primary', text: '确认发布', onClick: () => { $('dialog').close(); run(async () => { const result = await client.publishDraft(current); if (!result.merged) throw new Error(result.message || '发布未完成。'); await loadContext(); message('已提交发布，GitHub Pages 构建完成后主页会更新。'); }); } }));
});
$('refresh-button').addEventListener('click', () => { if (checkLeave()) run(async () => { await loadContext(draft ? await client.openDraft(draft.prNumber) : null); message('已重新载入远端内容。'); }); });
$('drafts-button').addEventListener('click', () => run(async () => {
  const list = await client.listDrafts();
  showDialog(el('h2', { text: '草稿箱' }), el('p', { className: 'count', text: '打开草稿可继续编辑。旧版编辑器的草稿可在 GitHub 查看。' }),
    el('button', { text: '返回已发布内容', onClick: () => { if (checkLeave()) { $('dialog').close(); run(() => loadContext()); } } }),
    ...list.map(item => el('div', { className: 'draft-row' }, el('div', {}, el('strong', { text: item.title }), el('p', { text: item.legacy ? '旧版草稿' : '尚未发布' })), item.legacy ? el('a', { href: item.url, target: '_blank', rel: 'noopener', text: '在 GitHub 查看 ↗' }) : el('button', { text: '继续编辑', onClick: () => { if (checkLeave()) { $('dialog').close(); run(async () => { await loadContext(await client.openDraft(item.prNumber)); message('已打开草稿，可继续编辑。'); }); } } }))),
    ...(!list.length ? [el('p', { text: '目前没有已保存的草稿。' })] : []));
}));
window.addEventListener('beforeunload', event => { if (isDirty()) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('hashchange', () => { if($('dialog').open) $('dialog').close(); selected = ''; query = ''; dateFilter = ''; mode = ''; render(); });
$('stats-refresh').addEventListener('click', () => { const frame = $('stats-frame'); if (frame.src) frame.src = frame.src; });
$('auth-button').disabled = true;
try {
  const responses = await Promise.all([fetch('./settings.json', { cache: 'no-store' }), fetch('./config.yml?v=' + Date.now(), { cache: 'no-store' })]);
  if (responses.some(response => !response.ok)) throw new Error('后台配置未能加载，请刷新重试。');
  settings = await responses[0].json(); $('auth-button').disabled = false; config = window.jsyaml.load(await responses[1].text());
  if (/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(settings.goatcounter_code || '')) { const url = `https://${settings.goatcounter_code}.goatcounter.com/`; $('stats-link').href = url; $('stats-frame').dataset.src = url; }
  const token = getToken();
  if (token) {
    client = new GitHubClient(token);
    try { const user = await client.user(); const access = await client.repositoryAccess(); if (!access.canWrite) throw new Error('这个账号没有主页仓库的写入权限。'); $('account-name').textContent = user.login; $('auth-button').textContent = '退出'; await loadContext(); }
    catch (error) { client = null; if (error.status === 401) logout(); message('会话无法恢复，请重新登录。', true); await render(); }
  } else await render();
} catch (error) { message(error.message, true); $('content').setAttribute('aria-busy', 'false'); }
