import { useEffect, useState } from 'react';

type Theme = 'auto' | 'light' | 'dark';
const KEY = 'portal:theme';

function apply(t: Theme) {
  const dark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('auto');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY) as Theme | null;
      if (saved) setTheme(saved);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, theme);
    } catch {
      /* ignore */
    }
    apply(theme);
    if (theme === 'auto') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => apply('auto');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [theme]);

  const cycle = () => setTheme((t) => (t === 'auto' ? 'light' : t === 'light' ? 'dark' : 'auto'));
  const label = theme === 'auto' ? 'Auto' : theme === 'light' ? 'Light' : 'Dark';
  const icon = theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◑';

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={`Theme: ${label}. Click to change.`}
      title={`Theme: ${label}`}
    >
      <span className="theme-icon" aria-hidden="true">{icon}</span>
      <span className="theme-label">{label}</span>
    </button>
  );
}
