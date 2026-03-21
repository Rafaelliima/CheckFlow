import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

type ThemePreference = 'light' | 'dark';

interface ThemeContextValue {
  theme: ThemePreference;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
const STORAGE_KEY = 'checkflow-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>('light');

  useEffect(() => {
    const storedTheme = window.localStorage.getItem(STORAGE_KEY) as ThemePreference | null;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = (nextTheme: ThemePreference) => {
      setTheme(nextTheme);
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      document.documentElement.style.colorScheme = nextTheme;
    };

    if (storedTheme === 'light' || storedTheme === 'dark') {
      applyTheme(storedTheme);
    } else {
      applyTheme(mediaQuery.matches ? 'dark' : 'light');
    }

    const handleChange = (event: MediaQueryListEvent) => {
      if (!window.localStorage.getItem(STORAGE_KEY)) {
        applyTheme(event.matches ? 'dark' : 'light');
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme,
    toggleTheme: () => {
      const nextTheme: ThemePreference = theme === 'dark' ? 'light' : 'dark';
      window.localStorage.setItem(STORAGE_KEY, nextTheme);
      setTheme(nextTheme);
      document.documentElement.classList.toggle('dark', nextTheme === 'dark');
      document.documentElement.style.colorScheme = nextTheme;
    },
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

const fallbackThemeContext: ThemeContextValue = {
  theme: 'light',
  toggleTheme: () => {},
};

export function useTheme() {
  return useContext(ThemeContext) ?? fallbackThemeContext;
}
