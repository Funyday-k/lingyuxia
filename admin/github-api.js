const API = 'https://api.github.com';
const DEFAULT_REPO = 'Funyday-k/lingyuxia';
const ADMIN_PREFIX = 'cms-admin/';
const LEGACY_PREFIX = 'cms/';
const SHA = /^[a-f0-9]{40}$/i;

export class GitHubError extends Error {
  constructor(message, { status = null, code = 'GITHUB', url = null } = {}) {
    super(message);
    this.name = 'GitHubError';
    this.status = status;
    this.code = code;
    this.url = url;
  }
}

function conflict(message = '草稿已在 GitHub 上更新。请保留当前输入，重新打开草稿后再继续。') {
  return new GitHubError(message, { status: 409, code: 'CONFLICT' });
}

function invalidResult() {
  return new GitHubError('GitHub 返回的数据格式不正确，请刷新后重试。', { code: 'RESPONSE' });
}

function checkedSha(value) {
  if (typeof value !== 'string' || !SHA.test(value)) throw invalidResult();
  return value;
}

function pathParts(path) {
  if (typeof path !== 'string' || !path ||
      path.split('/').some((part) => !part || part === '.' || part === '..' || /[\u0000-\u001f\\]/.test(part))) {
    throw new TypeError('文件路径无效。');
  }
  return path.split('/');
}

function encodedPath(path) {
  return pathParts(path).map(encodeURIComponent).join('/');
}

function pullNumber(value) {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number <= 0) throw new TypeError('草稿编号无效。');
  return number;
}

function utf8FromBase64(value) {
  const decoded = atob(value.replace(/\s/g, ''));
  const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
}

function responseError(status) {
  const messages = {
    401: 'GitHub 登录已失效，请退出后重新登录。',
    403: 'GitHub 拒绝了请求。请检查账户权限，或稍后重试。',
    404: 'GitHub 找不到对应的文件、分支或草稿。',
    405: 'GitHub 目前无法合并草稿。请在 GitHub 上检查冲突、分支规则或审核要求。',
    409: 'GitHub 上的内容发生冲突，请刷新后查看最新状态。',
    422: 'GitHub 无法接受此操作。请检查草稿状态、改动或仓库规则。',
    429: 'GitHub 请求过于频繁，请稍后重试。',
  };
  return new GitHubError(messages[status] || `GitHub 请求失败（HTTP ${status}）。`, { status });
}

function mayHaveApplied(error) {
  return error.code === 'NETWORK' || error.code === 'RESPONSE' || error.status >= 500;
}

export class GitHubClient {
  #token;
  #fetch;
  #repoPath;

  constructor(token, { fetchImpl = globalThis.fetch?.bind(globalThis), repo = DEFAULT_REPO, branch = 'master' } = {}) {
    if (typeof token !== 'string' || !token || /\s/.test(token)) throw new TypeError('请先登录 GitHub。');
    if (typeof repo !== 'string' || !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
      throw new TypeError('GitHub 仓库名无效。');
    }
    if (typeof fetchImpl !== 'function') throw new TypeError('浏览器不支持发起请求。');
    pathParts(repo);
    pathParts(branch);
    this.repo = repo;
    this.branch = branch;
    this.#token = token;
    this.#fetch = fetchImpl;
    this.#repoPath = `/repos/${encodedPath(repo)}`;
  }

