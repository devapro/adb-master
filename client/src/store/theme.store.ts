import { create } from 'zustand';

type ThemeMode = 'dark' | 'light';

interface ThemeStore {
  mode: ThemeMode;
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

function getInitialTheme(): ThemeMode {
  const stored = localStorage.getItem('theme');
  if (stored === 'dark' || stored === 'light') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export const useThemeStore = create<ThemeStore>((set) => {
  const initial = getInitialTheme();
  document.documentElement.dataset.theme = initial;

  return {
    mode: initial,
    toggle: () =>
      set((state) => {
        const next = state.mode === 'dark' ? 'light' : 'dark';
        document.documentElement.dataset.theme = next;
        localStorage.setItem('theme', next);
        return { mode: next };
      }),
    setMode: (mode) => {
      document.documentElement.dataset.theme = mode;
      localStorage.setItem('theme', mode);
      set({ mode });
    },
  };
});
