import assert from 'node:assert/strict';
import test from 'node:test';
import { GitHubClient } from '../../admin/github-api.js';

const [A, B, C, T, U, X, Y, M] = ['a','b','c','d','e','f','1','2'].map((c) => c.repeat(40));
const REPO = 'Funyday-k/lingyuxia';
const BRANCH = 'cms-admin/current';
const pr = ({sha = A, branch = BRANCH, number = 12, state = 'open', repo = REPO, base = 'master', ...extra} = {}) => ({
  state, title: 'Example', number, head: { ref: branch, sha, repo: { full_name: repo } }, base: { ref: base }, ...extra,
});
const context = { branch: BRANCH, headSha: A, prNumber: 12, url: `https://github.com/${REPO}/pull/12`, title: 'Example', legacy: false };
const file = { path: '_posts/笔记.md', content: '中文正文' };
const pdf = { path: 'files/uploads/paper.pdf', content: 'AAECAw==', encoding: 'base64' };

function mock(steps) {
  const calls = [];
  const client = new GitHubClient('mock_token', { fetchImpl: async (url, init) => {
    const { pathname, searchParams, origin } = new URL(url);
    const [method, path, reply, bodyCheck] = steps.shift() || [];
    assert.equal(origin, 'https://api.github.com');
    assert.equal(init.headers.Authorization, 'Bearer mock_token');
    assert.equal(init.redirect, 'error');
    const actualPath = decodeURIComponent(pathname).replace(`/repos/${REPO}`, '');
    calls.push({ method: init.method, path: actualPath });
    // Fetch wrappers may replace thrown errors, so expose the mismatch via the recorded calls.
    if (!method || init.method !== method || (typeof path === 'string' && actualPath !== path)) {
      return Response.json({ mismatch: true }, { status: 400 });
    }
    if (typeof path === 'function') path(actualPath, searchParams);
    if (bodyCheck) bodyCheck(JSON.parse(init.body));
    if (reply === 'offline') throw new Error('response lost');
    if (typeof reply === 'function') return reply();
    if (Number.isInteger(reply)) return Response.json({}, { status: reply });
    return Response.json(reply);
  } });
  return { client, calls, done: () => assert.deepEqual(steps, []) };
}
const refs = (sha) => ({ object: { sha } });
const getHead = (branch, sha) => ['GET', `/git/ref/heads/${branch}`, refs(sha)];
const getPr = (data = pr()) => ['GET', '/pulls/12', data];
const createObjects = (files = [file]) => [
  ['GET', `/git/commits/${A}`, { tree: { sha: T } }],
  ...files.map(({ content, encoding }, i) => ['POST', '/git/blobs', { sha: [X,Y][i] }, (body) => assert.deepEqual(body, { content, encoding: encoding || 'utf-8' })]),
  ['POST', '/git/trees', { sha: U }, (body) => assert.deepEqual(body, {
    base_tree: T, tree: files.map(({ path }, i) => ({ path, type: 'blob', mode: '100644', sha: [X,Y][i] })),
  })],
  ['POST', '/git/commits', { sha: B }, (body) => assert.deepEqual(body, { message: 'Update notes', tree: U, parents: [A] })],
];
const save = (client, draft = null, files = [file]) => client.saveDraft({ draft, baseSha: A, files, message: 'Update notes' });

test('new draft commits text and binary together before creating any branch', async () => {
  let branch;
  const { client, done, calls } = mock([
    getHead('master', A),
    ...createObjects([file, pdf]),
    getHead('master', A),
    ['POST', '/git/refs', refs(B), (body) => {
      assert.match(body.ref, /^refs\/heads\/cms-admin\/[\da-f-]{36}$/);
      assert.equal(body.sha, B);
      branch = body.ref.slice('refs/heads/'.length);
    }],
    ['POST', '/pulls', () => Response.json(pr({ branch, sha: B })), (body) => {
      assert.equal(body.head, branch);
      assert.equal(body.base, 'master');
      assert.equal(body.title, 'Update notes');
    }],
  ]);
  const result = await save(client, null, [file,pdf]);
  assert.equal(result.branch, branch);
  assert.equal(result.headSha, B);
  assert.deepEqual(calls.filter((call) => /git\/refs/.test(call.path)), [{ method: 'POST', path: '/git/refs' }]);
  done();
});

