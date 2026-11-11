const ARXIV_HOSTS = new Set(['arxiv.org', 'www.arxiv.org', 'export.arxiv.org']);
const DOI_HOSTS = new Set(['doi.org', 'dx.doi.org']);
const ARXIV_ID = /^(?:\d{2}(?:0[1-9]|1[0-2])\.\d{4,5}|[a-z][a-z0-9.-]*\/\d{2}(?:0[1-9]|1[0-2])\d{3})(?:v[1-9]\d*)?$/i;
const DOI_ID = /^10\.\d{4,9}\/[^\s\u0000-\u001f\u007f]+$/i;
const ARXIV_DOI = /^10\.48550\/arxiv\.(.+)$/i;
const REQUEST_TIMEOUT = 6500;

const asArray = (value) => Array.isArray(value) ? value : [];

function validDoi(value) {
  return typeof value === 'string' && DOI_ID.test(value) &&
    value.split('/').every((part) => part && part !== '.' && part !== '..');
}

const encodedId = (id) => id.split('/').map(encodeURIComponent).join('/');
const doiUrl = (id) => `https://doi.org/${encodedId(id)}`;
const arxivUrl = (id) => `https://arxiv.org/abs/${encodedId(id)}`;
const baseArxivId = (id) => id.replace(/v\d+$/i, '');

function cleanArxivId(id) {
  return typeof id === 'string' && ARXIV_ID.test(id) ? id.replace(/v(\d+)$/i, 'v$1') : '';
}

export function identifyPaperLink(input) {
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) throw new Error('请先粘贴 arXiv 或 DOI 链接。');

  const rawDoi = text.replace(/^doi:\s*/i, '');
  if (validDoi(rawDoi)) {
    try { return { type: 'doi', id: rawDoi, url: doiUrl(rawDoi) }; } catch { /* Invalid text below. */ }
  }
  let url, path;
  try {
    url = new URL(text);
    path = decodeURIComponent(url.pathname);
  } catch {
    throw new Error('无法识别这个链接。请粘贴完整的 arXiv 或 DOI 链接。');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    throw new Error('请使用不含账户信息的 HTTPS arXiv 或 DOI 链接。');
  }
  if (ARXIV_HOSTS.has(url.hostname)) {
    const id = cleanArxivId(path.replace(/^\/(abs|pdf)\//i, '').replace(/\/$/, '').replace(/\.pdf$/i, ''));
    if (!/^\/(abs|pdf)\//i.test(path) || !id) {
      throw new Error('这个 arXiv 链接没有有效的论文编号。请粘贴摘要页或 PDF 链接。');
    }
    return { type: 'arxiv', id, url: arxivUrl(id) };
  }
  if (DOI_HOSTS.has(url.hostname)) {
    const id = path.slice(1);
    if (validDoi(id)) return { type: 'doi', id, url: doiUrl(id) };
    throw new Error('这个 DOI 链接没有有效的 DOI 编号。');
  }
  throw new Error('目前只能从 arXiv 摘要页、arXiv PDF 或 DOI 链接读取论文。');
}

const BASIC_ENTITIES = {
  amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ',
  ndash: '–', mdash: '—', minus: '−', times: '×', le: '≤', ge: '≥',
  alpha: 'α', beta: 'β', gamma: 'γ', mu: 'μ', pi: 'π',
};
let entityReader;

function decodeEntities(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][\w]+);/gi, (match, code) => {
    if (code.startsWith('#')) {
      const point = /^#x/i.test(code) ? Number.parseInt(code.slice(2), 16) : Number(code.slice(1));
      return point > 0 && point <= 0x10ffff && !(point >= 0xd800 && point <= 0xdfff)
        ? String.fromCodePoint(point) : match;
    }
    if (Object.hasOwn(BASIC_ENTITIES, code)) return BASIC_ENTITIES[code];
    if (typeof document !== 'undefined') {
      // Parse a single entity only. No provider markup is inserted into the DOM.
      entityReader ??= document.createElement('textarea');
      entityReader.innerHTML = match;
      return entityReader.value;
    }
    return match;
  });
}

