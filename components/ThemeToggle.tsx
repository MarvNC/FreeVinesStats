import React from 'react';
import useDarkMode from '../hooks/useDarkMode';
import { FaSun, FaMoon, FaDesktop } from 'react-icons/fa';

export default function ThemeToggle() {
  const [resolvedTheme, setTheme, theme] = useDarkMode();

  const handleToggle = () => {
    if (theme === 'system') {
      setTheme('light');
    } else if (theme === 'light') {
      setTheme('dark');
    } else {
      setTheme('system');
    }
  };

  const getIcon = () => {
    switch (theme) {
      case 'system': return <FaDesktop className="w-5 h-5 text-slate-500 dark:text-slate-400" />;
      case 'light': return <FaSun className="w-5 h-5 text-amber-500" />;
      case 'dark': return <FaMoon className="w-5 h-5 text-indigo-400" />;
    }
  };

  const getLabel = () => {
     switch (theme) {
      case 'system': return 'System';
      case 'light': return 'Light';
      case 'dark': return 'Dark';
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shadow-sm border border-slate-200 dark:border-slate-600"
      aria-label={`Current theme: ${getLabel()}`}
      title="Toggle Theme (System -> Light -> Dark)"
    >
      {getIcon()}
      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 w-12 text-center select-none">
        {getLabel()}
      </span>
    </button>
  );
}