  async #request(path, { method = 'GET', body } = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    try {
      let response;
      try {
        response = await this.#fetch(API + path, {
          method,
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${this.#token}`,
            'X-GitHub-Api-Version': '2022-11-28',
            ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          cache: 'no-store',
          credentials: 'omit',
          redirect: 'error',
          signal: controller.signal,
        });
      } catch {
        throw new GitHubError('无法连接 GitHub，请检查网络后重试。', { code: 'NETWORK' });
      }
      if (!response.ok) throw responseError(response.status);
      try {
        return { data: await response.json(), headers: response.headers };
      } catch {
        throw invalidResult();
      }
    } finally {
      clearTimeout(timeout);
    }
  }

  async #repo(path, options) {
    return (await this.#request(this.#repoPath + path, options)).data;
  }

  async #pages(path, params = {}) {
    const rows = [];
    for (let page = 1; ; page++) {
      const query = new URLSearchParams({ ...params, per_page: '100', page: String(page) });
      const { data, headers } = await this.#request(`${this.#repoPath}${path}?${query}`);
      if (!Array.isArray(data)) throw invalidResult();
      rows.push(...data);
      if (!/;\s*rel="next"/.test(headers?.get('link') || '')) return rows;
    }
  }

  async user() {
    const { data } = await this.#request('/user');
    if (typeof data?.login !== 'string' || !data.login) throw invalidResult();
    return { login: data.login };
  }

  async repositoryAccess() {
    const { permissions } = (await this.#repo('')) ?? {};
    return {
      canWrite: permissions?.push === true || permissions?.admin === true || permissions?.maintain === true,
    };
  }

  async head(ref = this.branch) {
    const data = await this.#repo(`/git/ref/heads/${encodedPath(ref)}`);
    return checkedSha(data?.object?.sha);
  }

  async readFile(path, ref = this.branch) {
    const query = new URLSearchParams({ ref });
    const file = await this.#repo(`/contents/${encodedPath(path)}?${query}`);
    if (file?.type !== 'file') throw new GitHubError('所选路径不是普通文件。');
    const sha = checkedSha(file.sha);
    const blob = file.encoding === 'none' ? await this.#repo(`/git/blobs/${sha}`) : file;
    if (blob?.encoding !== 'base64' || typeof blob.content !== 'string') throw invalidResult();
    try {
      return { path, sha, content: utf8FromBase64(blob.content) };
    } catch {
      throw new GitHubError('所选文件不是有效的 UTF-8 文本。');
    }
  }

  async listFiles(prefix = '', ref = this.branch) {
    const clean = prefix.replace(/\/$/, '');
    if (clean) pathParts(clean);
    const sha = SHA.test(ref) ? ref : await this.head(ref);
    const commit = await this.#repo(`/git/commits/${sha}`);
    const treeSha = checkedSha(commit?.tree?.sha);
    const tree = await this.#repo(`/git/trees/${treeSha}?recursive=1`);
    if (!Array.isArray(tree?.tree)) throw invalidResult();
    const matches = (path) => !clean || path === clean || path.startsWith(clean + '/');
    const file = ({ path, sha }) => ({ path, sha });
    if (!tree.truncated) {
      return tree.tree.filter((entry) => entry.type === 'blob' && matches(entry.path)).map(file);
    }

    // A large Git tree can be truncated. Traverse only subtrees that can contain the requested prefix.
    const rows = [];
    const queue = [{ path: '', sha: treeSha }];
    while (queue.length) {
      const current = queue.pop();
      const listing = await this.#repo(`/git/trees/${current.sha}`);
      if (!Array.isArray(listing?.tree) || listing.truncated) {
        throw new GitHubError('GitHub 返回的目录列表不完整，请缩小查询范围。');
      }
      for (const entry of listing.tree) {
        const path = current.path ? `${current.path}/${entry.path}` : entry.path;
        if (entry.type === 'blob' && matches(path)) rows.push({ path, sha: entry.sha });
        if (entry.type === 'tree' && (matches(path) || clean.startsWith(path + '/'))) {
          queue.push({ path, sha: checkedSha(entry.sha) });
        }
      }
    }
    return rows;
  }

  #draft(pr) {
    const branch = pr?.head?.ref;
    if (pr?.state !== 'open' || pr.base?.ref !== this.branch || typeof branch !== 'string' ||
        pr.head?.repo?.full_name?.toLowerCase() !== this.repo.toLowerCase() ||
        (!branch.startsWith(ADMIN_PREFIX) && !branch.startsWith(LEGACY_PREFIX))) return null;

    const prNumber = pullNumber(pr.number);
    return {
      branch,
      headSha: checkedSha(pr.head.sha),
      prNumber,
      url: `https://github.com/${encodedPath(this.repo)}/pull/${prNumber}`,
      title: pr.title,
      legacy: branch.startsWith(LEGACY_PREFIX),
    };
  }

  async listDrafts() {
    const list = await this.#pages('/pulls', { state: 'open', base: this.branch, sort: 'updated', direction: 'desc' });
    return list.map((pr) => this.#draft(pr)).filter(Boolean);
  }

  async openDraft(number) {
    const draft = this.#draft(await this.#repo(`/pulls/${pullNumber(number)}`));
    if (!draft) throw conflict('这个草稿已关闭，或已不再指向当前网站分支。请刷新草稿列表。');
    return draft;
  }

  async listDraftFiles(number) {
    const files = await this.#pages(`/pulls/${pullNumber(number)}/files`);
    return files.map(({ filename, sha, status }) => ({ path: filename, sha, status }));
  }

  #writableDraft(draft) {
    if (draft?.legacy || typeof draft?.branch !== 'string' || !draft.branch.startsWith(ADMIN_PREFIX)) {
      throw new GitHubError('这个草稿只能在 GitHub 上查看和处理。');
    }
    pullNumber(draft.prNumber);
    checkedSha(draft.headSha);
  }

  async #verifyDraft(draft) {
    const current = await this.openDraft(draft.prNumber);
    if (current.legacy || current.branch !== draft.branch || current.headSha !== draft.headSha) throw conflict();
    return current;
  }

  async #verifyBase(draft, baseSha) {
    const branch = draft?.branch || this.branch;
    let current;
    try {
      current = await this.head(branch);
    } catch (error) {
      if (draft && error.status === 404) throw conflict();
      throw error;
    }
    if (current !== baseSha) {
      if (draft) throw conflict();
      throw conflict('网站内容已在 GitHub 上更新。请保留当前输入，刷新并核对最新内容后重新保存。');
    }
  }

  async saveDraft({ draft = null, baseSha, files, message }) {
    checkedSha(baseSha);
    if (draft) {
      this.#writableDraft(draft);
      if (draft.headSha !== baseSha) throw conflict();
      draft = await this.#verifyDraft(draft);
    }
    if (!Array.isArray(files) || !files.length || typeof message !== 'string' || !message.trim()) {
      throw new TypeError('请提供要保存的文件和改动说明。');
    }
    const paths = new Set();
    for (const { path, content, encoding = 'utf-8' } of files) {
      pathParts(path);
      if (paths.has(path) ||
          (content !== null && (typeof content !== 'string' || !['utf-8', 'base64'].includes(encoding)))) {
        throw new TypeError('待保存文件重复，或文件编码不受支持。');
      }
      paths.add(path);
    }

    await this.#verifyBase(draft, baseSha);
    const base = await this.#repo(`/git/commits/${baseSha}`);
    const baseTree = checkedSha(base?.tree?.sha);
    const entries = [];
    for (const { path, content, encoding = 'utf-8' } of files) {
      let sha = null;
      if (content !== null) {
        const blob = await this.#repo('/git/blobs', { method: 'POST', body: { content, encoding } });
        sha = checkedSha(blob?.sha);
      }
      entries.push({ path, mode: '100644', type: 'blob', sha });
    }
    const tree = await this.#repo('/git/trees', {
      method: 'POST',
      body: { base_tree: baseTree, tree: entries },
    });
    const treeSha = checkedSha(tree?.sha);
    if (treeSha === baseTree) {
      if (draft) return this.#verifyDraft(draft);
      throw new GitHubError('没有需要保存的改动。', { code: 'NO_CHANGES' });
    }
    const commit = await this.#repo('/git/commits', {
      method: 'POST',
      body: { message: message.trim(), tree: treeSha, parents: [baseSha] },
    });
    const commitSha = checkedSha(commit?.sha);

    // Blob, tree and commit objects do not alter a branch. Check the base again before moving a ref.
    if (draft) draft = await this.#verifyDraft(draft);
    await this.#verifyBase(draft, baseSha);
    if (draft) {
      const ref = `/git/refs/heads/${encodedPath(draft.branch)}`;
      try {
        const updated = await this.#repo(ref, { method: 'PATCH', body: { sha: commitSha, force: false } });
        if (updated?.object?.sha !== commitSha) throw invalidResult();
      } catch (error) {
        if (![409, 422, 404].includes(error.status) && !mayHaveApplied(error)) throw error;
        let current;
        try { current = await this.head(draft.branch); } catch { /* Report the uncertain result below. */ }
        if (current && current !== commitSha && current !== baseSha) throw conflict();
        if (current !== commitSha) {
          if (!mayHaveApplied(error) && current === baseSha) throw error;
          throw new GitHubError('无法确认草稿是否已保存。请打开 GitHub 或刷新草稿列表检查后再试。', {
            code: 'UNCERTAIN', url: draft.url,
          });
        }
      }
      return { ...draft, headSha: commitSha };
    }

    const branch = `${ADMIN_PREFIX}${globalThis.crypto.randomUUID()}`;
    const branchUrl = `https://github.com/${encodedPath(this.repo)}/tree/${encodedPath(branch)}`;
    try {
      const created = await this.#repo('/git/refs', {
        method: 'POST', body: { ref: `refs/heads/${branch}`, sha: commitSha },
      });
      if (created?.object?.sha !== commitSha) throw invalidResult();
    } catch (error) {
      if (!mayHaveApplied(error)) throw error;
      let current;
      try { current = await this.head(branch); } catch { /* Report the uncertain result below. */ }
      if (current !== commitSha) {
        throw new GitHubError(`无法确认草稿分支是否已保存（${branch}）。请在 GitHub 上检查后再试。`, {
          code: 'UNCERTAIN', url: branchUrl,
        });
      }
    }

    const title = Array.from(message.trim().split(/\r?\n/, 1)[0]).slice(0, 100).join('');
    try {
      const pr = await this.#repo('/pulls', {
        method: 'POST',
        body: { title, head: branch, base: this.branch, body: 'Created from the website admin.' },
      });
      const opened = this.#draft(pr);
      if (opened?.headSha === commitSha) return opened;
      throw invalidResult();
    } catch (error) {
      const [owner] = this.repo.split('/');
      try {
        const prs = await this.#pages('/pulls', { state: 'open', head: `${owner}:${branch}`, base: this.branch });
        const found = prs.map((pr) => this.#draft(pr))
          .find((item) => item?.branch === branch && item.headSha === commitSha);
        if (found) return found;
      } catch { /* The branch URL remains available for recovery. */ }
      throw new GitHubError(`内容已保存到 GitHub 分支 ${branch}，但未确认草稿请求已创建。请在 GitHub 上检查此分支。`, {
        status: error.status, code: 'UNCERTAIN', url: branchUrl,
      });
    }
  }

  async publishDraft(draft) {
    this.#writableDraft(draft);
    const current = await this.#verifyDraft(draft);
    const path = `/pulls/${current.prNumber}`;
    try {
      const result = await this.#repo(path + '/merge', { method: 'PUT', body: { sha: current.headSha } });
      if (result?.merged === false) throw responseError(405);
      if (result?.merged !== true) throw invalidResult();
      return { merged: true, sha: checkedSha(result.sha), message: result.message };
    } catch (error) {
      if (error.status === 409) throw conflict();
      if (!mayHaveApplied(error)) throw error;
      let pr;
      try { pr = await this.#repo(path); } catch { /* Report the uncertain result below. */ }
      if (pr?.merged && pr.head?.sha === current.headSha && pr.base?.ref === this.branch &&
          SHA.test(pr.merge_commit_sha || '')) {
        return { merged: true, sha: pr.merge_commit_sha, message: 'GitHub 已确认合并。' };
      }
      throw new GitHubError('无法确认草稿是否已发布。请在 GitHub 上检查合并状态后再试。', {
        code: 'UNCERTAIN', url: current.url,
      });
    }
  }
}
