import { Marked } from './vendor/marked-18.0.11.esm.js';

const ENTITIES = new Map([
  ['amp', '&'], ['lt', '<'], ['gt', '>'], ['quot', '"'], ['apos', "'"], ['nbsp', '\u00a0'],
  ['colon', ':'], ['Tab', '\t'], ['NewLine', '\n']
]);
const LIQUID = /\{\{|\{%/;
const NETWORK_PROTOCOLS = new Set(['https:', 'http:']);
const LINK_PROTOCOLS = new Set([...NETWORK_PROTOCOLS, 'mailto:']);
const IMAGE_PROTOCOLS = new Set([...NETWORK_PROTOCOLS, 'blob:']);

function readMath(source, displayOnly = false) {
  const opening = /^(\$\$|\\\[|\\\(|\$)/.exec(source)?.[0];
  if (!opening) return;
  const display = opening === '$$' || opening === '\\[';
  if (displayOnly && !display) return;
  const closing = opening === '\\[' ? '\\]' : opening === '\\(' ? '\\)' : opening;
  const singleDollar = opening === '$';
  if (singleDollar && /\s/.test(source[1] ?? '')) return;

  for (let index = opening.length; index < source.length; index++) {
    if (!display && /[\r\n]/.test(source[index])) return;
    if (source.startsWith(closing, index)) {
      const end = index + closing.length;
      if (singleDollar && source[end] === '$') { index++; continue; }
      if (index === opening.length || (singleDollar && (/\s/.test(source[index - 1]) || /\d/.test(source[end] ?? '')))) return;
      return source.slice(0, end);
    }
    if (source[index] === '\\') index++;
  }
}

const markdown = new Marked({
  gfm: true,
  extensions: [{
    name: 'mathBlock',
    level: 'block',
    start(source) {
      // Marked calls start on the remainder after the first character; only
      // a newline there establishes a new block boundary.
      const match = /\n {0,3}(?:\$\$|\\\[)/.exec(source);
      return match ? match.index + 1 : -1;
    },
    tokenizer(source) {
      const indentation = /^ {0,3}/.exec(source)[0];
      const value = readMath(source.slice(indentation.length), true);
      if (!value) return;
      const after = /^[ \t]*(?:\n|$)/.exec(source.slice(indentation.length + value.length));
      if (after) return { type: 'mathBlock', raw: indentation + value + after[0], text: value };
    }
  }, {
    name: 'mathInline',
    level: 'inline',
    start: source => source.search(/\$|\\[([]/),
    tokenizer(source) {
      const value = readMath(source);
      if (value) return { type: 'mathInline', raw: value, text: value };
    }
  }]
});

function decodeEntities(text) {
  return String(text ?? '').replace(/&(?:#(x[\da-f]+|\d+);?|([a-z][\da-z]+);)/gi, (entity, numeric, name) => {
    if (!numeric) return ENTITIES.get(name) ?? entity;
    const value = /^x/i.test(numeric) ? Number.parseInt(numeric.slice(1), 16) : Number(numeric);
    return value > 0 && value <= 0x10ffff && !(value >= 0xd800 && value <= 0xdfff) ? String.fromCodePoint(value) : '\ufffd';
  });
}

function allowedURL(value, base, protocols) {
  if (typeof value !== 'string' || !value.trim() || /[\u0000-\u001f\u007f]/.test(value) || LIQUID.test(value)) return null;
  try {
    const url = new URL(value, base);
    if (protocols.has(url.protocol)) return url;
  } catch { /* An invalid URL is rendered as text. */ }
  return null;
}

function inlineText(tokens) {
  return tokens.map(token => token.tokens ? inlineText(token.tokens)
    : ['html', 'codespan', 'mathInline'].includes(token.type) ? token.text ?? token.raw
      : decodeEntities(token.text ?? token.raw)).join('');
}

export function renderMarkdownPreview(container, text, { resolveAsset, baseURL } = {}) {
  const document = container.ownerDocument;
  const source = String(text ?? '');
  const base = baseURL ?? document.baseURI;
  const output = document.createDocumentFragment();

  function add(parent, name, value) {
    const node = document.createElement(name);
    if (value !== undefined) node.textContent = value;
    parent.append(node);
    return node;
  }

  function append(parent, tokens, tight = false) {
    for (const token of tokens ?? []) {
      switch (token.type) {
        case 'space':
        case 'def':
          break;
        case 'heading':
          append(add(parent, 'h' + Math.max(1, Math.min(6, token.depth))), token.tokens);
          break;
        case 'paragraph':
          append(add(parent, 'p'), token.tokens);
          break;
        case 'strong':
        case 'em':
        case 'del':
        case 'blockquote':
          append(add(parent, token.type), token.tokens);
          break;
        case 'list': {
          const list = add(parent, token.ordered ? 'ol' : 'ul');
          if (token.ordered && Number.isSafeInteger(token.start)) list.start = token.start;
          for (const item of token.items) append(add(list, 'li'), item.tokens, !token.loose);
          break;
        }
        case 'checkbox': {
          const checkbox = add(parent, 'input');
          checkbox.type = 'checkbox';
          checkbox.checked = token.checked;
          checkbox.disabled = true;
          break;
        }
        case 'table': {
          const table = add(parent, 'table');
          function row(section, columns, tag) {
            const tr = add(section, 'tr');
            for (const column of columns) {
              const cell = add(tr, tag);
              if (['left', 'center', 'right'].includes(column.align)) cell.style.textAlign = column.align;
              append(cell, column.tokens);
            }
          }
          row(add(table, 'thead'), token.header, 'th');
          const body = add(table, 'tbody');
          for (const columns of token.rows) row(body, columns, 'td');
          break;
        }
        case 'code': {
          const code = add(add(parent, 'pre'), 'code', token.text);
          const language = token.lang?.split(/\s+/, 1)[0];
          if (/^[a-z0-9_+-]{1,30}$/i.test(language ?? '')) code.className = 'language-' + language;
          break;
        }
        case 'codespan':
          add(parent, 'code', token.text);
          break;
        case 'mathInline':
          add(parent, 'span', token.text);
          break;
        case 'mathBlock':
          add(parent, 'pre', token.text);
          break;
        case 'br':
        case 'hr':
          add(parent, token.type);
          break;
        case 'link': {
          const href = decodeEntities(token.href);
          const url = allowedURL(href, base, LINK_PROTOCOLS);
          if (!url) {
            if (LIQUID.test(href)) parent.append(token.raw);
            else append(parent, token.tokens);
            break;
          }
          const link = add(parent, 'a');
          link.href = url.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          if (token.title) link.title = decodeEntities(token.title);
          append(link, token.tokens);
          break;
        }
        case 'image': {
          const href = decodeEntities(token.href);
          const sourceURL = allowedURL(href, base, NETWORK_PROTOCOLS);
          const alt = token.tokens ? inlineText(token.tokens) : decodeEntities(token.text);
          const url = sourceURL && (resolveAsset
            ? allowedURL(resolveAsset(href), base, IMAGE_PROTOCOLS) : sourceURL);
          if (!url) {
            parent.append(LIQUID.test(href) ? token.raw : alt);
            break;
          }
          const image = add(parent, 'img');
          image.alt = alt;
          image.loading = 'lazy';
          image.decoding = 'async';
          image.referrerPolicy = 'no-referrer';
          if (token.title) image.title = decodeEntities(token.title);
          image.src = url.href;
          break;
        }
        case 'html':
          if (token.block) add(add(parent, 'pre'), 'code', token.raw);
          else parent.append(token.raw);
          break;
        case 'text':
          if (token.tokens) append(tight ? parent : add(parent, 'p'), token.tokens);
          else parent.append(token.escaped ? token.text : decodeEntities(token.text));
          break;
        case 'escape':
          parent.append(token.text);
          break;
        default:
          parent.append(token.raw ?? '');
      }
    }
  }

  try {
    // Use only tokenizer output and DOM primitives. Raw HTML and Liquid are
    // never inserted as markup, even when a preview contains arbitrary source.
    append(output, markdown.lexer(source));
    container.replaceChildren(output);
  } catch {
    container.replaceChildren(add(document.createDocumentFragment(), 'pre', source));
  }
}