const TAG = /<\/?[a-z][\w:-]*(?=[\s/>])(?:"[^"]*"|'[^']*'|[^'"<>])*?>/gi;
const ACTIVE_TAG = /^(?:audio|button|details|embed|form|frame|iframe|img|input|link|math|meta|object|picture|script|source|style|svg|template|textarea|track|video)$/i;

function removeTag(tag) {
  const match = /^<\/?([a-z][\w:-]*)([^]*)>$/i.exec(tag);
  if (!match) return '';
  const [, name, attributes] = match;
  if (name.includes(':') || ACTIVE_TAG.test(name) || /=/.test(attributes) ||
      !attributes.replaceAll('/', '').trim()) return '';
  // Text like "x<y and a>b" can be a comparison, rather than an attributed tag.
  return tag;
}

function mathText(xml) {
  const stack = [{ name: '', values: [] }];
  const tags = /<(\/?)(?:[a-z][\w-]*:)?([a-z][\w-]*)\b(?:"[^"]*"|'[^']*'|[^'"<>])*?>/gi;
  const add = (text) => { if (text.trim()) stack.at(-1).values.push(text.trim()); };
  let end = 0;
  for (const match of xml.matchAll(tags)) {
    add(xml.slice(end, match.index));
    end = match.index + match[0].length;
    const name = match[2].toLowerCase();
    if (!match[1]) {
      if (!match[0].endsWith('/>')) stack.push({ name, values: [] });
      continue;
    }
    const frame = stack.pop();
    if (frame?.name !== name || !stack.length) return xml.replace(TAG, '');
    const [a, b, c] = frame.values;
    let text;
    switch (name) {
      case 'msub': text = b ? `${a}_{${b}}` : a; break;
      case 'msup': text = b ? `${a}^{${b}}` : a; break;
      case 'msubsup': text = c ? `${a}_{${b}}^{${c}}` : a; break;
      case 'mfrac': text = b ? `(${a})/(${b})` : a; break;
      case 'msqrt': text = `√(${frame.values.join('')})`; break;
      case 'mroot': text = b ? `root[${b}](${a})` : a; break;
      case 'annotation':
      case 'annotation-xml': text = ''; break;
      case 'semantics': text = a; break;
      default: text = frame.values.join('');
    }
    if (text) add(text);
  }
  add(xml.slice(end));
  return stack.length === 1 ? stack[0].values.join('') : xml.replace(TAG, '');
}

function stripMarkup(value) {
  return value
    .replace(/<!--[^]*?-->/g, '')
    .replace(/<(?:[a-z][\w-]*:)?(?:script|style|permissions|supplementary-material)\b[^>]*>[^]*?<\/(?:[a-z][\w-]*:)?(?:script|style|permissions|supplementary-material)\s*>/gi, '')
    .replace(/<(?:[a-z][\w-]*:)?math\b[^>]*>[^]*?<\/(?:[a-z][\w-]*:)?math\s*>/gi, mathText)
    .replace(/<(?:[a-z][\w-]*:)?(sub|sup)\b[^>]*>([^]*?)<\/(?:[a-z][\w-]*:)?\1\s*>/gi,
      (_, kind, inner) => `${kind.toLowerCase() === 'sub' ? '_' : '^'}{${inner}}`)
    .replace(/<\/(?:[a-z][\w-]*:)?(?:p|para|div|sec|title|list-item)\s*>|<(?:[a-z][\w-]*:)?br\s*\/?>/gi, '\u0000')
    .replace(TAG, removeTag)
    .replace(/<[!?][^<>]*>/g, '')
    .replace(/<\/?([a-z][\w:-]*)([\s/][^<>]*)$/gi,
      (tail, name, attributes) => ACTIVE_TAG.test(name) || /=/.test(attributes) ? '' : tail);
}

