import { useCallback, useEffect, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

const THEME_STORAGE_KEY = 'theme';
const THEME_CHANGE_EVENT = 'theme-change';

const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark' || value === 'system';

const getStoredTheme = (): Theme => {
  const local = localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(local) ? local : 'system';
};

export default function useDarkMode() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);

  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>('light');

  const setTheme = useCallback((nextTheme: Theme) => {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setThemeState(nextTheme);
    window.dispatchEvent(new CustomEvent<Theme>(THEME_CHANGE_EVENT, { detail: nextTheme }));
  }, []);

  useEffect(() => {
    const syncTheme = (nextTheme: string | null) => {
      if (isTheme(nextTheme)) {
        setThemeState(nextTheme);
        return;
      }
      setThemeState(getStoredTheme());
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key === THEME_STORAGE_KEY) {
        syncTheme(event.newValue);
      }
    };

    const handleThemeChange = (event: Event) => {
      const customEvent = event as CustomEvent<Theme>;
      syncTheme(customEvent.detail ?? null);
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener(THEME_CHANGE_EVENT, handleThemeChange);
    };
  }, []);

  useEffect(() => {
    const root = window.document.documentElement;

    const applyTheme = (t: Theme) => {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const isDark = t === 'dark' || (t === 'system' && systemDark);
      
      const finalTheme = isDark ? 'dark' : 'light';
      setResolvedTheme(finalTheme);

      if (finalTheme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
      }
    };

    applyTheme(theme);
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = () => applyTheme('system');
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [theme]);

  return [resolvedTheme, setTheme, theme] as const;
}
