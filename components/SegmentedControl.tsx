import React from 'react';

export interface Option<T extends string | number> {
  value: T;
  label: string;
  disabled?: boolean;
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
    ? "bg-slate-100 dark:bg-slate-900" 
    : "bg-slate-50 dark:bg-slate-900/50";

  const activeClass = variant === 'elevated'
    ? "bg-white text-primary shadow-sm dark:bg-slate-700 dark:text-white"
    : "bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary-300";

  const inactiveClass = "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300";

  return (
    <div className={`${containerClass} p-1.5 rounded-xl flex items-center w-full sm:w-auto overflow-x-auto scrollbar-hide`}>
      {options.map((option) => {
        const isSelected = value === option.value;
        const isDisabled = option.disabled;
        
        return (
          <label 
            key={String(option.value)} 
            className={`flex-1 sm:flex-none relative ${isDisabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
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
              px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-center uppercase min-w-[3rem] whitespace-nowrap select-none
              ${isSelected ? activeClass : inactiveClass}
            `}>
              {option.label}
            </div>
          </label>
        );
      })}
    </div>
  );
};

export default SegmentedControl;