const NETLIFY_ORIGIN = 'https://api.netlify.com';
const PROVIDER = 'github';
const HANDSHAKE = 'authorizing:github';
const SUCCESS = 'authorization:github:success:';
const FAILURE = 'authorization:github:error:';
const SESSION_KEY = 'lingyuxia.admin.github-token';
const SITE_ID = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

let token = null;
let pendingLogin = null;
let cancelLogin = null;

const validToken = (value) => typeof value === 'string' && /^[a-zA-Z0-9_]+$/.test(value);

export function getToken() {
  if (token) return token;
  try {
    const stored = window.sessionStorage.getItem(SESSION_KEY);
    return validToken(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function logout() {
  cancelLogin?.();
  token = null;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // The in-memory session has already been cleared.
  }
}

export function login(siteId) {
  if (pendingLogin) return pendingLogin;
  if (typeof siteId !== 'string' || !SITE_ID.test(siteId.trim())) {
    return Promise.reject(new Error('请先在网站配置中填写有效的 Netlify Project ID。'));
  }

  const url = new URL('/auth', NETLIFY_ORIGIN);
  url.search = new URLSearchParams({ provider: PROVIDER, site_id: siteId.trim(), scope: 'public_repo' });

  const request = new Promise((resolve, reject) => {
    let popup = null;
    let closedCheck = null;
    let timeout = null;
    let handshaken = false;

    function finish(error, value) {
      window.removeEventListener('message', onMessage);
      if (closedCheck !== null) window.clearInterval(closedCheck);
      if (timeout !== null) window.clearTimeout(timeout);
      cancelLogin = null;
      try { popup?.close(); } catch { /* The popup may already be closed. */ }
      if (error) {
        reject(error);
      } else {
        token = value;
        try { window.sessionStorage.setItem(SESSION_KEY, token); } catch { /* Keep this tab signed in. */ }
        resolve(value);
      }
    }

    // Netlify's provider popup first sends a handshake and expects its echo.
    function onMessage(event) {
      if (!popup || event.origin !== NETLIFY_ORIGIN || event.source !== popup ||
          typeof event.data !== 'string') return;
      if (event.data === HANDSHAKE) {
        try {
          popup.postMessage(HANDSHAKE, NETLIFY_ORIGIN);
          handshaken = true;
        } catch {
          finish(new Error('无法与 GitHub 登录窗口通信，请重新登录。'));
        }
        return;
      }
      if (!handshaken) return;
      if (event.data.startsWith(FAILURE)) {
        finish(new Error('GitHub 授权未完成。请检查 Netlify 的 GitHub OAuth 配置，或重新登录。'));
      } else if (event.data.startsWith(SUCCESS)) {
        let value;
        try { value = JSON.parse(event.data.slice(SUCCESS.length))?.token; } catch { /* Rejected below. */ }
        if (validToken(value)) {
          finish(null, value);
        } else {
          finish(new Error('GitHub 授权返回了无效结果，请重新登录。'));
        }
      }
    }

    window.addEventListener('message', onMessage);
    try {
      popup = window.open(url.href, '_blank', 'popup,width=960,height=660');
    } catch {
      // Some browsers throw instead of returning null when they block a popup.
    }
    if (!popup) {
      finish(new Error('浏览器拦截了登录窗口。请允许此页面弹出窗口后重试。'));
      return;
    }

    cancelLogin = () => finish(new Error('已取消 GitHub 登录。'));
    closedCheck = window.setInterval(() => {
      if (popup.closed) finish(new Error('登录窗口已关闭，请重新登录。'));
    }, 350);
    timeout = window.setTimeout(() => {
      finish(new Error('GitHub 登录超时，请重新登录。'));
    }, 180_000);
    try { popup.focus(); } catch { /* Focus is optional. */ }
  });

  pendingLogin = request.finally(() => { pendingLogin = null; });
  return pendingLogin;
}
