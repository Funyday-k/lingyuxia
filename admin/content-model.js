const PAPER_FIELDS = new Set(['title', 'link', 'authors', 'affiliations', 'abstract', 'comment']);
const OPEN = /^(?:\uFEFF)?---[ \t]*(?:\r\n|\r|\n|$)/;
const CLOSE = /^(?:---|\.\.\.)[ \t]*(?:\r\n|\r|\n|$)/m;
const LEADING_YAML = /^(?:\uFEFF)?(?:[ \t]*(?:#[^\r\n]*)?(?:\r\n|\r|\n))*/;
const EOL = /\r\n|\r|\n/;
const hasOwn = (record, key) => Object.prototype.hasOwnProperty.call(record, key);

function isRecord(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertYamlValue(value, ancestors = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || Number.isFinite(value)) return;
  if ((!isRecord(value) && !Array.isArray(value)) || ancestors.has(value)) {
    throw new Error('Content contains a value that cannot be saved as YAML.');
  }

  ancestors.add(value);
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) assertYamlValue(value[index], ancestors);
  } else {
    for (const child of Object.values(value)) assertYamlValue(child, ancestors);
  }
  ancestors.delete(value);
}

function equalData(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every(key => hasOwn(right, key) && equalData(left[key], right[key]));
}

function splitFrontmatter(text) {
  const opening = OPEN.exec(text);
  if (!opening) return { opening: '', metadata: '', closing: '', body: text };

  const rest = text.slice(opening[0].length);
  const closing = CLOSE.exec(rest);
  if (!closing) throw new Error('Missing the closing front matter delimiter.');
  return {
    opening: opening[0],
    metadata: rest.slice(0, closing.index),
    closing: closing[0],
    body: rest.slice(closing.index + closing[0].length)
  };
}

function checkShape(path, kind, data) {
  const listOnly = kind === 'yaml' && /(?:^|\/)_data\/(?:daily_papers|notes)\.ya?ml$/i.test(path);
  if (kind === 'frontmatter' && !isRecord(data)) throw new Error('Front matter must contain a YAML mapping.');
  if (listOnly && !Array.isArray(data)) throw new Error('Expected an existing root YAML list.');
  if (kind === 'yaml' && !isRecord(data) && !Array.isArray(data)) {
    throw new Error('Expected an existing YAML mapping or list.');
  }
  assertYamlValue(data);
}

function dateIsValid(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [year, month, day] = date.split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= days[month - 1];
}

function dailyGroups(doc) {
  if (doc?.kind !== 'yaml' || !Array.isArray(doc.data)) throw new Error('Expected a Daily Paper document.');
  return doc.data;
}

function assertDay(day) {
  if (!isRecord(day) || !dateIsValid(day.date) || !Array.isArray(day.papers)) {
    throw new Error('Each date group must have a date and a paper list.');
  }
}

function dailyPaper(doc, dayIndex, paperIndex) {
  if (!Number.isSafeInteger(dayIndex) || dayIndex < 0 || !Number.isSafeInteger(paperIndex) || paperIndex < 0) {
    throw new Error('Invalid paper position.');
  }
  const day = dailyGroups(doc)[dayIndex];
  assertDay(day);
  const paper = day.papers[paperIndex];
  if (!isRecord(paper)) throw new Error('Paper record does not exist or is invalid.');
  return { day, paper };
}

export function createContentModel(yaml) {
  function parse(path, text) {
    if (typeof path !== 'string' || !path || typeof text !== 'string') throw new Error('Expected a path and file text.');
    const kind = /\.ya?ml$/i.test(path) ? 'yaml' : 'frontmatter';
    const parts = kind === 'frontmatter' ? splitFrontmatter(text) : null;
    const yamlText = parts ? parts.metadata : text;
    const body = parts ? parts.body : '';
    let data;
    try {
      data = kind === 'frontmatter' && yamlText.replace(LEADING_YAML, '').trim() === ''
        ? {}
        : yaml.load(yamlText, { schema: yaml.JSON_SCHEMA });
      checkShape(path, kind, data);
    } catch (error) {
      throw new Error(`${path}: ${error.message}`);
    }
    return { path, kind, data, body, originalText: text, originalData: structuredClone(data), originalBody: body };
  }

  function dump(data, originalYaml, eol) {
    // Quote scalar strings so date values and YAML 1.1 booleans stay strings in
    // Jekyll and in the paper metadata script, not just when read by js-yaml.
    const leading = LEADING_YAML.exec(originalYaml)[0];
    return leading + yaml.dump(data, {
      schema: yaml.JSON_SCHEMA, noRefs: true, forceQuotes: true, lineWidth: 120
    }).replace(/\n/g, eol);
  }

  function serialize(doc) {
    if (!doc || typeof doc.body !== 'string' || typeof doc.originalText !== 'string'
      || (doc.kind !== 'yaml' && doc.kind !== 'frontmatter')) {
      throw new Error('Expected a parsed content document.');
    }
    checkShape(doc.path, doc.kind, doc.data);
    if (doc.kind === 'yaml' && doc.body !== '') throw new Error('A YAML document cannot have a separate body.');

    const dataChanged = !equalData(doc.data, doc.originalData);
    if (!dataChanged && doc.body === doc.originalBody) return doc.originalText;

    const eol = EOL.exec(doc.originalText)?.[0] || '\n';
    if (doc.kind === 'yaml') return dump(doc.data, doc.originalText, eol);

    const parts = splitFrontmatter(doc.originalText);
    const opening = parts.opening || (dataChanged ? `---${eol}` : '');
    const metadata = dataChanged ? dump(doc.data, parts.metadata, eol) : parts.metadata;
    let closing = parts.closing || (dataChanged ? `---${eol}` : '');
    if (closing && doc.body && !/[\r\n]$/.test(closing)) closing += eol;
    return opening + metadata + closing + doc.body;
  }

  function flattenDaily(doc) {
    return dailyGroups(doc).flatMap((day, dayIndex) => {
      assertDay(day);
      return day.papers.map((paper, paperIndex) => {
        if (!isRecord(paper)) throw new Error('Invalid paper record.');
        return { id: `${dayIndex}:${paperIndex}`, dayIndex, paperIndex, date: day.date, paper, dayComment: day.comment };
      });
    });
  }

  function updateDaily(doc, dayIndex, paperIndex, values) {
    const { paper } = dailyPaper(doc, dayIndex, paperIndex);
    if (!isRecord(values)) throw new Error('Expected paper fields to update.');
    const changes = Object.entries(values);
    for (const [field, value] of changes) {
      if (!PAPER_FIELDS.has(field) || typeof value !== 'string') {
        throw new Error(`Invalid paper field: ${field}.`);
      }
    }
    for (const [field, value] of changes) paper[field] = value;
    return paper;
  }

  function newDaily(doc, date) {
    if (!dateIsValid(date)) throw new Error('Enter a valid date in YYYY-MM-DD format.');
    const days = dailyGroups(doc);
    for (const day of days) assertDay(day);
    let dayIndex = days.findIndex(day => day.date === date);
    if (dayIndex === -1) {
      dayIndex = days.length;
      days.push({ date, papers: [] });
    }

    const paperIndex = days[dayIndex].papers.length;
    days[dayIndex].papers.push({ title: '', link: '' });
    return { dayIndex, paperIndex };
  }

  function removeDaily(doc, dayIndex, paperIndex) {
    const { day, paper } = dailyPaper(doc, dayIndex, paperIndex);
    day.papers.splice(paperIndex, 1);
    return paper;
  }

  return { parse, serialize, flattenDaily, updateDaily, newDaily, removeDaily };
}
