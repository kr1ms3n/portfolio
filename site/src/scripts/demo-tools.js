import {
  applyTheme as applyDocumentTheme,
  readStoredTheme,
  resolveTheme,
  writeStoredTheme,
} from '@/scripts/theme.js';

export const applyDemoTheme = (targetDocument = document) => {
  applyDocumentTheme(targetDocument, readStoredTheme());
};

const applyTheme = (root, theme, toggle, label) => {
  root.dataset.theme = theme;
  toggle.setAttribute('aria-pressed', String(theme === 'dark'));
  toggle.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  label.textContent = theme === 'dark' ? 'Dark' : 'Light';
};

export const setupDemoTools = () => {
  const root = document.documentElement;
  const toggle = document.querySelector('[data-demo-theme]');
  const themeLabel = document.querySelector('[data-demo-theme-label]');
  const reset = document.querySelector('[data-demo-reset]');
  const hasTheme = toggle instanceof HTMLButtonElement && themeLabel instanceof HTMLElement;
  const hasReset = reset instanceof HTMLButtonElement;
  if (!hasTheme && !hasReset) return;

  const systemDark = hasTheme ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const toolRoot = toggle?.closest('.demo-tools') || reset?.closest('.demo-tools');
  const sync = () => {
    if (hasTheme) applyTheme(root, resolveTheme(systemDark), toggle, themeLabel);
  };
  if (toolRoot?.dataset.ready === 'true') {
    sync();
    return;
  }

  const onThemeChange = () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    writeStoredTheme(next);
    applyTheme(root, next, toggle, themeLabel);
  };

  const onReset = () => {
    const event = new CustomEvent('demo:reset', { cancelable: true });
    window.dispatchEvent(event);
    if (!event.defaultPrevented) {
      window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
  };

  if (toolRoot) toolRoot.dataset.ready = 'true';
  sync();
  const controller = new AbortController();
  const { signal } = controller;
  if (hasTheme) {
    toggle.addEventListener('click', onThemeChange, { signal });
    systemDark.addEventListener('change', sync, { signal });
  }
  if (hasReset) reset.addEventListener('click', onReset, { signal });
  document.addEventListener('astro:before-swap', () => controller.abort(), { once: true });
};
