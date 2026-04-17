import React from 'react';
import useDarkMode from '../hooks/useDarkMode';
import { Sun, Moon, Monitor } from 'lucide-react';

export default function ThemeToggle() {
  const [, setTheme, theme] = useDarkMode();

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
      case 'system': return <Monitor size={16} className="text-stone-500 dark:text-stone-400" />;
      case 'light':  return <Sun size={16} className="text-amber-500" />;
      case 'dark':   return <Moon size={16} className="text-indigo-400" />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case 'system': return 'System';
      case 'light':  return 'Light';
      case 'dark':   return 'Dark';
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-1.5 text-stone-500 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white transition-colors"
      aria-label={`Current theme: ${getLabel()}. Click to toggle.`}
      title="Toggle theme (System → Light → Dark)"
    >
      {getIcon()}
      <span className="hidden sm:inline">Theme</span>
    </button>
  );
}
