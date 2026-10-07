// Shared language preference for the interactive GR series. First visit: English.
const storageKey = 'gr-series-language';
let language = 'en';
try {
  if (localStorage.getItem(storageKey) === 'zh') language = 'zh';
} catch { /* The switch still works when browser storage is unavailable. */ }

const translations = [...document.querySelectorAll('[data-zh]')].map(element => ({
  element, en: element.innerHTML, zh: element.dataset.zh
}));
const attributes = ['aria-label', 'alt', 'content'].flatMap(attribute =>
  [...document.querySelectorAll(`[data-zh-${attribute}]`)].map(element => ({
    element, attribute, en: element.getAttribute(attribute), zh: element.getAttribute(`data-zh-${attribute}`)
  }))
);

export const getLanguage = () => language;
export const t = (en, zh) => language === 'zh' ? zh : en;

function applyLanguage(next, persist = false) {
  if (!['en', 'zh'].includes(next)) return;
  language = next;
  document.documentElement.lang = next === 'zh' ? 'zh-CN' : 'en';
  translations.forEach(({ element, en, zh }) => { element.innerHTML = next === 'zh' ? zh : en; });
  attributes.forEach(({ element, attribute, en, zh }) => { element.setAttribute(attribute, next === 'zh' ? zh : en); });
  document.querySelectorAll('[data-language]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.language === next));
  });
  if (persist) {
    try { localStorage.setItem(storageKey, next); } catch { /* Session-only preference. */ }
  }
  document.dispatchEvent(new CustomEvent('gr:languagechange', { detail: { language: next } }));
}

document.querySelectorAll('[data-language]').forEach(button => {
  button.addEventListener('click', () => applyLanguage(button.dataset.language, true));
});
window.addEventListener('storage', event => {
  if (event.key === storageKey) applyLanguage(event.newValue === 'zh' ? 'zh' : 'en');
});
applyLanguage(language);
