export const THEME_STORAGE_KEY = 'mohanverse-theme';

const isTheme = (value) => value === 'light' || value === 'dark';

export const readStoredTheme = () => {
  try {
    const value = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isTheme(value) ? value : null;
  } catch {
    return null;
  }
};

export const writeStoredTheme = (theme) => {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // The current session still honours the selected theme if storage is unavailable.
  }
};

export const resolveTheme = (systemDark, stored = readStoredTheme()) => (
  stored || (systemDark.matches ? 'dark' : 'light')
);

export const applyTheme = (targetDocument = document, theme = null) => {
  if (isTheme(theme)) targetDocument.documentElement.dataset.theme = theme;
  else targetDocument.documentElement.removeAttribute('data-theme');
  return theme;
};