test('stale master is rejected before any remote write', async () => {
  const { client, calls, done } = mock([getHead('master', C)]);
  await assert.rejects(save(client), { code: 'CONFLICT' });
  assert.ok(calls.every(({ method }) => method === 'GET'));
  done();
});

test('intermediate upload failure leaves the branch untouched', async () => {
  const { client, calls, done } = mock([getHead('master', A), ...createObjects([file, pdf]).slice(0,2), ['POST', '/git/blobs', 503]]);
  await assert.rejects(save(client, null, [file,pdf]), { status: 503 });
  assert.ok(calls.every(({ path }) => !path.includes('/git/refs')));
  done();
});

test('existing draft saves use one non-forced reference update', async () => {
  const { client, done } = mock([
    getPr(), getHead(BRANCH, A), ...createObjects(), getPr(), getHead(BRANCH, A),
    ['PATCH', `/git/refs/heads/${BRANCH}`, refs(B), (body) => assert.deepEqual(body, { sha: B, force: false })],
  ]);
  assert.deepEqual(await save(client, context), { ...context, headSha: B });
  done();
});

test('draft changed while creating objects stops before updating ref', async () => {
  const { client, calls, done } = mock([getPr(), getHead(BRANCH, A), ...createObjects(), getPr(pr({ sha: C }))]);
  await assert.rejects(save(client, context), { code: 'CONFLICT' });
  assert.ok(calls.every(({ method }) => method !== 'PATCH'));
  done();
});

test('a ref update rejected by GitHub is a conflict if someone advanced the draft', async () => {
  const { client, done } = mock([
    getPr(), getHead(BRANCH, A), ...createObjects(), getPr(), getHead(BRANCH, A),
    ['PATCH', `/git/refs/heads/${BRANCH}`, 422], getHead(BRANCH, C),
  ]);
  await assert.rejects(save(client, context), { code: 'CONFLICT' });
  done();
});

test('lost ref update response reconciles an applied commit and otherwise stops', async () => {
  for (const [sha, expected] of [[B, null], [A, 'UNCERTAIN']]) {
    const { client, calls, done } = mock([
      getPr(), getHead(BRANCH, A), ...createObjects(), getPr(), getHead(BRANCH, A),
      ['PATCH', `/git/refs/heads/${BRANCH}`, 'offline'], getHead(BRANCH, sha),
    ]);
    if (expected) await assert.rejects(save(client, context), { code: expected });
    else assert.equal((await save(client, context)).headSha, B);
    assert.equal(calls.filter(({method}) => method === 'PATCH').length, 1);
    done();
  }
});

test('lost PR creation response recovers the matching PR without creating a duplicate', async () => {
  let branch;
  const { client, done } = mock([
    getHead('master', A), ...createObjects(), getHead('master', A),
    ['POST', '/git/refs', refs(B), ({ref}) => { branch = ref.slice('refs/heads/'.length); }],
    ['POST', '/pulls', 'offline'],
    ['GET', (path, query) => {
      assert.equal(path, '/pulls');
      assert.equal(query.get('head'), 'Funyday-k:' + branch);
    }, () => Response.json([pr({ branch, sha: B })])],
  ]);
  assert.equal((await save(client)).branch, branch);
  done();
});

test('legacy and same-repo native PRs are listed, unrelated and fork branches ignored', async () => {
  const { client, done } = mock([
    ['GET', '/pulls', [pr(), pr({ branch: 'cms/notes/test', number: 13 }), pr({ branch: 'topic/foo' }), pr({ repo: 'another/fork' })]],
  ]);
  const list = await client.listDrafts();
  assert.deepEqual(list.map(({prNumber, legacy}) => [prNumber, legacy]), [[12, false], [13, true]]);
  await assert.rejects(client.publishDraft(list[1]), { message: /只能在 GitHub/ });
  done();
});