function plainText(value) {
  if (typeof value !== 'string') return '';
  // Some feeds encode embedded HTML as entities. Remove tags after decoding too.
  return stripMarkup(decodeEntities(stripMarkup(value)))
    .split('\u0000').map((part) => part.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
}

function plainLine(value) {
  return plainText(value).replace(/\s+/g, ' ');
}

const firstText = (entries) => asArray(entries).map(plainLine).find(Boolean) || '';

function creatorList(entries, { given, family, affiliations }) {
  const creators = asArray(entries);
  const authors = creators.map((item) => {
    const parts = [plainLine(item?.[given]), plainLine(item?.[family])].filter(Boolean);
    return parts.join(' ') || plainLine(item?.name);
  }).filter(Boolean);
  const places = creators.flatMap((item) => asArray(item?.[affiliations]))
    .map((entry) => plainLine(typeof entry === 'string' ? entry : entry?.name))
    .filter(Boolean);
  return { authors: authors.join(', '), affiliations: [...new Set(places)].join('; ') };
}

function dateString(value) {
  const parts = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?(?=$|T)/.exec(String(value ?? ''));
  if (!parts) return '';
  const [, year, month, day] = parts;
  if (month && (+month < 1 || +month > 12)) return '';
  if (day && (+day < 1 || +day > 31)) return '';
  return [year, month, day].filter(Boolean).join('-');
}

function crossrefDate(record) {
  for (const key of ['published', 'published-online', 'published-print', 'issued']) {
    const parts = record[key]?.['date-parts']?.[0];
    if (Array.isArray(parts) && parts.length <= 3 && parts.every((part) => Number.isInteger(part))) {
      const date = dateString(parts.map((part, index) => String(part).padStart(index ? 2 : 4, '0')).join('-'));
      if (date) return date;
    }
  }
  return '';
}

function arxivFromDoi(id) {
  return cleanArxivId(ARXIV_DOI.exec(id)?.[1]);
}

function crossrefRecord(json, link) {
  const record = json?.message;
  if (typeof record?.DOI !== 'string' || record.DOI.toLowerCase() !== link.id.toLowerCase()) return null;
  const preprints = asArray(record.relation?.['has-preprint']);
  let arxivId = '';
  for (const item of preprints) {
    const identifierType = String(item?.['id-type'] || '').toLowerCase();
    if (typeof item?.id === 'string' && identifierType === 'doi') arxivId = arxivFromDoi(item.id);
    if (typeof item?.id === 'string' && identifierType === 'arxiv') {
      arxivId = cleanArxivId(item.id.replace(/^arxiv:/i, ''));
    }
    if (arxivId) break;
  }
  return {
    title: firstText(record.title),
    ...creatorList(record.author, { given: 'given', family: 'family', affiliations: 'affiliation' }),
    abstract: plainText(record.abstract),
    link: link.url,
    doi_url: link.url,
    ...(arxivId ? { arxiv_url: arxivUrl(arxivId) } : {}),
    venue: firstText(record['container-title']),
    date: crossrefDate(record),
  };
}

function dataciteRecord(json, link, identifier) {
  const record = json?.data?.attributes;
  if (typeof record?.doi !== 'string' || record.doi.toLowerCase() !== identifier.toLowerCase()) return null;
  const titles = asArray(record.titles);
  const title = firstText(titles.filter((item) => !item?.titleType).map((item) => item?.title)) ||
    firstText(titles.map((item) => item?.title));
  const arxivId = link.type === 'arxiv' ? link.id : arxivFromDoi(link.id);
  const dates = asArray(record.dates);
  const firstSubmission = arxivId ? dates.find((item) => item?.dateType === 'Submitted' && item.dateInformation === 'v1') : null;
  const issued = dates.find((item) => item?.dateType === 'Issued');
  const versionOf = asArray(record.relatedIdentifiers).find((item) =>
    ['IsPreprintOf', 'IsVersionOf'].includes(item?.relationType) && item?.relatedIdentifierType === 'DOI' &&
    validDoi(item.relatedIdentifier) && !arxivFromDoi(item.relatedIdentifier));
  return {
    title,
    ...creatorList(record.creators, { given: 'givenName', family: 'familyName', affiliations: 'affiliation' }),
    abstract: asArray(record.descriptions)
      .filter((item) => item?.descriptionType === 'Abstract').map((item) => plainText(item.description)).find(Boolean) || '',
    link: arxivId && link.type === 'doi' ? doiUrl(record.doi) : link.url,
    doi_url: link.type === 'arxiv' && versionOf ? doiUrl(versionOf.relatedIdentifier) : doiUrl(record.doi),
    ...(arxivId ? { arxiv_url: arxivUrl(arxivId) } : {}),
    venue: plainLine(record.container?.title) || (arxivId ? 'arXiv' : ''),
    date: dateString(firstSubmission?.date) || dateString(issued?.date) || dateString(record.publicationYear),
    ...(arxivId && arxivId !== baseArxivId(arxivId) ? { metadataVersion: 'record' } : {}),
  };
}

function abortError(signal) {
  return signal?.reason ?? new DOMException('已取消论文查询。', 'AbortError');
}

async function queryProvider(provider, fetchImpl, signal) {
  if (signal?.aborted) throw abortError(signal);
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, REQUEST_TIMEOUT);
  try {
    const response = await fetchImpl(provider.url, {
      signal: controller.signal,
      credentials: 'omit',
      redirect: 'error',
    });
    if (signal?.aborted) throw abortError(signal);
    if (response.status === 404) return { issue: 'not-found' };
    if (response.status === 429) return { issue: 'rate-limit' };
    if (!response.ok) return { issue: 'unavailable' };
    const metadata = provider.parse(await response.json());
    if (signal?.aborted) throw abortError(signal);
    return metadata?.title
      ? { metadata: { ...metadata, source: provider.name, sourceURL: provider.url } }
      : { issue: 'incomplete' };
  } catch {
    if (signal?.aborted) throw abortError(signal);
    return { issue: 'unavailable' };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
  }
}

