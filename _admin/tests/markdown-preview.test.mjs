import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import { renderMarkdownPreview } from '../../admin/markdown-preview.js';

const require = createRequire(import.meta.url);
let JSDOM;
try {
  ({ JSDOM } = require(process.env.PREVIEW_JSDOM_PATH || 'jsdom'));
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND' || process.env.PREVIEW_JSDOM_PATH) throw error;
}
const options = { skip: JSDOM ? false : 'Optional DOM test dependency: install jsdom or set PREVIEW_JSDOM_PATH.' };
const baseURL = 'https://example.org/lingyuxia/';

function preview(source, renderOptions = {}) {
  const dom = new JSDOM('<main></main>', { url: baseURL });
  const container = dom.window.document.querySelector('main');
  renderMarkdownPreview(container, source, renderOptions);
  return container;
}

test('renders standard Markdown and replaces the previous preview', options, () => {
  const source = [
    '# Heading', '',
    '**Bold** *italic* ~~out~~ and `<code>` &amp; $x^2$.', '',
    '[Guide](guide/ "A title")', '',
    '3. One', '4. Two', '   - Nested', '',
    '- [x] Done', '- [ ] To do', '',
    '| Name | Count |', '| :--- | ---: |', '| Alpha | **2** |', '',
    '> Quoted', '',
    '```js', 'const x = "<script>";', '```'
  ].join('\n');
  const container = preview(source);
  assert.equal(container.querySelector('h1').textContent, 'Heading');
  assert.equal(container.querySelector('strong').textContent, 'Bold');
  assert.equal(container.querySelector('em').textContent, 'italic');
  assert.equal(container.querySelector('del').textContent, 'out');
  assert.equal(container.querySelector('p code').textContent, '<code>');
  assert.match(container.textContent, /& \$x\^2\$/);
  const link = container.querySelector('a');
  assert.equal(link.href, baseURL + 'guide/');
  assert.equal(link.title, 'A title');
  assert.equal(link.rel, 'noopener noreferrer');
  assert.equal(container.querySelector('ol').start, 3);
  assert.equal(container.querySelector('ol li ul li').textContent, 'Nested');
  assert.deepEqual([...container.querySelectorAll('input')].map(input => [input.checked, input.disabled]), [[true, true], [false, true]]);
  assert.equal(container.querySelector('thead th').textContent, 'Name');
  assert.equal(container.querySelector('tbody td:last-child').style.textAlign, 'right');
  assert.equal(container.querySelector('tbody strong').textContent, '2');
  assert.equal(container.querySelector('blockquote p').textContent, 'Quoted');
  assert.equal(container.querySelector('pre code').className, 'language-js');
  assert.equal(container.querySelector('pre code').textContent, 'const x = "<script>";');

  renderMarkdownPreview(container, '## Second');
  assert.equal(container.querySelector('h1'), null);
  assert.equal(container.querySelector('h2').textContent, 'Second');
});

test('resolves draft images while rejecting unsafe input and resolver output', options, () => {
  const calls = [];
  const draftBlob = 'blob:https://example.org/02d94bf3-4c83-4c31-ad89-0ba4c5f0db7e';
  const container = preview(
    '![Good **draft**](/lingyuxia/images/draft.png) ![HTTP](https://images.example.org/test.png) ![Bad](javascript:bad) ![Data](data:image/png;base64,QQ==) ![Bad resolver](/other.png)',
    { resolveAsset: path => {
      calls.push(path);
      if (path.endsWith('/draft.png')) return draftBlob;
      if (path.endsWith('/other.png')) return 'data:image/svg+xml,%3Csvg%3E';
      return path;
    }, baseURL }
  );
  assert.deepEqual(calls, ['/lingyuxia/images/draft.png', 'https://images.example.org/test.png', '/other.png']);
  const images = [...container.querySelectorAll('img')];
  assert.deepEqual(images.map(image => image.src), [draftBlob, 'https://images.example.org/test.png']);
  assert.equal(images[0].alt, 'Good draft');
  assert.equal(images[0].referrerPolicy, 'no-referrer');
});

test('keeps raw HTML and Liquid literal and rejects active URLs', options, () => {
  const source = [
    '[direct](JaVaScRiPt:alert(1)) [entity](javascript&colon;alert(1))',
    '[numeric](jav&#x61;script&#58;alert(1)) [control](java&Tab;script:alert(1))',
    '[data](data:text/html,%3Cscript%3Ealert(1)%3C/script%3E)',
    '[file](file:///tmp/x) [blob](blob:https://example.org/1)', '',
    '<script>window.executed = true</script>', '',
    '<img src=x onerror="window.executed = true">', '',
    '<svg onload="window.executed = true"></svg>', '',
    '<iframe srcdoc="<script>window.executed = true</script>"></iframe>', '',
    'inline <a href="javascript:alert(1)" onclick="alert(1)">tag</a>', '',
    '{{ site.title }} {% include "partial.html" %}',
    '![Liquid]({{site.baseurl}}/draft.png)'
  ].join('\n');
  const container = preview(source);
  assert.equal(container.querySelector('script,img,svg,iframe,a,[onclick],[onerror],[onload]'), null);
  assert.match(container.textContent, /direct entity/);
  assert.match(container.textContent, /<script>window\.executed = true<\/script>/);
  assert.match(container.textContent, /\{\{ site\.title \}\} \{% include "partial\.html" %\}/);
  assert.match(container.textContent, /!\[Liquid\]\(\{\{site\.baseurl\}\}\/draft\.png\)/);
});

test('preserves inline and displayed TeX exactly as typed', options, () => {
  const inlineDollar = String.raw`$0.496 < m_a < 3.32\,\mathrm{eV} + x_* y_* + \$1$`;
  const inlineParen = String.raw`\(\mathrm{eV}\,m_a * x_y * z\)`;
  const inlineDisplay = String.raw`$$\mathrm{GeV}\,x_a * x_b$$`;
  const displayDollar = ['$$', String.raw`\begin{aligned}m_a &= x_*\,y_a\\ b &= \mathrm{eV}\end{aligned}`, '$$'].join('\n');
  const displayBracket = [String.raw`\[`, String.raw`a_* \times x_b \quad <script>literal</script>`, String.raw`\]`].join('\n');
  const source = [
    `Before ${inlineDollar} and ${inlineParen} and ${inlineDisplay} after.`,
    `A${inlineDisplay}`,
    displayDollar,
    displayBracket,
    'Prices are $5 and $10.',
    '```tex\n' + inlineParen + '\n```'
  ].join('\n\n');
  const container = preview(source);
  assert.deepEqual([...container.querySelectorAll('p span')].map(node => node.textContent), [inlineDollar, inlineParen, inlineDisplay, inlineDisplay]);
  assert.deepEqual([...container.querySelectorAll('pre')].map(node => node.textContent), [displayDollar, displayBracket, inlineParen]);
  assert.equal(container.querySelectorAll('em, strong, script').length, 0);
  assert.match(container.textContent, /Prices are \$5 and \$10\./);
});
