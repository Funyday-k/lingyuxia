import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { createContentModel } from '../../admin/content-model.js';

const require = createRequire(import.meta.url);
const root = new URL('../../', import.meta.url);
const yaml = require('../../admin/vendor/js-yaml-4.1.1.min.js');
const model = createContentModel(yaml);
const files = ['_data/daily_papers.yml', '_data/notes.yml', '_config.yml', '_data/site_admin.yml'];
for (const dir of ['_pages', '_posts', '_portfolio', '_publications']) {
  const entries = fs.readdirSync(new URL(dir + '/', root), { recursive: true, withFileTypes: true });
  for (const item of entries) {
    if (item.isFile() && /\.(?:md|markdown|html)$/i.test(item.name)) {
      files.push(item.parentPath.replace(new URL('.', root).pathname.replace(/\/$/, ''), '').replace(/^\//, '') + '/' + item.name);
    }
  }
}
for (const path of files) {
  const text = fs.readFileSync(new URL(path, root), 'utf8');
  const original = model.parse(path, text);
  assert.equal(model.serialize(original), text, path);
  if (!Array.isArray(original.data)) {
    const edited = { ...original, data: { ...original.data, title: 'New title: 测试\nline', '__additional': ['no', 'off', '2026-11-11'] } };
    const serialized = model.serialize(edited);
    const parsed = model.parse(path, serialized);
    assert.equal(parsed.body, original.body, path);
    assert.deepEqual(parsed.data, edited.data, path);
    if (original.kind === 'frontmatter') {
      assert.ok(model.serialize({ ...original, body: original.body + '\n{{ site.baseurl }}\n' }).startsWith(text), path);
    }
  }
}

const dailyPath = files[0];
const daily = model.parse(dailyPath, fs.readFileSync(new URL(dailyPath, root), 'utf8'));
const snapshots = structuredClone(daily.data);
const flattened = model.flattenDaily(daily);
assert.deepEqual(daily.data, snapshots);
assert.ok(flattened.length > 0);
const first = flattened[0];
model.updateDaily(daily, first.dayIndex, first.paperIndex, { comment: 'My comment\n第二行' });
assert.deepEqual(daily.data, snapshots.map((day, di) => di !== first.dayIndex ? day : {
  ...day, papers: day.papers.map((paper, pi) => pi === first.paperIndex ? { ...paper, comment: 'My comment\n第二行' } : paper)
}));
assert.throws(() => model.updateDaily(daily, first.dayIndex, first.paperIndex, { comment: 'wrong', date: first.date }));
assert.equal(first.paper.comment, 'My comment\n第二行');
assert.throws(() => model.updateDaily(daily, first.dayIndex, first.paperIndex, { title: null }));
assert.throws(() => model.newDaily(daily, '2026-02-29'));
const newOnFirst = model.newDaily(daily, first.date);
assert.equal(newOnFirst.dayIndex, first.dayIndex);
assert.equal(newOnFirst.paperIndex, snapshots[first.dayIndex].papers.length);
const added = model.newDaily(daily, '2028-02-29');
assert.equal(added.dayIndex, snapshots.length);
assert.deepEqual(model.removeDaily(daily, added.dayIndex, added.paperIndex), { title: '', link: '' });
assert.deepEqual(daily.data[added.dayIndex], { date: '2028-02-29', papers: [] });
const editedDaily = model.serialize(daily);
assert.match(editedDaily, /date: '2028-02-29'/);
assert.deepEqual(model.parse(dailyPath, editedDaily).data, daily.data);
assert.throws(() => model.parse(dailyPath, 'items: []\n'), /root YAML list/);
assert.throws(() => model.parse('_pages/bad.md', '---\nfoo: 1\n'), /closing/);
assert.throws(() => model.parse('_pages/bad.md', '---\nfoo: [bad\n---\n'), /bad|end of the stream|flow/i);
assert.throws(() => model.parse('_config.yml', 'loop: &test [*test]'), /cannot be saved/);

const original = '\uFEFF--- \r\n# original comment\r\nlayout: \'single\'\r\n---\t\r\n\r\n{{ site.title }}\r\n<!-- body -->\r\n---\r\n';
const windows = model.parse('_pages/windows.html', original);
assert.equal(model.serialize(windows), original);
assert.equal(model.serialize({ ...windows, body: 'new body' }), original.slice(0, -windows.body.length) + 'new body');
windows.data.title = 'New title';
const editedWindows = model.serialize(windows);
assert.match(editedWindows, /^\uFEFF--- \r\n# original comment\r\n/);
assert.ok(editedWindows.endsWith(windows.body));
assert.ok(!editedWindows.replaceAll('\r\n', '').includes('\n'));
console.log(`Verified ${files.length} actual content files, ${flattened.length} paper records, and malformed YAML/front matter cases.`);
