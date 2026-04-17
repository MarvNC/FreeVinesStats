import React from 'react';

export interface Option<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
  keyboardHint?: string;
}

interface SegmentedControlProps<T extends string | number> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: 'elevated' | 'flat';
  name: string; // unique name for radio group
}

const SegmentedControl = <T extends string | number>({
  options,
  value,
  onChange,
  variant = 'elevated',
  name,
}: SegmentedControlProps<T>) => {
  const containerClass = variant === 'elevated' 
    ? 'bg-slate-100 dark:bg-slate-900/80' 
    : 'bg-slate-50 dark:bg-slate-900/40';

  const activeClass = variant === 'elevated'
    ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white border border-slate-300 dark:border-slate-600'
    : 'bg-primary text-white dark:bg-primary dark:text-white';

  const inactiveClass = 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 border border-transparent';

  return (
    <div className={`${containerClass} p-[3px] rounded-none flex items-center w-full sm:w-auto overflow-x-auto scrollbar-hide border border-slate-300 dark:border-slate-700`} role="group" aria-label={name}>
      {options.map((option) => {
        const isSelected = value === option.value;
        const isDisabled = option.disabled;
        
        return (
          <label 
            key={String(option.value)} 
            className={`flex-1 sm:flex-none relative ${isDisabled ? 'cursor-not-allowed opacity-35' : 'cursor-pointer'}`}
          >
            <input 
              type="radio" 
              name={name} 
              className="peer sr-only" 
              checked={isSelected}
              onChange={() => !isDisabled && onChange(option.value)}
              disabled={isDisabled}
            />
            <div className={`
              px-3 py-1.5 rounded-none text-[10px] font-bold transition-all duration-150 text-center uppercase min-w-[3rem] whitespace-nowrap select-none tracking-widest flex items-center justify-center gap-1.5
              ${isSelected ? activeClass : inactiveClass}
            `}>
              {option.label}
              {option.keyboardHint && (
                <span className={`inline-flex items-center justify-center rounded-none text-[9px] px-1 font-bold tabular-nums opacity-60 bg-current/10`}>
                  {option.keyboardHint}
                </span>
              )}
            </div>
          </label>
        );
      })}
    </div>
  );
};

export default SegmentedControl;
