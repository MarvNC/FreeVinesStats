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

  const getTargetIcon = () => {
    // Show the icon for the NEXT theme in the cycle
    switch (theme) {
      case 'system': return <Sun size={16} className="text-amber-500" />;  // system → light
      case 'light':  return <Moon size={16} className="text-indigo-400" />; // light → dark
      case 'dark':   return <Monitor size={16} className="text-slate-500 dark:text-slate-400" />; // dark → system
    }
  };

  const getTargetLabel = () => {
    switch (theme) {
      case 'system': return 'Light';
      case 'light':  return 'Dark';
      case 'dark':   return 'System';
    }
  };

  const getCurrentLabel = () => {
    switch (theme) {
      case 'system': return 'System';
      case 'light':  return 'Light';
      case 'dark':   return 'Dark';
    }
  };

  return (
    <button
      onClick={handleToggle}
      className="flex items-center gap-2 px-2.5 py-1.5 sm:px-3 rounded-full bg-slate-100 dark:bg-slate-700/80 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors shadow-sm border border-slate-200/80 dark:border-slate-600/80"
      aria-label={`Current theme: ${getCurrentLabel()}. Click to switch to ${getTargetLabel()}.`}
      title={`Switch to ${getTargetLabel()} mode`}
    >
      {getTargetIcon()}
      <span className="hidden sm:inline text-xs font-bold text-slate-600 dark:text-slate-300 w-10 text-center select-none">
        {getCurrentLabel()}
      </span>
    </button>
  );
}