export async function fetchPaperMetadata(input, { fetchImpl = globalThis.fetch?.bind(globalThis), signal } = {}) {
  const link = identifyPaperLink(input);
  if (typeof fetchImpl !== 'function') throw new Error('浏览器不支持在线读取论文信息。');

  const arxivId = link.type === 'arxiv' ? link.id : arxivFromDoi(link.id);
  const dataciteId = arxivId ? `10.48550/arXiv.${baseArxivId(arxivId)}` : link.id;
  const dataCite = {
    name: 'DataCite',
    url: `https://api.datacite.org/dois/${encodedId(dataciteId)}`,
    parse: (json) => dataciteRecord(json, link, dataciteId),
  };
  const crossref = {
    name: 'Crossref',
    url: `https://api.crossref.org/works/${encodedId(link.id)}`,
    parse: (json) => crossrefRecord(json, link),
  };
  const issues = [];
  for (const provider of arxivId ? [dataCite] : [crossref, dataCite]) {
    const { metadata, issue } = await queryProvider(provider, fetchImpl, signal);
    if (metadata) return metadata;
    issues.push(issue);
  }

  if (issues.every((issue) => issue === 'not-found')) {
    const type = arxivId ? 'arXiv' : 'DOI';
    throw new Error(`暂未找到这个 ${type} 编号的公开元数据。请检查链接，或手动填写。`);
  }
  if (issues.includes('rate-limit')) throw new Error('论文数据库请求过于频繁，请稍后重试或手动填写。');
  if (issues.includes('incomplete') && !issues.includes('unavailable')) {
    throw new Error('论文数据库没有提供可用的标题，请手动填写。');
  }
  throw new Error('暂时无法读取论文信息，请检查网络、稍后重试或手动填写。');
}
