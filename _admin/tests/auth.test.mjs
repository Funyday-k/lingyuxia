import assert from 'node:assert/strict';
import test from 'node:test';
import { getToken, login, logout } from '../../admin/auth.js';

const SITE = '00000000-0000-0000-0000-000000000000';
const ORIGIN = 'https://api.netlify.com';

function browser({blocked = false} = {}) {
  const listeners = new Set();
  const store = new Map();
  const intervals = new Map();
  const timeouts = new Map();
  const messages = [];
  let url, seq = 0;
  const popup = {
    closed: false,
    focus() {},
    close() { this.closed = true; },
    postMessage(...args) { messages.push(args); },
  };
  globalThis.window = {
    sessionStorage: {
      getItem: (key) => store.get(key),
      setItem: (key, value) => store.set(key, value),
      removeItem: (key) => store.delete(key),
    },
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    setInterval: (fn) => { intervals.set(++seq, fn); return seq; },
    clearInterval: (id) => intervals.delete(id),
    setTimeout: (fn) => { timeouts.set(++seq, fn); return seq; },
    clearTimeout: (id) => timeouts.delete(id),
    open(href) { url = new URL(href); return blocked ? null : popup; },
  };
  function post(data, origin = ORIGIN, source = popup) {
    for (const listener of listeners) listener({ data, origin, source });
  }
  function clean() {
    assert.equal(listeners.size, 0);
    assert.equal(intervals.size, 0);
    assert.equal(timeouts.size, 0);
  }
  return { popup, post, messages, clean, store, intervals, timeouts, url: () => url };
}

test('Netlify handshake checks both trusted origin and exact popup, then keeps token in this session', async () => {
  const { post, popup, messages, url, clean, store } = browser();
  const promise = login(SITE);
  assert.strictEqual(promise, login(SITE));
  assert.equal(url().origin, ORIGIN);
  assert.equal(url().pathname, '/auth');
  assert.equal(url().searchParams.get('provider'), 'github');
  assert.equal(url().searchParams.get('site_id'), SITE);
  assert.equal(url().searchParams.get('scope'), 'public_repo');
  post('authorizing:github', 'https://api.netlify.com.evil.invalid');
  post('authorizing:github', ORIGIN, {});
  post('authorization:github:success:{"token":"wrong_1"}');
  assert.equal(getToken(), null);
  assert.deepEqual(messages, []);
  post('authorizing:github');
  assert.deepEqual(messages, [['authorizing:github', ORIGIN]]);
  post('authorization:github:success:{"token":"wrong_2"}', ORIGIN, {});
  assert.equal(getToken(), null);
  post('authorization:github:success:{"token":"mock_token"}');
  assert.equal(await promise, 'mock_token');
  assert.equal(getToken(), 'mock_token');
  assert.deepEqual([...store.values()], ['mock_token']);
  assert.equal(popup.closed, true);
  clean();
  logout();
  assert.equal(getToken(), null);
  assert.equal(store.size, 0);
});

test('invalid IDs, popup blockers and malformed authorization responses do not retain listeners', async () => {
  let mock = browser({ blocked: true });
  await assert.rejects(login('https://example.invalid'), /Project ID/);
  await assert.rejects(login(SITE), /拦截/);
  mock.clean();
  mock = browser();
  const promise = login(SITE);
  mock.post('authorizing:github');
  mock.post('authorization:github:success:{not JSON}');
  await assert.rejects(promise, /无效结果/);
  mock.clean();
  assert.equal(getToken(), null);
});

test('oauth error, timeout, closed popup and logout all cancel the session and clean up', async () => {
  const cases = [
    [({post}) => { post('authorizing:github'); post('authorization:github:error:{"message":"private provider details"}'); }, /未完成/],
    [({timeouts}) => [...timeouts.values()][0](), /超时/],
    [({intervals,popup}) => { popup.closed = true; [...intervals.values()][0](); }, /已关闭/],
    [() => logout(), /已取消/],
  ];
  for (const [fire, error] of cases) {
    const mock = browser();
    const promise = login(SITE);
    fire(mock);
    await assert.rejects(promise, error);
    mock.clean();
    assert.equal(getToken(), null);
  }
});