test('publish pins PR head, preserves real success and stops on a mismatched head', async () => {
  for (const conflict of [false, true]) {
    const { client, done } = mock([
      getPr(),
      ['PUT', '/pulls/12/merge', conflict ? 409 : { merged: true, sha: M, message: 'Merged' }, (body) => assert.deepEqual(body, { sha: A })],
    ]);
    if (conflict) await assert.rejects(client.publishDraft(context), { code: 'CONFLICT' });
    else assert.deepEqual(await client.publishDraft(context), { merged: true, sha: M, message: 'Merged' });
    done();
  }
});

test('ambiguous publish verifies state without issuing a second merge', async () => {
  const { client, done } = mock([
    getPr(), ['PUT', '/pulls/12/merge', 'offline'],
    getPr(pr({ state: 'closed', merged: true, merge_commit_sha: M })),
  ]);
  assert.equal((await client.publishDraft(context)).sha, M);
  done();
});

test('immutable file reads decode Unicode and recursive lists respect directory boundaries', async () => {
  const { client, done } = mock([
    ['GET', (path, query) => {
      assert.equal(path, '/contents/_posts/笔记.md');
      assert.equal(query.get('ref'), A);
    }, { type: 'file', sha: X, encoding: 'base64', content: Buffer.from(file.content).toString('base64') }],
    ['GET', `/git/commits/${A}`, { tree: { sha: T } }],
    ['GET', `/git/trees/${T}`, { tree: [
      { type: 'blob', path: '_posts/笔记.md', sha: X },
      { type: 'blob', path: '_posts/nested/foo.md', sha: Y },
      { type: 'blob', path: '_posts-other/foo.md', sha: X },
      { type: 'tree', path: '_posts/nested', sha: U },
    ] }],
  ]);
  assert.deepEqual(await client.readFile(file.path, A), { ...file, sha: X });
  assert.deepEqual(await client.listFiles('_posts', A), [{path: file.path, sha: X}, {path: '_posts/nested/foo.md', sha: Y}]);
  done();
});

test('document deletion and text edit are saved in one tree and commit without creating a deletion blob', async () => {
  const deletion = { path: '_posts/old.md', content: null };
  const { client, done, calls } = mock([
    getPr(), getHead(BRANCH, A),
    ['GET', `/git/commits/${A}`, { tree: { sha: T } }],
    ['POST', '/git/blobs', { sha: X }, (body) => assert.deepEqual(body, { content: file.content, encoding: 'utf-8' })],
    ['POST', '/git/trees', { sha: U }, (body) => assert.deepEqual(body, {
      base_tree: T, tree: [
        { path: deletion.path, mode: '100644', type: 'blob', sha: null },
        { path: file.path, mode: '100644', type: 'blob', sha: X },
      ],
    })],
    ['POST', '/git/commits', { sha: B }, (body) => assert.deepEqual(body, { message: 'Update notes', tree: U, parents: [A] })],
    getPr(), getHead(BRANCH, A),
    ['PATCH', `/git/refs/heads/${BRANCH}`, refs(B), (body) => assert.deepEqual(body, { sha: B, force: false })],
  ]);
  assert.equal((await save(client, context, [deletion, file])).headSha, B);
  assert.equal(calls.filter(({path}) => path === '/git/blobs').length, 1);
  done();
});

test('only explicit repository write, maintain, or admin permission opens editing', async () => {
  const cases = [
    [{ push: true }, true],
    [{ maintain: true }, true],
    [{ admin: true }, true],
    [{ pull: true, triage: true, push: false }, false],
    [{ push: 'true', maintain: 1, admin: 'true' }, false],
    [undefined, false],
  ];
  for (const [permissions, canWrite] of cases) {
    const { client, done } = mock([['GET', '', { permissions }]]);
    assert.deepEqual(await client.repositoryAccess(), { canWrite });
    done();
  }
});
